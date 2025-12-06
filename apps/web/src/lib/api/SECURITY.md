# API 클라이언트 보안 가이드

## ⚠️ 현재 보안 이슈

### localStorage 토큰 저장의 취약점

**문제점:**

```javascript
// ❌ 현재 구현 - XSS 공격에 취약
localStorage.setItem('damoang_api_token', token);
```

**취약점:**

1. **XSS 공격**: JavaScript로 `localStorage` 접근 가능
2. **세션 탈취**: 악의적인 스크립트가 토큰 복사 가능
3. **영구 저장**: 브라우저를 닫아도 토큰이 남아있음

---

## 🔒 권장 보안 아키텍처

### 1. httpOnly Cookie 방식

```
┌─────────────┐                    ┌─────────────┐
│   Browser   │                    │   Server    │
└─────────────┘                    └─────────────┘
       │                                  │
       │  1. POST /auth/login             │
       ├─────────────────────────────────>│
       │                                  │
       │  2. Set-Cookie: refreshToken     │
       │     (httpOnly, Secure, SameSite) │
       │<─────────────────────────────────┤
       │                                  │
       │  3. POST /auth/token/refresh     │
       │     (Cookie 자동 전송)            │
       ├─────────────────────────────────>│
       │                                  │
       │  4. { accessToken, expiresIn }   │
       │     (JSON 응답, 메모리 저장)      │
       │<─────────────────────────────────┤
```

### 2. 백엔드 API 스펙 (권장)

#### 로그인

```typescript
POST /api/v1/auth/login
Request: { email, password }
Response:
  - Set-Cookie: refreshToken (httpOnly, Secure, SameSite=Strict, Max-Age=7d)
  - Body: { accessToken, expiresIn: 900 } // 15분
```

#### 토큰 갱신

```typescript
POST /api/v1/auth/token/refresh
Request: (Cookie에서 refreshToken 자동 전송)
Response:
  - Body: { accessToken, expiresIn: 900 }
```

#### 로그아웃

```typescript
POST /api/v1/auth/logout
Response:
  - Set-Cookie: refreshToken (Max-Age=0)
```

### 3. 프론트엔드 구현 (개선안)

```typescript
class SecureApiClient {
    private accessToken: string | null = null; // 메모리에만 저장
    private tokenExpiry: number | null = null;
    private refreshTimer: NodeJS.Timeout | null = null;

    constructor() {
        // 페이지 로드 시 자동으로 토큰 갱신
        this.refreshAccessToken();
    }

    // 페이지 로드 시마다 실행
    async refreshAccessToken(): Promise<void> {
        try {
            const response = await fetch('/api/v1/auth/token/refresh', {
                method: 'POST',
                credentials: 'include' // Cookie 자동 전송
            });

            const data = await response.json();

            // 메모리에만 저장 (localStorage 사용 안 함)
            this.accessToken = data.accessToken;
            this.tokenExpiry = Date.now() + data.expiresIn * 1000;

            // 만료 5분 전에 자동 갱신
            this.scheduleTokenRefresh(data.expiresIn - 300);
        } catch (error) {
            // refreshToken 만료 → 로그인 페이지로 리다이렉트
            window.location.href = '/login';
        }
    }

    // 토큰 자동 갱신 스케줄링
    private scheduleTokenRefresh(seconds: number): void {
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
        }
        this.refreshTimer = setTimeout(() => {
            this.refreshAccessToken();
        }, seconds * 1000);
    }

    // API 요청
    async request(url: string, options: RequestInit = {}): Promise<Response> {
        const headers = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.accessToken}`,
            ...options.headers
        };

        return fetch(url, {
            ...options,
            headers,
            credentials: 'include' // Cookie 전송
        });
    }
}
```

---

## 📋 마이그레이션 단계

### Phase 1: 현재 (Mock 개발)

- ✅ Mock 데이터로 UI/UX 개발
- ✅ localStorage 사용 (개발 편의성)
- ⚠️ 보안 경고 코멘트 추가

### Phase 2: 백엔드 API 개선

```bash
# 백엔드 이슈 생성
- [ ] refreshToken httpOnly cookie 구현
- [ ] accessToken 단기(15분) 설정
- [ ] CORS credentials 설정
- [ ] CSRF 보호 (SameSite=Strict)
```

### Phase 3: 프론트엔드 리팩토링

```bash
- [ ] ApiClient 클래스 리팩토링
- [ ] localStorage 제거
- [ ] 메모리 기반 토큰 관리
- [ ] 자동 갱신 로직 구현
- [ ] 로그아웃 시 서버 요청 추가
```

### Phase 4: 보안 테스트

```bash
- [ ] XSS 공격 시뮬레이션
- [ ] CSRF 공격 테스트
- [ ] 토큰 갱신 플로우 검증
- [ ] 세션 타임아웃 테스트
```

---

## 🛡️ 추가 보안 권장사항

### 1. Content Security Policy (CSP)

```html
<!-- apps/web/src/app.html -->
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self';" />
```

### 2. XSS 방지

- ✅ Svelte의 자동 이스케이프 활용
- ❌ `@html` 사용 최소화
- ✅ 사용자 입력 검증

### 3. HTTPS 강제

```javascript
// Vite 설정
server: {
    https: true;
}
```

### 4. Rate Limiting

```typescript
// 백엔드에서 구현
- 로그인: 5회/15분
- 토큰 갱신: 10회/분
```

---

## 📚 참고 자료

- [OWASP Token Storage](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [SvelteKit Security](https://kit.svelte.dev/docs/security)

---

## 🤝 관련 이슈

- [ ] #XX: localStorage 토큰 저장 보안 이슈
- [ ] #XX: httpOnly cookie 인증 구현
- [ ] #XX: 토큰 자동 갱신 로직 추가
