# Findings

---

# 2026-03-18 — GA4 + CPM 개선 메모

## 공식 자료 핵심

-   GA4는 `login`, `sign_up` 같은 권장 이벤트를 실제 성공 시점에 쓰는 것이 맞고, 클릭/리다이렉트 시작 단계는 별도 이벤트로 분리하는 편이 안전함
-   Google은 Analytics로 PII를 보내지 말라고 명시하며, 검색창/폼의 사용자 입력도 전송 전에 제거하라고 안내함
-   GPT는 `ImpressionViewableEvent`, `SlotVisibilityChangedEvent` 같은 이벤트를 제공하므로 refresh를 단순 타이머가 아니라 viewability 기반으로 설계할 수 있음
-   Ad Manager는 refresh inventory 선언에서 event-driven refresh를 권장하고, 간격은 30초 이상이어야 하며 일반적으로 더 긴 간격이 더 바람직하다고 안내함
-   Viewability 개선을 위해서는 콘텐츠 흐름 안의 광고 배치, 빠른 렌더링, 의미 없는 영역의 광고 남발 억제가 중요함

## 현재 구현에서 보인 문제

-   PR #696 원안은 `login` / `sign_up`을 성공 이벤트가 아니라 시작 이벤트로 사용하고 있었음
-   `search_term`, `post_title`, `file_name` 같은 원문 값을 보내고 있었음
-   광고 레지스트리는 활성 구현에서 `enableSingleRequest()`와 `collapseEmptyDivs()`를 사용하지 않고 있었음
-   광고 refresh는 “화면에 보이는 상태면 30초마다” 방식이라 실제 viewable impression 기준보다 거칠었음
-   슬롯 타겟팅이 사실상 `site`, `theme`뿐이라 가격 규칙과 수요 분석 세분화가 어려움
-   여러 placement가 몇 개 안 되는 ad unit path를 공유해서 floor/pricing 전략이 뭉개질 가능성이 큼
-   모바일 leg에서 `320x100` + `300x250`를 한 요청에 묶는 슬롯이 많아 가격 하방이 눌릴 가능성이 있음

## 이번에 반영한 변경

-   GA4 helper/sanitize 계층 추가
-   `login_click`, `sign_up_start`로 시도 이벤트 분리
-   검색은 길이만, 파일 다운로드는 타입/확장자만 전송
-   GPT 활성 registry에 `collapseEmptyDivs()` / `enableSingleRequest()` 추가
-   refresh를 `impressionViewable` 이후 60초 타이머로 변경
-   slot-level targeting: `position`, `slot_key`

## 남은 운영 과제

-   Ad Manager UI에서 refresh declaration이 실제 코드와 동일하거나 더 짧게 선언되어 있는지 확인
-   UPR / pricing rule을 최소 `top`, `article`, `infeed`, `sidebar`, `wing` 수준으로 분리
-   request RPM, matched requests, Active View, fill rate, slot별 eCPM을 함께 봐야 원인 분리가 가능함
-   모바일에서 `320x100`과 `300x250`를 같은 요청으로 묶는 자리들은 우선순위별로 분리 검토 필요

---

# ads.damoang.net 시스템 분석

## 시스템 구조

-   **백엔드**: Go/Fiber (Port 9090)
-   **프론트엔드 대시보드**: SvelteKit 5 (Port 5173)
-   **DB**: MySQL + ClickHouse + Redis
-   **배포**: Docker + Nginx

```
damoang-ads/
├── apps/dashboard/     # SvelteKit 5 광고주 대시보드
├── server/             # Go Fiber 백엔드 API
├── nginx/              # Nginx 리버스 프록시
├── deployments/        # Docker Compose
└── scripts/            # 빌드/배포
```

## 배너 Position 시스템 (7개)

| Position                 | 한국어                | 용도                 |
| ------------------------ | --------------------- | -------------------- |
| `board-head`             | 게시판 상단           | 게시판 페이지 최상단 |
| `sidebar`                | 사이드바              | 사이드바 영역        |
| `wing-left`              | 좌측 날개             | 좌측 윙 배너         |
| `wing-right`             | 우측 날개             | 우측 윙 배너         |
| `index-top`              | 메인 상단             | 메인 페이지 상단     |
| `list-inline`            | 목록 인라인           | 게시글 목록 사이     |
| `side-image-text-banner` | 사이드바 이미지텍스트 | 사이드바 4칸 그리드  |

## 배너 상태 워크플로우

```
pending → active (관리자 승인) / rejected (관리자 거부)
active → paused (광고주 일시중지)
```

| 상태       | 설명      |
| ---------- | --------- |
| `pending`  | 승인 대기 |
| `active`   | 게시중    |
| `paused`   | 일시정지  |
| `rejected` | 거부됨    |

## API 엔드포인트

### 공개 (인증 불필요)

```
GET /api/v1/serve/banners?position=board-head&limit=5
```

응답:

```json
{
    "banners": [
        {
            "id": "uuid",
            "imageUrl": "https://...",
            "landingUrl": "https://...",
            "altText": "설명",
            "target": "_blank",
            "trackingId": "uuid"
        }
    ],
    "count": 1
}
```

### 광고주 셀프서비스 (인증 필요)

```
GET    /api/v1/advertisers/:id/banners        # 배너 목록
GET    /api/v1/advertisers/:id/banners/:bid    # 배너 상세
POST   /api/v1/advertisers/:id/banners         # 배너 생성
PUT    /api/v1/advertisers/:id/banners/:bid    # 배너 수정
DELETE /api/v1/advertisers/:id/banners/:bid    # 배너 삭제
```

### 관리자 (Admin 인증 필요)

```
GET /api/v1/admin/banners                      # 전체 배너 목록
GET /api/v1/admin/banners/:id                  # 배너 상세
PUT /api/v1/admin/banners/:id/approve          # 승인
PUT /api/v1/admin/banners/:id/reject           # 거부 (reason 필드)
```

### 광고주 관리 (Admin 전용)

```
POST   /api/v1/admin/advertisers               # 광고주 생성
PUT    /api/v1/admin/advertisers/:id           # 광고주 수정
GET    /api/v1/admin/advertisers               # 광고주 목록
```

## 광고주 셀프서비스 설계 방향

### 인증

-   damoang.net 쿠키 기반 JWT (SSO)
-   광고주 권한: owner, viewer, admin

### 배너 생성 폼

**필수**: name, imageUrl, landingUrl, target
**선택**: altText, position, startDate, endDate, memo

### 광고주 권한

-   배너 제출 → `pending` (관리자 승인 대기)
-   활성 배너 일시정지 → `paused`
-   pending/paused 배너 삭제 가능
-   직접 활성화 불가 (관리자 승인 필요)

### 트래킹

```
ad.js (클라이언트) → aplog.damoang.net → ClickHouse → 대시보드 통계
```

-   Impression: IntersectionObserver (50% 노출)
-   Click: sendBeacon
-   TrackingID (UUID)로 노출/클릭 연관

---

# Frontend Phase 11

## 핵심 발견: 플러그인 시스템이 이미 상당 부분 구현되어 있음

### 이미 존재하는 파일들

| 파일                                                           | 상태    | 설명                                                       |
| -------------------------------------------------------------- | ------- | ---------------------------------------------------------- |
| `apps/web/src/lib/server/plugins/scanner.ts`                   | ✅ 존재 | 플러그인 스캐너                                            |
| `apps/web/src/lib/server/plugins/index.ts`                     | ✅ 존재 | 플러그인 서버 API (activate, deactivate, getActivePlugins) |
| `apps/web/src/lib/server/extensions/scanner.ts`                | ✅ 존재 | 통합 Extension 스캐너                                      |
| `apps/web/src/lib/server/settings/plugin-settings-provider.ts` | ✅ 존재 | 플러그인 설정 Provider                                     |
| `apps/web/src/lib/stores/plugin.svelte.ts`                     | ✅ 존재 | 플러그인 클라이언트 스토어                                 |
| `apps/web/data/plugin-settings.json`                           | ✅ 존재 | 플러그인 설정 저장소                                       |
| `apps/web/src/routes/api/plugins/[id]/+server.ts`              | ✅ 존재 | API 엔드포인트                                             |
| `packages/hook-system/`                                        | ✅ 완성 | Hook 시스템 패키지                                         |
| `packages/types/src/extension.ts`                              | ✅ 존재 | 타입 정의                                                  |

### 결론: Phase 11은 "신규 구현"이 아니라 "검증 및 개선"

기존 코드가 있으므로 작업 방향을 조정해야 함:

1. 기존 scanner, loader, registry 코드의 **동작 검증**
2. 누락된 부분 **보완** (에러 격리, Zod 검증 강화 등)
3. 샘플 플러그인으로 **통합 테스트**

---

## 테마 스캐너 패턴 (복제 기반)

**파일**: `apps/web/src/lib/server/themes/scanner.ts`

핵심 흐름:

```
1. getProjectRoot() — Monorepo 환경 대응
2. THEMES_DIR / CUSTOM_THEMES_DIR 정의
3. isValidThemeDirectory() — theme.json 존재 확인
4. loadThemeManifest() — JSON 파싱 + Zod 검증
5. scanDirectory() — readdirSync → 유효성 → 매니페스트 로드 → Map
6. scanThemes() — 공식 + 커스텀 디렉토리 스캔
```

보안: `sanitizePath()` 경로 검증 (.. / \ / 절대경로 / null byte 차단)

---

## Hook 시스템 구현 상세

**패키지**: `@angple/hook-system`

```typescript
class HookManager {
    addAction(hookName, callback, priority = 10);
    doAction(hookName, ...args);
    addFilter(hookName, callback, priority = 10);
    applyFilters(hookName, value, ...args);
}

export const hooks = new HookManager(); // 글로벌 싱글톤
```

우선순위: 1-9 (보안), 10-49 (일반), 50-99 (후처리)

---

## 플러그인 매니페스트 구조 (extension.json)

```json
{
    "id": "plugin-banner-message",
    "name": "Banner Message System",
    "version": "1.0.0",
    "category": "plugin",
    "pluginType": "custom",
    "main": "./dist/index.js",
    "permissions": ["settings:read", "network:fetch"],
    "hooks": {
        "before_page_render": "./hooks/header-banner.js",
        "post_content": "./hooks/content-banner.js"
    },
    "settings": { ... },
    "active": false
}
```

---

## SSR 데이터 플로우

```
+layout.server.ts → getActivePlugins() → PageData
+layout.svelte → pluginStore.initFromServer(data.activePlugins)
```

---

## Settings 관리

-   테마: `apps/web/data/settings.json` (activeTheme)
-   플러그인: `apps/web/data/plugin-settings.json` (activePlugins[])
-   Lock 메커니즘으로 동시 쓰기 방지

---

## 기존 샘플 플러그인 (6개)

| 플러그인              | 위치        | 설명       |
| --------------------- | ----------- | ---------- |
| sample-extension      | extensions/ | 기본 샘플  |
| plugin-mention        | extensions/ | @멘션 기능 |
| sample-plugin-ai      | extensions/ | AI 연동    |
| plugin-promotion      | extensions/ | 프로모션   |
| plugin-banner-message | extensions/ | 배너 광고  |
| sample-plugin-seo     | extensions/ | SEO        |
