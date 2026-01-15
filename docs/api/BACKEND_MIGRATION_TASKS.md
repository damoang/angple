# 백엔드 보안 인증 마이그레이션 작업

## 현재 상태 분석

### ✅ 이미 구현된 것

-   `DamoangCookieAuth` 미들웨어 (`cookie_auth.go`) - `damoang_jwt` 쿠키에서 JWT 토큰 읽기
-   JWT 토큰 생성/검증 로직 (`jwt.Manager`)
-   Clean Architecture 구조 (Handler → Service → Repository)

### ❌ 수정이 필요한 것

1. 로그인 핸들러: 응답에 httpOnly 쿠키 설정 안 함
2. 리프레시 핸들러: JSON body로 refreshToken을 받음 (쿠키 사용 안 함)
3. 로그아웃 핸들러: 존재하지 않음

---

## 수정 작업 목록

### 1. 로그인 핸들러 수정

**파일**: `internal/handler/auth_handler.go`

**현재 코드** (auth_handler.go:45-75):

```go
func (h *AuthHandler) Login(c *fiber.Ctx) error {
    // ... 로그인 로직

    // ❌ JSON으로만 반환
    return c.JSON(common.APIResponse{
        Data: loginResp,
    })
}
```

**수정 후**:

```go
func (h *AuthHandler) Login(c *fiber.Ctx) error {
    // ... 기존 로그인 로직

    loginResp, err := h.service.Login(req.UserID, req.Password)
    if err != nil {
        return common.ErrorResponse(c, 401, "LOGIN_FAILED", err)
    }

    // ✅ refreshToken을 httpOnly 쿠키로 설정
    cookie := &fiber.Cookie{
        Name:     "damoang_refresh_token",
        Value:    loginResp.RefreshToken,
        HTTPOnly: true,
        Secure:   !h.cfg.IsDevelopment(), // 운영 환경에서만 Secure
        SameSite: "Strict",
        MaxAge:   7 * 24 * 60 * 60, // 7일 (초 단위)
        Path:     "/",
    }
    c.Cookie(cookie)

    // ✅ 응답에서는 refreshToken 제거, accessToken만 반환
    return c.JSON(common.APIResponse{
        Data: map[string]interface{}{
            "access_token": loginResp.AccessToken,
            "expires_in":   900, // 15분 (초 단위)
            "user":         loginResp.User,
        },
    })
}
```

**필요한 변경사항**:

-   `AuthHandler` 구조체에 `cfg *config.Config` 필드 추가 필요
-   `NewAuthHandler()` 생성자에서 `cfg` 주입

---

### 2. 리프레시 핸들러 수정

**파일**: `internal/handler/auth_handler.go`

**현재 코드** (auth_handler.go:77-100):

```go
func (h *AuthHandler) RefreshToken(c *fiber.Ctx) error {
    var req RefreshRequest
    if err := c.BodyParser(&req); err != nil {
        return common.ErrorResponse(c, 400, "Invalid request body", err)
    }

    // ❌ JSON body에서 refreshToken 읽기
    tokens, err := h.service.RefreshToken(req.RefreshToken)
    // ...
}
```

**수정 후**:

```go
func (h *AuthHandler) RefreshToken(c *fiber.Ctx) error {
    // ✅ 쿠키에서 refreshToken 읽기
    refreshToken := c.Cookies("damoang_refresh_token")
    if refreshToken == "" {
        return common.ErrorResponse(c, 401, "REFRESH_TOKEN_MISSING",
            errors.New("refresh token cookie not found"))
    }

    tokens, err := h.service.RefreshToken(refreshToken)
    if errors.Is(err, common.ErrInvalidToken) {
        return common.ErrorResponse(c, 401, "INVALID_REFRESH_TOKEN", err)
    }
    if err != nil {
        return common.ErrorResponse(c, 500, "REFRESH_FAILED", err)
    }

    // ✅ 새로운 refreshToken을 쿠키로 설정 (토큰 로테이션)
    cookie := &fiber.Cookie{
        Name:     "damoang_refresh_token",
        Value:    tokens.RefreshToken,
        HTTPOnly: true,
        Secure:   !h.cfg.IsDevelopment(),
        SameSite: "Strict",
        MaxAge:   7 * 24 * 60 * 60,
        Path:     "/",
    }
    c.Cookie(cookie)

    // ✅ accessToken만 JSON으로 반환
    return c.JSON(common.APIResponse{
        Data: map[string]interface{}{
            "access_token": tokens.AccessToken,
            "expires_in":   900,
        },
    })
}
```

**제거 가능한 구조체**:

```go
// ❌ RefreshRequest 구조체 더 이상 필요 없음
type RefreshRequest struct {
    RefreshToken string `json:"refresh_token" validate:"required"`
}
```

---

### 3. 로그아웃 핸들러 추가

**파일**: `internal/handler/auth_handler.go`

**새로 추가**:

```go
// Logout handles POST /api/v2/auth/logout
func (h *AuthHandler) Logout(c *fiber.Ctx) error {
    // ✅ refreshToken 쿠키 삭제
    cookie := &fiber.Cookie{
        Name:     "damoang_refresh_token",
        Value:    "",
        HTTPOnly: true,
        Secure:   !h.cfg.IsDevelopment(),
        SameSite: "Strict",
        MaxAge:   -1, // 즉시 만료
        Path:     "/",
    }
    c.Cookie(cookie)

    return c.JSON(common.APIResponse{
        Data: map[string]string{
            "message": "Logged out successfully",
        },
    })
}
```

---

### 4. 라우트 등록

**파일**: `internal/routes/routes.go` (또는 auth 라우트 파일)

**추가 필요**:

```go
auth := api.Group("/auth")

auth.Post("/login", authHandler.Login)
auth.Post("/logout", authHandler.Logout) // ✅ 새로 추가
auth.Post("/token/refresh", authHandler.RefreshToken)
```

---

### 5. CORS 설정 확인

**파일**: `cmd/api/main.go`

**필요한 설정** (프론트엔드가 http://localhost:5173에서 실행되므로):

```go
app.Use(cors.New(cors.Config{
    AllowOrigins:     "http://localhost:5173,http://localhost:5174", // 개발 환경
    AllowMethods:     "GET,POST,PUT,DELETE,OPTIONS",
    AllowHeaders:     "Content-Type,Authorization",
    AllowCredentials: true, // ✅ 쿠키 전송 허용 - 필수!
    MaxAge:           300,
}))
```

---

## 의존성 주입 수정

**파일**: `cmd/api/main.go`

**현재**:

```go
authHandler := handler.NewAuthHandler(authService)
```

**수정 후**:

```go
authHandler := handler.NewAuthHandler(authService, cfg)
```

**AuthHandler 생성자**도 함께 수정:

```go
// NewAuthHandler creates a new AuthHandler
func NewAuthHandler(service service.AuthService, cfg *config.Config) *AuthHandler {
    return &AuthHandler{
        service: service,
        cfg:     cfg,
    }
}
```

---

## 테스트 계획

### 1. 단위 테스트

```bash
# auth_handler 테스트
go test -v ./internal/handler -run TestAuthHandler

# auth_service 테스트
go test -v ./internal/service -run TestAuthService
```

### 2. 통합 테스트 (curl)

```bash
# 1. 로그인 (쿠키 저장)
curl -c cookies.txt -X POST http://localhost:8081/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"user_id":"user1","password":"test1234"}'

# 응답 예시:
# {
#   "data": {
#     "access_token": "eyJ...",
#     "expires_in": 900,
#     "user": {...}
#   }
# }
# Set-Cookie: damoang_refresh_token=...; HttpOnly; Secure; SameSite=Strict

# 2. 토큰 갱신 (쿠키 자동 전송)
curl -b cookies.txt -X POST http://localhost:8081/api/v2/auth/token/refresh

# 응답 예시:
# {
#   "data": {
#     "access_token": "eyJ...",
#     "expires_in": 900
#   }
# }

# 3. 로그아웃 (쿠키 삭제)
curl -b cookies.txt -X POST http://localhost:8081/api/v2/auth/logout

# 응답 예시:
# {
#   "data": {
#     "message": "Logged out successfully"
#   }
# }
```

### 3. 프론트엔드 연동 테스트

```typescript
// apps/web/src/routes/+page.svelte (테스트용)
async function testAuth() {
    // 1. 로그인
    const loginRes = await fetch('http://localhost:8081/api/v2/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // ✅ 쿠키 자동 전송/수신
        body: JSON.stringify({ user_id: 'user1', password: 'test1234' })
    });
    const { data } = await loginRes.json();
    console.log('accessToken:', data.access_token);

    // 2. 토큰 갱신
    const refreshRes = await fetch('http://localhost:8081/api/v2/auth/token/refresh', {
        method: 'POST',
        credentials: 'include'
    });
    const refreshData = await refreshRes.json();
    console.log('new accessToken:', refreshData.data.access_token);

    // 3. 로그아웃
    await fetch('http://localhost:8081/api/v2/auth/logout', {
        method: 'POST',
        credentials: 'include'
    });
}
```

---

## 보안 체크리스트

### ✅ 구현 완료 후 확인 사항

-   [ ] refreshToken이 응답 JSON에 포함되지 않음
-   [ ] refreshToken 쿠키에 `HttpOnly` 플래그 설정됨
-   [ ] 운영 환경에서 `Secure` 플래그 설정됨
-   [ ] `SameSite=Strict` 설정으로 CSRF 방지
-   [ ] CORS에서 `AllowCredentials: true` 설정됨
-   [ ] 토큰 로테이션 구현 (리프레시할 때마다 새 refreshToken 발급)
-   [ ] 로그아웃 시 쿠키 완전 삭제됨

### ⚠️ 추가 고려 사항 (Phase 2)

-   [ ] Redis에 refreshToken 저장 (탈취 시 무효화 가능)
-   [ ] IP/User-Agent 기반 토큰 검증
-   [ ] refreshToken 사용 내역 로깅
-   [ ] 동시 로그인 제한 기능

---

## 예상 작업 시간

-   **백엔드 수정**: 1-2시간
-   **테스트 작성**: 1시간
-   **통합 테스트**: 30분
-   **총**: 약 3-4시간

---

## 다음 단계

1. ✅ 이 문서 검토
2. 백엔드 수정 작업 시작
3. 테스트 완료 후 프론트엔드 작업 진행
