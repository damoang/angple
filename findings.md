# Findings

## 2026-03-20 — PC 전용 position 분리

### 실제 판단

-   PC 수익 회복 1차에서 기존 position을 재사용해 확장했지만, 운영에서 desktop floor를 모바일/기존 슬롯과 완전히 분리하려면 전용 position이 필요함
-   최소 분리 단위는 아래 두 개면 충분함
    -   `board-view-top-desktop`
    -   `sidebar-sticky-desktop`
-   이 둘은 모두 PC에서만 렌더되는 강한 슬롯이라 floor, rule, 리포트 분리 효과가 큼

### 이번 수정

-   `board-view-top-desktop` position 추가
-   `sidebar-sticky-desktop` position 추가
-   게시글 상세 상단 데스크톱 슬롯은 신규 position으로 전환
-   패널 sticky 슬롯도 신규 position으로 전환

### 운영 반영 필요

-   GAM `position` key에 아래 값 추가
    -   `board-view-top-desktop`
    -   `sidebar-sticky-desktop`
-   기존 rule과 별도로 desktop high value rule을 이 두 값 기준으로 분리 가능

---

## 2026-03-20 — PC GAM 회복 1차 하드닝

### 실제 판단

-   모바일이 잘 나오는데 PC만 약한 가장 큰 이유는 데스크톱 전용 강한 슬롯이 너무 좁은 조건에 묶여 있기 때문임
-   `board-view-top`은 기존에 `economy`, `used-market`에서만 렌더되어 일반 게시판 상세에서는 PC 상단 고가 슬롯이 사실상 비어 있었음
-   `sidebar-sticky`는 `300x600`만 고집하면 데스크톱 fill이 쉽게 약해질 수 있음
-   따라서 PC 회복 1차는 “신규 position 추가”보다 “기존 고가 position을 더 넓게, 더 잘 채우게” 만드는 것이 맞음

### 이번 수정

-   `board-view-top`을 데스크톱(`lg` 이상)에서는 일반 게시판 상세에도 표시되도록 확대
-   `sidebar-sticky`의 `banner-halfpage`를 `300x600` 우선, 불가 시 `300x250` fallback 구조로 변경
-   현재 `ad-slot.svelte`의 빈 슬롯 높이 접기와 합치면, PC에서는
    -   상단 슬롯 기회 증가
    -   사이드 고정 슬롯 fill 완화
    -   빈 슬롯 공백 체감 축소
    로 이어지는 구조가 됨

### 설계 판단

-   이 3개는 모두 기존 `position`을 재사용하므로 우선 GAM 신규 key 추가 없이 적용 가능
-   다만 추후 PC 전용 floor를 더 정교하게 쪼개려면 `board-view-top-desktop`, `header-after-desktop` 같은 신규 position 분리가 필요할 수 있음

---

## 2026-03-19 — 데스크톱 빈광고 체감 완화

### 실제 판단

-   현재 GPT `collapseEmptyDivs()`는 켜져 있지만, `AdSlot` 상위 컨테이너가 별도로 `min-height`를 계속 예약하고 있어 빈 응답 뒤에도 큰 공백 박스가 남을 수 있었음
-   이 문제는 특히 데스크톱에서 `728x90`, `970x250`, `160x600` 같은 큰 슬롯에서 체감이 크게 나타남
-   즉 빈광고 체감은 단순 fill 문제뿐 아니라 컴포넌트 예약 높이 유지 문제도 함께 있었음

### 이번 수정

-   `ad-slot.svelte`에서 슬롯 render 완료 후 `isEmpty`인 경우 컨테이너와 내부 슬롯의 `min-height`를 `0`으로 접도록 변경
-   빈 슬롯은 테두리/배경도 제거해 “큰 빈 박스”가 남지 않게 조정

### 설계 판단

-   수익 자체는 운영/GAM 문제로 풀어야 하지만, 빈 슬롯이 크게 남는 UX 문제는 코드에서 바로 줄이는 것이 맞음
-   이 수정은 fill을 높이진 않지만, 빈응답이 많은 구간에서 데스크톱 체감 품질을 빠르게 개선함

---

## 2026-03-19 — dev `/explore` 미반영, 윙 회귀, 홈 광고 공백 원인

### 실제 판단

-   `/explore`, `/empathy` GAM 추가 코드는 `main`에는 들어가 있지만, `dev.damoang.net/explore`에서 변화가 없다는 제보상 dev 배포 반영 여부를 먼저 확인해야 함
-   데스크톱 윙은 “화면 끝 최소 24px 여백” 방식보다 기존 `calc(50% + 696px)` 좌표가 더 안정적이었다는 사용자 피드백이 있었고, 현재 3열 레이아웃에서는 새 계산식이 본문과 겹칠 수 있음
-   따라서 윙은 최신 좌표 보정보다 기존 안정 좌표로 복구하는 편이 현재 구조에서 안전함
-   홈 광고가 전혀 안 보이는 문제는 코드 부재보다는 GAM 운영 key-value 누락 가능성이 큼
-   홈에는 이미 다음 position이 코드에 존재함:
    -   `index-top`
    -   `index-middle-1`
    -   `index-middle-2`
    -   `index-bottom`
-   그러나 운영에서 추가한 `position` 값 목록에는 위 `index-*`가 빠져 있었으므로 홈 슬롯이 제대로 타겟팅/분석되지 않았을 가능성이 높음

### 이번 정리

-   `default-layout.svelte`의 윙 좌표를 기존 안정 좌표로 복구
-   운영 반영 필요값으로 홈 `position` 4개를 명시
    -   `index-top`
    -   `index-middle-1`
    -   `index-middle-2`
    -   `index-bottom`

### 설계 판단

-   윙은 “더 바깥으로 밀기”보다 “충분한 폭에서만 기존 안정 좌표 유지”가 현재 레이아웃에 맞음
-   홈 광고는 코드 추가보다 운영 key-value 정합성 보완이 먼저임
-   `/explore`, `/empathy`는 코드 추가가 이미 끝났으므로 dev/prod 배포 반영 여부 확인이 우선임

---

## 2026-03-19 — 데스크톱 노출 약화 및 `/explore`, `/empathy` GAM 공백

### 실제 확인 결과

-   현재 `/explore`와 `/empathy`에는 `AdSlot`이 전혀 없어 GAM 수익화 공백이 있었음
-   데스크톱 광고가 약하게 체감되는 이유는 단순 fill 문제만이 아니라, 현재 데스크톱 placement 자체가 강한 조건에 묶여 있기 때문임
-   `board-view-top`은 특정 보드(`economy`, `used-market`)에서만 렌더됨
-   `sidebar-sticky`는 `Panel`이 보이는 데스크톱 레이아웃에서만 렌더됨
-   `wing-left`, `wing-right`는 `min-[1600px]` 이상에서만 렌더됨
-   즉 일반 데스크톱 폭과 일반 게시판 동선에서는 데스크톱 광고가 적게 보이는 것이 구조적으로 설명됨

### 이번 수정

-   `/explore`에 전용 GAM 슬롯 2개 추가
    -   `explore-top`
    -   `explore-bottom`
-   `/empathy`에 전용 GAM 슬롯 2개 추가
    -   `empathy-top`
    -   `empathy-bottom`
-   `POSITION_MAP`에 위 4개 position을 추가해 기존 unit 체계 안에서 서빙되도록 정리
-   `explore-bottom`, `empathy-bottom`은 below-the-fold 취급으로 intrinsic size 예약 적용
-   GA4 page context도 `/explore` → `explore`, `/empathy*` → `empathy`로 분리해 이후 분석 축을 `other`에서 빼냄
-   데스크톱 윙 배너는 `1600px` 이상 조건 외에도 위치 계산이 너무 공격적이라 실제로 화면 밖으로 밀릴 수 있었음
-   `default-layout.svelte`에서 윙 위치를 구 테마의 `1200px 본문 + 180px 여백` 감각에 가깝게 보정하고, 화면 끝에는 최소 `24px` 여백을 남기도록 수정함

### 설계 판단

-   지금 시점에는 desktop 수익 회복을 위해 상단 1개 + 하단 1개 수준의 보수적 추가가 맞음
-   기존 게시판/본문 placement는 그대로 두고, 수익화 공백 페이지부터 메우는 것이 원인 분리에 유리함
-   `/explore`, `/empathy`는 큐레이션 성격이 강해 전용 position으로 분리하는 편이 `board-*` position 재사용보다 설계상 깔끔함

---

# 2026-03-18 — CPM 회복 작업 메모

## 현재 가장 중요한 판단

-   페이지 수가 많아도 CPM이 `$0.03`이면 문제는 트래픽 절대량보다 `인벤토리 품질`, `slot 분리`, `pricing rule`, `viewability`, `문맥 신호 부족` 쪽일 가능성이 높음
-   오늘 한 GA4 작업은 직접 단가를 올리는 버튼은 아니지만, 어떤 페이지/행동/유저가 더 가치 있는지 덜 왜곡해서 보게 해주므로 수익 개선의 기초 데이터 품질을 올려줌
-   지금 코어 웹 바이탈은 사실상 `CLS 0.13` 하나가 실패 원인이고, `LCP / INP / TTFB`는 크게 문제되지 않음

## main 재점검 결과

-   로그인 클릭 이벤트는 `login_click`으로 정리됨
-   가입 시작 이벤트는 `sign_up_start`로 정리됨
-   검색은 helper를 통해 길이 기반으로 전송되도록 정리됨
-   파일 다운로드는 파일명 원문 대신 helper 기반 타입/확장자 전송으로 정리됨
-   게시글 조회는 제목 원문 없이 helper 기반으로 정리됨
-   스크롤 깊이 측정은 공통 observer helper로 정리됨

## 광고/배너 정합성 재점검 결과

-   GAM 기본 refresh interval은 코드상 30초로 맞춰졌음
-   다만 실제 운영은 `VITE_GAM_AD_REFRESH_INTERVAL`와 Ad Manager refresh declaration이 동일해야 함
-   축하/롤링 배너 회전은 기존 5초였고, 이번에 30초로 맞춤
-   광고 슬롯의 BTF intrinsic size 예약은 기존 고정값보다 실제 reserved height를 따르도록 보강함
-   배너 루트 컨테이너에도 최소 높이를 먼저 부여해 CLS 방어를 강화함

## 저 CPM의 가능성 높은 구조적 원인

-   저가 placement가 너무 많이 살아 있을 수 있음
-   모바일에서 낮은 가치 사이즈 조합이 같은 슬롯에서 경쟁할 수 있음
-   여러 placement가 같은 ad unit path를 공유하면 floor 전략이 뭉개짐
-   request는 많아도 Active View가 낮으면 CPM이 계속 눌릴 수 있음
-   `page_type`, `position`, `board_id`는 들어가도 운영에서 pricing rule을 안 쪼개면 효과가 제한적임

## 우선 조사해야 할 운영 질문

-   어떤 위치가 가장 낮은 eCPM을 만드는가
-   어떤 위치가 fill은 높지만 viewability가 낮은가
-   어떤 위치가 refresh inventory로만 유지되고 있는가
-   어떤 보드/페이지군이 광고 단가를 끌어내리는가
-   모바일 `320x100`과 `300x250`를 섞는 위치가 어디인가

## GA4로 직접 할 수 있는 것

-   페이지/이벤트/전환 성과 조회
-   로그인/가입/검색/댓글/공유/다운로드 같은 행동 세그먼트 분석
-   게시판별/디바이스별/유입원별 가치 비교
-   광고 성과와 함께 볼 행동 신호 후보 정의

## MCP 관련 메모

-   user가 `googleanalytics/google-analytics-mcp` 사용 준비를 했고, Google Cloud에서 관련 API 2개를 활성화했다고 전달함
-   user가 제공한 실제 접근 정보:
    -   property ID: `434290661`
    -   service account: `sheets-bot@damoang.iam.gserviceaccount.com`
-   로컬에서 확인된 서비스 계정 키 후보:
    -   `/home/angple/.claude/google-sheets-sa.json`
    -   `/home/angple/.google_sheets_sa.json`
-   예상 활용 범위:
    -   property / account 조회
    -   custom dimensions / metrics 조회
    -   일반 report / realtime report 실행
    -   Google Ads 링크 상태 확인
-   MCP는 태깅 수정 도구가 아니라 `읽기/분석` 중심 도구로 보는 것이 맞음

## 2026-03-18 실측 API 확인 결과

-   서비스 계정 키로 Google Analytics Data API / Admin API 호출 성공
-   property `434290661`에 대해 `runReport`와 custom definitions 조회가 실제로 동작함

### 최근 7일 상위 페이지 경로

-   `/free`: `4,949,654` page views
-   `/`: `3,893,512` page views
-   `/economy`: `141,347` page views
-   `/car`: `88,420` page views
-   `/my`: `87,035` page views
-   `/new`: `59,947` page views
-   `/search`: `43,127` page views
-   `/login`: `38,599` page views

### 최근 7일 상위 이벤트

-   `page_view`: `18,835,550`
-   `ad_impression`: `9,532,357`
-   `user_engagement`: `2,075,784`
-   `session_start`: `883,860`
-   `scroll`: `472,380`
-   `click`: `134,563`
-   `ad_click`: `6,777`
-   `file_download`: `75`

### 최근 7일 디바이스 비중

-   `mobile`: `12,479,473` page views / `217,045` active users / `639,047` sessions
-   `desktop`: `5,997,745` page views / `64,088` active users / `226,353` sessions
-   `tablet`: `358,200` page views / `20,426` active users / `30,019` sessions

### 즉시 해석

-   광고 수익 최적화는 모바일 중심으로 봐야 함. 모바일 비중이 압도적임
-   `/free`와 홈(`/`)이 절대적인 트래픽 중심이므로, 수익 개선 우선순위도 목록/홈 placement가 가장 높음
-   `/search`, `/login`, `/my`처럼 트래픽은 있지만 광고 가치가 낮거나 광고 밀도를 높이기 어려운 경로가 많으면 전체 평균 CPM을 누를 수 있음
-   `ad_impression` 이벤트는 충분히 쌓이고 있어 측정 자체는 가능함
-   그러나 GA4 `customDimensions`, `customMetrics`가 비어 있어 `page_type`, `board_id`, `position`, `slot_key` 같은 값은 보고서에서 제대로 활용하지 못하고 있을 가능성이 높음

### 바로 필요한 후속

-   GA4 custom definitions 등록 여부 확인 및 필요 시 생성
-   `page_type`, `board_id`, `position`, `slot_key`를 리포트 가능하게 만들기
-   모바일 중심 슬롯 분석부터 시작
-   `/free`, `/`, `/economy` 관련 슬롯을 최우선 대상으로 수익 구조 재설계

## 2026-03-18 custom dimensions 생성 완료

-   서비스 계정 `sheets-bot@damoang.iam.gserviceaccount.com`에 property `434290661` Editor 권한 부여 후 Admin API로 생성 성공
-   생성한 EVENT-scoped custom dimensions:
    -   `page_type`
    -   `board_id`
    -   `position`
    -   `slot_key`

### 생성 결과

-   `page_type` → `properties/434290661/customDimensions/13958842341`
-   `board_id` → `properties/434290661/customDimensions/13958289954`
-   `position` → `properties/434290661/customDimensions/13957169055`
-   `slot_key` → `properties/434290661/customDimensions/13954154315`

### 해석

-   이제 GA4 보고서에서 페이지 문맥과 광고 placement 문맥을 쪼개서 볼 준비가 됨
-   다만 custom definitions는 생성 직후 바로 전체 리포트에 완전히 반영되지 않을 수 있으므로 전파 시간 고려 필요
-   이후 보고서에서 사용할 차원 이름은 일반적으로 event-scoped custom dimension 네이밍 규칙에 맞춰 확인이 필요함

## 다음 문서화 대상

-   슬롯별 유지/삭제/분리안
-   GAM floor / pricing rule 설계안
-   GA4 + GAM 합동 진단표
-   CLS 후속 조사 항목


# 2026-03-18 — GA4 문맥 신호 후속 점검

## 실제 확인된 병목

-   GA4 property `434290661`에 custom dimensions 4개를 만들었지만 보고서 값이 비어 있었음
-   원인은 custom definition이 아니라 이벤트 payload 누락이었음
-   `page_view`는 `page_path`만 보내고 있었고 `page_type`, `board_id`는 보내지 않았음
-   `ad_impression`은 `slot_id`, `is_empty`만 보내고 있었고 `slot_key`, `position`, `page_type`, `board_id`는 보내지 않았음
-   최근 7일 광고 노출은 `/free`, `/`와 모바일 트래픽에 집중됨

## 해석

-   저 CPM 원인을 위치 단위로 분해하려면 `page_type + board_id + position + slot_key`가 함께 들어가야 함
-   오늘 만든 custom dimensions는 맞는 설계였고, 이번 후속 패치는 실제 payload를 그 설계에 맞추는 작업임

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
