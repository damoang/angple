# 인증 API 스펙 (백엔드 구현 가이드)

## 🎯 목표

localStorage 기반 토큰 저장을 httpOnly cookie 기반으로 마이그레이션하여 XSS 공격 방어

## 🔒 보안 아키텍처

### 토큰 전략

-   **refreshToken**: httpOnly cookie (7일, Secure, SameSite=Strict)
-   **accessToken**: 메모리 저장 (15분, JSON 응답)

### 플로우

```
1. 로그인 → refreshToken (cookie) + accessToken (JSON)
2. 페이지 로드 → refreshToken으로 accessToken 갱신
3. API 호출 → accessToken 사용 (Header: Authorization)
4. 만료 5분 전 → 자동 갱신
5. 로그아웃 → refreshToken cookie 삭제
```

---

## 📋 API 엔드포인트

### 1. 로그인

```http
POST /api/v1/auth/login
Content-Type: application/json

Request Body:
{
  "email": "user@example.com",
  "password": "password123"
}

Response: 200 OK
Set-Cookie: refreshToken=<JWT>; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/
Content-Type: application/json

{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "사용자",
    "role": "user"
  }
}

Error Response: 401 Unauthorized
{
  "error": "INVALID_CREDENTIALS",
  "message": "이메일 또는 비밀번호가 올바르지 않습니다."
}
```

**쿠키 설정:**

-   `HttpOnly`: JavaScript 접근 차단
-   `Secure`: HTTPS만 전송
-   `SameSite=Strict`: CSRF 방어
-   `Max-Age=604800`: 7일 (초 단위)
-   `Path=/`: 모든 경로에서 전송

---

### 2. 토큰 갱신

```http
POST /api/v1/auth/token/refresh
Cookie: refreshToken=<JWT>

Response: 200 OK
Content-Type: application/json

{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900
}

Error Response: 401 Unauthorized
{
  "error": "INVALID_REFRESH_TOKEN",
  "message": "로그인이 필요합니다."
}
```

**사용 시점:**

1. 페이지 로드 시 (앱 초기화)
2. accessToken 만료 5분 전
3. API 호출 시 401 에러 발생 시

---

### 3. 로그아웃

```http
POST /api/v1/auth/logout
Cookie: refreshToken=<JWT>

Response: 200 OK
Set-Cookie: refreshToken=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/
Content-Type: application/json

{
  "message": "로그아웃되었습니다."
}
```

**동작:**

-   refreshToken cookie 삭제 (Max-Age=0)
-   서버에서 refreshToken을 블랙리스트에 추가 (선택사항)

---

### 4. 현재 사용자 조회

```http
GET /api/v1/auth/me
Authorization: Bearer <accessToken>

Response: 200 OK
Content-Type: application/json

{
  "id": 1,
  "email": "user@example.com",
  "name": "사용자",
  "role": "user",
  "profile": {
    "avatar": "https://cdn.example.com/avatar.jpg",
    "bio": "안녕하세요"
  }
}

Error Response: 401 Unauthorized
{
  "error": "INVALID_ACCESS_TOKEN",
  "message": "인증이 필요합니다."
}
```

---

## 🔑 JWT 스펙

### refreshToken (7일)

```json
{
    "sub": "1",
    "email": "user@example.com",
    "type": "refresh",
    "iat": 1703001600,
    "exp": 1703606400
}
```

### accessToken (15분)

```json
{
    "sub": "1",
    "email": "user@example.com",
    "role": "user",
    "type": "access",
    "iat": 1703001600,
    "exp": 1703002500
}
```

---

## 🛡️ 보안 요구사항

### 백엔드 필수 구현

1. **CORS 설정**

```javascript
app.use(
    cors({
        origin: ['https://damoang.net', 'http://localhost:5173'],
        credentials: true
    })
);
```

2. **Cookie 설정**

```javascript
res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7일
});
```

3. **Rate Limiting**

-   로그인: 5회/15분 (IP 기준)
-   토큰 갱신: 10회/분 (IP 기준)

4. **refreshToken 보안**

-   데이터베이스에 해시 저장
-   일회성 사용 (Rotation) 권장
-   블랙리스트 관리 (로그아웃 시)

---

## 📊 에러 코드

| 코드                    | HTTP | 설명                            |
| ----------------------- | ---- | ------------------------------- |
| `INVALID_CREDENTIALS`   | 401  | 이메일 또는 비밀번호 오류       |
| `INVALID_REFRESH_TOKEN` | 401  | refreshToken 만료/유효하지 않음 |
| `INVALID_ACCESS_TOKEN`  | 401  | accessToken 만료/유효하지 않음  |
| `ACCOUNT_LOCKED`        | 403  | 계정 잠김 (5회 실패 시)         |
| `TOO_MANY_REQUESTS`     | 429  | Rate limit 초과                 |

---

## 🧪 테스트 시나리오

### 1. 정상 플로우

```
1. POST /auth/login → 200 OK (cookie + accessToken)
2. GET /auth/me → 200 OK
3. (15분 후) POST /auth/token/refresh → 200 OK
4. POST /auth/logout → 200 OK
5. GET /auth/me → 401 Unauthorized
```

### 2. 만료 토큰

```
1. POST /auth/login → 200 OK
2. (7일 후) POST /auth/token/refresh → 401 Unauthorized
3. Redirect to /login
```

### 3. XSS 방어

```
1. document.cookie → refreshToken 접근 불가 (httpOnly)
2. localStorage → accessToken 없음 (메모리에만 저장)
```

---

## 📝 프론트엔드 마이그레이션 체크리스트

-   [ ] ApiClient 클래스 리팩토링
-   [ ] accessToken 메모리 저장
-   [ ] 자동 갱신 로직 구현
-   [ ] localStorage 제거
-   [ ] credentials: 'include' 설정
-   [ ] 401 에러 핸들링 (자동 로그인 페이지 이동)

---

## 🚀 배포 전 확인사항

-   [ ] HTTPS 강제 (production)
-   [ ] CORS credentials 허용
-   [ ] Cookie SameSite=Strict
-   [ ] Rate limiting 활성화
-   [ ] refreshToken DB 저장
-   [ ] 로그 모니터링 (로그인 실패, 토큰 갱신)
