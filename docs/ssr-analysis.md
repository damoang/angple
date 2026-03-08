# Angple SSR 전체 분석 보고서

## 1. SSR 데이터 흐름 아키텍처

```
브라우저 요청 → nginx → SvelteKit Node 서버
                              ↓
                    [hooks.server.ts]
                    ├─ Rate Limiting (IP 기반)
                    ├─ URL 호환 리다이렉트 (PHP/Rhymix)
                    ├─ SSR 인증 (angple_sid → 세션 → JWT)
                    ├─ CSRF 검증 (POST/PUT/PATCH/DELETE)
                    ├─ SSR 응답 캐시 (비로그인 홈 10초 + 게시판 30초)
                    └─ resolve(event)
                              ↓
                    [+layout.server.ts] (루트)
                    ├─ getActiveTheme()         → 파일시스템 (5분 캐시)
                    ├─ getActivePlugins()        → 파일시스템 (5분 캐시)
                    ├─ loadMenus()              → Go 백엔드 (5분 캐시)
                    ├─ getCachedCelebrations()   → DB (60초 캐시)
                    └─ fetchBannersByPositions() → ads:9090 직접 (60초 캐시)
                              ↓
                    [+page.server.ts] (해당 페이지)
                              ↓
                    HTML 렌더링 → 브라우저
                              ↓
                    [+layout.svelte] hydration
                    ├─ themeStore.initFromServer()
                    ├─ pluginStore.initFromServer()
                    ├─ menuStore.initFromServer()
                    └─ initAppData({ celebration, banners })
```

## 2. 모든 Server Load 파일 (20개)

### 2.1 Layout Server (3개)

| 파일 | 파라미터 | 재실행 트리거 | 역할 |
|------|----------|--------------|------|
| `src/routes/+layout.server.ts` | `locals, url` | URL 변경마다 | 테마/플러그인/메뉴/축하/배너 |
| `src/routes/admin/+layout.server.ts` | `locals, url` | URL 변경마다 | 관리자 인증/권한 체크 |
| `src/routes/my/+layout.server.ts` | `locals` | 첫 로드만 | 미인증 시 로그인 리다이렉트 |

### 2.2 Page Server (14개)

| 파일 | 파라미터 | 재실행 트리거 | 주요 로직 |
|------|----------|--------------|----------|
| `+page.server.ts` (홈) | `fetch` | 매번 | indexWidgets, 추천글, 축하글 |
| `[boardId]/+page.server.ts` | `url, params, locals` | boardId/검색/페이지 변경 | 게시판 목록 (스트리밍) |
| `[boardId]/[postId]/+page.server.ts` | `params, fetch, locals, url, cookies` | postId 변경 | 게시글 상세 (스트리밍) |
| `[boardId]/write/+page.server.ts` | `locals, params` | boardId 변경 | 글쓰기 권한 체크 |
| `[boardId]/[postId]/edit/+page.server.ts` | `locals, params` | postId 변경 | 수정 권한 체크 |
| `my/+page.server.ts` | `url, locals` | tab/page 변경 | 마이페이지 탭 (스트리밍) |
| `my/points/+page.server.ts` | `url, locals` | page/filter 변경 | MySQL 직접 쿼리 (5개 병렬) |
| `my/exp/+page.server.ts` | `url, locals` | page 변경 | Go 백엔드 2개 병렬 |
| `feed/+page.server.ts` | `url` | view/group/page 변경 | 새글 모아보기 (스트리밍) |
| `register/+page.server.ts` | `url, locals, cookies` | — | 회원가입 폼 + Action |
| `admin/menus/+page.server.ts` | `locals` | — | 관리자 메뉴 CRUD |
| `member/[id]/+page.server.ts` | `params, fetch` | id 변경 | 회원 프로필 |
| `groups/+page.server.ts` | — | — | 그룹 목록 (L1+L2 캐시) |
| `content/[coId]/+page.server.ts` | `params` | coId 변경 | 정적 콘텐츠 |

### 2.3 Universal Load (4개)

| 파일 | SSR | 특징 |
|------|-----|------|
| `search/+page.ts` | O | 검색 결과 (SSR+CSR 양쪽) |
| `tags/[tag]/+page.ts` | O | 태그 필터 (apiClient 사용) |
| `my/blocked/+page.ts` | O | 차단 목록 (apiClient 사용) |
| `[boardId]/write/+page.ts` | **X** (`ssr=false`) | 글쓰기 (CSR 전용) |
| `[boardId]/[postId]/edit/+page.ts` | **X** (`ssr=false`) | 수정 (CSR 전용) |

## 3. 캐싱 전략 총정리

### 3.1 서버측 캐시

| 대상 | 위치 | TTL | 타입 |
|------|------|-----|------|
| SSR 응답 (비로그인 홈) | hooks.server.ts | 10초 | 인메모리 + singleflight |
| SSR 응답 (비로그인 게시판 목록) | hooks.server.ts | 30초 | 인메모리 + singleflight |
| JWT 토큰 | hooks.server.ts | 5분 | 인메모리 (Map, 최대 50K) |
| 세션 | session-store.ts | L1: 1분, L2: 5분 | TieredCache (Map+Redis) |
| 테마 | themes/index.ts | 5분 | 인메모리 |
| 플러그인 | plugins/index.ts | 5분 | 인메모리 |
| 메뉴 | menu-loader.ts | 5분 | 인메모리 |
| 축하메시지 | celebration.ts | 60초 | createCache + singleflight |
| 배너 | +layout.server.ts | 60초 | createCache + singleflight |
| 게시판 정보 | board-cache | 60초 | 인메모리 |
| 게시글 목록 | page.server.ts | 15초 | 인메모리 (비로그인+검색없음) |
| 그룹 목록 | groups/page.server.ts | L1: 10분, L2: 30분 | TieredCache |

### 3.2 클라이언트측 캐시

| 대상 | 위치 | TTL | 용도 |
|------|------|-----|------|
| celebration+banners | app-init.svelte.ts | 60분 | SSR fallback |
| 추천글 탭별 | recommended-posts.svelte | 탭 전환 시 유지 | 이전 탭 즉시 표시 |
| 회원 레벨 | member-levels.svelte.ts | 세션 동안 | 중복 요청 방지 |

### 3.3 CDN/브라우저 캐시 (Cache-Control)

| 경로 | 캐시 정책 |
|------|----------|
| `/_app/immutable/*` | 장기 (content-hash) |
| `/feed`, `/games`, `/info` | `s-maxage=30, stale-while-revalidate=60` |
| 게시판 목록 (1-depth) | `s-maxage=10, stale-while-revalidate=30` |
| 그 외 | `no-store, no-cache, must-revalidate` |

## 4. 클라이언트 API 호출 분류

### 4.1 SSR로 이미 해결된 것 (nginx 안 거침)

| 데이터 | SSR 소스 | 클라이언트 fallback |
|--------|---------|-------------------|
| 축하메시지 | layout.server.ts → getCachedCelebrations() | app-init (60분 TTL) |
| 배너 | layout.server.ts → fetchBannersByPositions() | app-init (60분 TTL) |
| 테마/플러그인/메뉴 | layout.server.ts | 스토어 initFromServer() |
| 인증 정보 | hooks.server.ts → locals | authStore.initFromSSR() |
| 조회수 증가 | [postId]/page.server.ts (쿠키 기반) | — |
| 리액션 초기값 | [postId]/page.server.ts (streamed) | — |
| 댓글 | [postId]/page.server.ts (streamed) | — |

### 4.2 여전히 클라이언트에서 fetch하는 것 (nginx 경유)

| 호출 | 엔드포인트 | 트리거 | 필요성 |
|------|-----------|--------|--------|
| 회원 레벨 배치 | `/api/members/levels?ids=...` | 게시글/댓글 렌더링 | **필요** (동적, per-page) |
| 작성자 활동 | `/api/members/{id}/activity` | 게시글 상세 사이드바 | **필요** (인터랙티브) |
| 추천글 탭 전환 | `/api/widgets/recommended/data?period=` | 탭 클릭 | **필요** (사용자 액션) |
| 리액션 추가/토글 | `/api/reactions` POST | 리액션 클릭 | **필요** (뮤테이션) |
| 스크랩 | `/api/scraps` POST | 스크랩 버튼 | **필요** (뮤테이션) |
| 좋아요 | `/api/boards/.../like` POST | 좋아요 버튼 | **필요** (뮤테이션) |
| 댓글 작성 | `/api/boards/.../comments` POST | 댓글 등록 | **필요** (뮤테이션) |
| 검색 | `/api/search` | 검색 입력 | **필요** (사용자 액션) |
| GIF 검색 | `/api/tenor/search` | GIF 패널 | **필요** (인터랙티브) |
| 알림 스트림 | `/api/notifications/stream` | SSE 연결 | **필요** (실시간) |

## 5. Rate Limiting 설정

| 대상 | 제한 | 윈도우 |
|------|------|--------|
| API 읽기 (글로벌) | 600회 | 1분 |
| API 쓰기 (글로벌) | 60회 | 1분 |
| 로그인 | 10회 | 15분 |
| OAuth | 20회 | 15분 |
| 로그아웃 | 30회 | 15분 |

## 6. 보안 설정

- **CSRF**: double-submit cookie (`angple_csrf` → `x-csrf-token` 헤더)
  - 면제: `/api/*` (SvelteKit 내부), `/plugin/social/*` (OAuth), `/cert/inicis/result`
- **CSP**: script-src에 Cloudflare Turnstile, GAM, AdSense 허용
- **세션**: SHA-256 해시 저장, 30일 수명, 15일 슬라이딩 윈도우
- **인증**: SSR에서 처리 → 클라이언트에 user/accessToken/csrfToken 전달

## 7. 성능 패턴

### 잘 되어 있는 것
- **Promise.allSettled**: 개별 실패 허용 (루트 레이아웃, 게시판, 게시글)
- **스트리밍**: 게시판 목록, 게시글 댓글, 마이페이지 탭 (스켈레톤 먼저)
- **singleflight**: SSR 응답 캐시, 축하메시지, app-init, 배너
- **타임아웃**: 제휴 링크 변환 3초, 마이페이지 5초
- **비로그인 홈 캐시**: SSR 응답 자체를 10초 캐싱
- **CDN Cache-Control**: 공개 페이지에 s-maxage 설정

### 개선 완료된 것
- **`fetchBannersByPositions()`**: 60초 인메모리 캐시 + singleflight 적용 → ads 서버 부하 감소

### 현재 상태 유지
- **`loadMenus()`**: 5분 캐시 + `url.pathname` 트리거 = 실제 Go 백엔드 호출은 5분마다 1번
- **글쓰기/수정**: `ssr=false` CSR 전용 — 에디터 라이브러리 때문에 합리적

## 8. 현재 상태 요약

```
변경 전 (url 없음):
  첫 로드: SSR 데이터 전달 ✓
  SPA 네비게이션: layout load 재실행 안 함 ✗
  5분 후: 클라이언트 /api/init fetch → nginx 경유 ✗
  결과: 1 페이지 이동 = 1 SSR + 4~5 client API = 5~6 nginx 요청

변경 후 (url.pathname 추가 + 배너 캐시):
  첫 로드: SSR 데이터 전달 ✓
  SPA 네비게이션: layout load 재실행 ✓ (서버 내부 호출, 캐시 히트)
  캐시 만료: 60분 TTL → 사실상 재요청 없음
  결과: 1 페이지 이동 = 1 SSR (데이터 포함) = 1 nginx 요청

남은 클라이언트 호출: 전부 사용자 인터랙션 기반 (필요한 것들)
```
