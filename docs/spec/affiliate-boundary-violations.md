# Affiliate Boundary Violations

## 목적

이 문서는 현재 affiliate 구현에서 `core / premium / ads` 경계를 위반하는 지점을 기록한다.

이 문서의 목적은 비난이 아니라 정리 순서를 만드는 것이다.

## 현재 범위

현재 affiliate 처리는 아래 입력 경로에서 동작하도록 구현되어 있다.

-   본문
-   댓글
-   `wr_link1`
-   `wr_link2`

즉 “본문 / 댓글 / direct link field” 전체가 대상이다.

## 위반 목록

### 1. 코어가 private plugin concrete 구현을 직접 import

위치:

-   [affiliate.ts](/home/angple/web/apps/web/src/lib/hooks/builtin/affiliate.ts)
-   [affiliate-observability.ts](/home/angple/web/apps/web/src/lib/server/affiliate-observability.ts)

문제:

-   코어가 `$plugins/affiliate-link-private`를 직접 import한다.
-   코어가 concrete 타입과 함수 이름을 알고 있다.

왜 문제인가:

-   코어는 추상 계약만 알아야 한다.
-   private plugin 구현 세부가 코어 문맥에 노출된다.

허용 여부:

-   임시로는 허용 가능
-   장기적으로는 제거 대상

목표 상태:

-   코어는 일반 hook runtime 또는 adapter interface만 호출
-   concrete resolver import 제거

### 2. private 구현이 core repo 안에도 복제돼 있음

위치:

-   [affiliate-link-private](/home/angple/web/plugins/affiliate-link-private)

문제:

-   `premium`에 있어야 할 concrete 구현이 `web` 저장소에도 존재한다.

왜 문제인가:

-   소유권이 흐려진다.
-   공개 코어 저장소에 private business logic이 남는다.
-   나중에 두 구현이 서로 어긋날 수 있다.

허용 여부:

-   임시 개발 단계에서는 허용 가능
-   최종 구조에서는 제거 대상

목표 상태:

-   concrete implementation은 `premium/plugins/affiliate-link-private`만 소유
-   `web`에는 추상 adapter 또는 runtime bridge만 남김

### 3. 코어 runtime이 특정 private plugin id를 하드코딩

위치:

-   [affiliate-plugin-runtime.ts](/home/angple/web/apps/web/src/lib/server/affiliate-plugin-runtime.ts)

문제:

-   `affiliate-link-private` id를 코어가 직접 안다.

왜 문제인가:

-   코어가 특정 private plugin 존재를 전제로 한다.
-   일반화된 link-processing 확장 구조와 충돌한다.

허용 여부:

-   임시 어댑터로는 허용 가능
-   장기적으로는 축소 대상

목표 상태:

-   코어는 capability 또는 hook 존재 여부만 본다.
-   특정 private plugin id 결합을 줄인다.

### 4. observability가 private concrete 타입 이름에 결합

위치:

-   [affiliate-observability.ts](/home/angple/web/apps/web/src/lib/server/affiliate-observability.ts)

문제:

-   코어 observability 계층이 concrete decision 타입을 직접 사용한다.

왜 문제인가:

-   관측 계층도 추상 계약에 붙어야 한다.
-   private decision 모델 변경이 코어 observability 변경으로 이어진다.

허용 여부:

-   임시로는 허용 가능
-   장기적으로는 추상 결과 형태로 축소

목표 상태:

-   observability 입력은 일반화된 result payload
-   concrete decision 타입 import 제거

## 위반이 아닌 것

### 1. route가 builtin affiliate adapter를 호출하는 것

위치:

-   [\[postId]/+page.server.ts](/home/angple/web/apps/web/src/routes/[boardId]/[postId]/+page.server.ts)
-   [comments/+server.ts](/home/angple/web/apps/web/src/routes/api/boards/[boardId]/posts/[postId]/comments/+server.ts)

판정:

-   현재는 허용

이유:

-   route는 코어 adapter를 호출할 뿐
-   private plugin을 직접 import하지 않는다

### 2. ads가 `reason_code`를 저장/집계하는 것

판정:

-   경계 위반 아님

이유:

-   ads는 결과 관측과 집계를 소유한다

## 우선순위

### P1

-   core repo의 concrete private implementation 복제 제거
-   코어의 direct import를 adapter 중심으로 축소

### P2

-   plugin id 하드코딩 제거 또는 capability 기반으로 변경
-   observability payload 일반화

### P3

-   route와 adapter 레이어를 더 명확히 분리

## 현재 결론

현재 가장 큰 문제는 두 가지다.

1. `web/plugins/affiliate-link-private`에 concrete private implementation이 남아 있는 것
2. 코어가 `$plugins/affiliate-link-private`를 직접 import하는 것

즉 3단계의 실질 결론은 이렇다.

-   core는 아직 완전히 추상화되지 않았다
-   premium이 최종 소유자라면 concrete 구현은 premium으로 수렴해야 한다
