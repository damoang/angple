# 프론트엔드 보안 인증 구현 계획

## 📋 개요

localStorage 기반 토큰 저장을 httpOnly cookie + 메모리 기반으로 마이그레이션

---

## 🎯 Phase 1: AccessToken 메모리 관리 구조 설계

### 변경 전 (현재)

```typescript
class ApiClient {
    private token: string | null = null;

    private loadToken(): void {
        // ❌ localStorage에서 로드
        this.token = localStorage.getItem('damoang_api_token');
    }

    private saveToken(token: string): void {
        // ❌ localStorage에 저장
        localStorage.setItem('damoang_api_token', token);
    }
}
```

### 변경 후 (보안)

```typescript
class SecureApiClient {
    // ✅ 메모리에만 저장
    private accessToken: string | null = null;
    private tokenExpiry: number | null = null;
    private refreshTimer: NodeJS.Timeout | null = null;

    constructor() {
        // ✅ 페이지 로드 시 자동 토큰 갱신
        this.initializeAuth();
    }
}
```

---

## 🎯 Phase 2: Token Refresh 자동화

### 2.1 초기화 플로우

```typescript
async initializeAuth(): Promise<void> {
  try {
    // refreshToken cookie로 accessToken 발급
    await this.refreshAccessToken();
  } catch (error) {
    // refreshToken 만료 → 로그인 페이지
    console.log('인증 필요');
  }
}
```

### 2.2 자동 갱신 로직

```typescript
async refreshAccessToken(): Promise<void> {
  const response = await fetch('/api/v1/auth/token/refresh', {
    method: 'POST',
    credentials: 'include' // ✅ Cookie 자동 전송
  });

  if (!response.ok) {
    throw new Error('Token refresh failed');
  }

  const data = await response.json();

  // ✅ 메모리에만 저장
  this.accessToken = data.accessToken;
  this.tokenExpiry = Date.now() + data.expiresIn * 1000;

  // ✅ 만료 5분 전에 자동 갱신
  this.scheduleTokenRefresh(data.expiresIn - 300);
}
```

### 2.3 스케줄링

```typescript
private scheduleTokenRefresh(seconds: number): void {
  if (this.refreshTimer) {
    clearTimeout(this.refreshTimer);
  }

  this.refreshTimer = setTimeout(() => {
    this.refreshAccessToken().catch(() => {
      // 갱신 실패 → 로그인 페이지
      window.location.href = '/login';
    });
  }, seconds * 1000);
}
```

---

## 🎯 Phase 3: ApiClient 리팩토링

### 3.1 Request 메서드 수정

```typescript
async request<T>(
  url: string,
  options: RequestInit = {}
): Promise<{ data: T }> {
  const headers = {
    'Content-Type': 'application/json',
    ...(this.accessToken && {
      Authorization: `Bearer ${this.accessToken}`
    }),
    ...options.headers
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include' // ✅ Cookie 전송
  });

  // ✅ 401 에러 → 토큰 갱신 재시도
  if (response.status === 401) {
    await this.refreshAccessToken();
    return this.request<T>(url, options); // 재시도
  }

  return { data: await response.json() };
}
```

### 3.2 로그인 메서드

```typescript
async login(email: string, password: string): Promise<User> {
  const response = await fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // ✅ Cookie 수신
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error('로그인 실패');
  }

  const data = await response.json();

  // ✅ accessToken 메모리 저장
  this.accessToken = data.accessToken;
  this.tokenExpiry = Date.now() + data.expiresIn * 1000;

  // ✅ 자동 갱신 스케줄
  this.scheduleTokenRefresh(data.expiresIn - 300);

  return data.user;
}
```

### 3.3 로그아웃 메서드

```typescript
async logout(): Promise<void> {
  try {
    await fetch('/api/v1/auth/logout', {
      method: 'POST',
      credentials: 'include' // ✅ Cookie 전송
    });
  } finally {
    // ✅ 메모리 토큰 삭제
    this.accessToken = null;
    this.tokenExpiry = null;

    // ✅ 갱신 타이머 중지
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    // 로그인 페이지로 이동
    window.location.href = '/login';
  }
}
```

---

## 🎯 Phase 4: localStorage 제거

### 4.1 제거 대상

```typescript
// ❌ 삭제할 코드
localStorage.setItem('damoang_api_token', token);
localStorage.getItem('damoang_api_token');
localStorage.removeItem('damoang_api_token');
localStorage.setItem('damoang_api_token_expiry', expiry);
localStorage.getItem('damoang_api_token_expiry');
localStorage.removeItem('damoang_api_token_expiry');
```

### 4.2 유지 대상

```typescript
// ✅ 유지 (보안 문제 없음)
localStorage.setItem('damoang_use_mock', 'true');
localStorage.getItem('damoang_use_mock');
```

---

## 🎯 Phase 5: 테스트

### 5.1 단위 테스트

```typescript
describe('SecureApiClient', () => {
    it('로그인 성공 시 accessToken을 메모리에만 저장', async () => {
        await apiClient.login('test@test.com', 'password');

        expect(apiClient.getAccessToken()).toBeTruthy();
        expect(localStorage.getItem('damoang_api_token')).toBeNull();
    });

    it('토큰 만료 5분 전 자동 갱신', async () => {
        jest.useFakeTimers();

        await apiClient.login('test@test.com', 'password');

        // 10분 경과 (15분 - 5분)
        jest.advanceTimersByTime(10 * 60 * 1000);

        expect(refreshSpy).toHaveBeenCalled();
    });
});
```

### 5.2 통합 테스트

```typescript
describe('인증 플로우', () => {
    it('로그인 → API 호출 → 로그아웃', async () => {
        // 1. 로그인
        const user = await apiClient.login('test@test.com', 'password');
        expect(user).toBeDefined();

        // 2. 인증 필요 API 호출
        const posts = await apiClient.getFreePosts(1, 10);
        expect(posts).toHaveLength(10);

        // 3. 로그아웃
        await apiClient.logout();
        expect(apiClient.getAccessToken()).toBeNull();
    });
});
```

---

## 📁 파일 구조

```
src/lib/api/
├── client.ts                  # 기존 파일 (리팩토링)
├── secure-client.ts           # 새 보안 클라이언트 (임시)
├── types.ts                   # API 타입 정의
├── mock-data.ts               # Mock 데이터
├── index.ts                   # Export
├── SECURITY.md                # 보안 가이드 (기존)
├── AUTH_API_SPEC.md           # 백엔드 API 스펙 (신규)
└── FRONTEND_IMPLEMENTATION_PLAN.md  # 이 문서
```

---

## ⚡ 마이그레이션 전략

### 옵션 A: 점진적 마이그레이션 (추천)

1. `secure-client.ts` 신규 작성
2. 일부 페이지에서 테스트
3. 문제 없으면 `client.ts` 교체
4. localStorage 코드 제거

### 옵션 B: 한 번에 교체

1. `client.ts` 직접 수정
2. 전체 테스트
3. 배포

---

## ✅ 체크리스트

### 백엔드 준비 (협업 필요)

-   [ ] POST /api/v1/auth/login 구현
-   [ ] POST /api/v1/auth/token/refresh 구현
-   [ ] POST /api/v1/auth/logout 구현
-   [ ] GET /api/v1/auth/me 구현
-   [ ] httpOnly cookie 설정
-   [ ] CORS credentials 허용

### 프론트엔드 구현

-   [ ] SecureApiClient 클래스 작성
-   [ ] 메모리 기반 토큰 관리
-   [ ] 자동 갱신 로직
-   [ ] 로그인/로그아웃 메서드
-   [ ] 401 에러 핸들링
-   [ ] localStorage 제거

### 테스트

-   [ ] 단위 테스트 작성
-   [ ] 통합 테스트 작성
-   [ ] E2E 테스트 (Playwright)
-   [ ] XSS 공격 시뮬레이션

### 배포

-   [ ] 스테이징 환경 테스트
-   [ ] 운영 환경 배포
-   [ ] 모니터링 설정

---

## 🚨 주의사항

1. **refreshToken은 절대 JavaScript로 접근 불가**

    - httpOnly cookie만 사용
    - document.cookie로 읽기 불가

2. **accessToken은 메모리에만 저장**

    - localStorage/sessionStorage 사용 금지
    - 페이지 새로고침 시 refreshToken으로 재발급

3. **HTTPS 필수**

    - Secure cookie는 HTTPS만 전송
    - 로컬 개발은 http://localhost 예외

4. **CORS credentials**
    - fetch 옵션에 `credentials: 'include'` 필수
    - 백엔드 CORS 설정 확인

---

## 📚 참고 자료

-   [OWASP JWT 보안](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
-   [SameSite Cookie](https://web.dev/samesite-cookies-explained/)
-   [SvelteKit 인증](https://kit.svelte.dev/docs/hooks#server-hooks-handle)
