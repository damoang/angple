# Service Boundaries

## 목적

이 문서는 `angple core`, `premium`, `ads` 사이의 책임 경계를 정의한다.

목표는 구현보다 먼저 소유권을 고정하는 것이다.

## 원칙

1. 코어는 공개 가능한 추상화만 소유한다.
2. premium은 내부 서비스 로직과 영업비밀 구현을 소유한다.
3. ads는 운영, 집계, 정산 관측을 소유한다.
4. 하나의 기능은 하나의 소유 경계를 가져야 한다.
5. 코어는 premium의 구체 구현 세부를 직접 import하지 않는 방향을 목표로 한다.

## 책임 매트릭스

### angple core

소유:

-   plugin runtime
-   hook contract
-   plugin activation
-   theme / 공개 UI 프레임
-   redirect infra
-   공용 event 발행
-   공용 observability 연결

비소유:

-   내부 정책
-   영업비밀 로직
-   머천트 규칙
-   외부 제휴 네트워크 해석
-   정산 정책

### premium

소유:

-   내부 서비스 plugin
-   business rule
-   private decision model
-   네트워크 API 연동
-   정책 분기
-   fallback 규칙
-   내부 기능 문서

비소유:

-   공개 hook runtime
-   코어 redirect 엔진
-   ads 집계 저장소

### ads

소유:

-   event 수집
-   click/event 저장
-   관리자 통계
-   정산 관측
-   운영 대시보드

비소유:

-   컨텐츠 변환 정책
-   plugin 내부 규칙
-   코어 UI 확장 계약

## 판단 규칙

어떤 기능이 어디에 가야 하는지는 아래 질문으로 판정한다.

### 코어로 가는 조건

-   공개 가능한가
-   다른 설치본에도 유효한가
-   구현보다 추상화가 핵심인가
-   private plugin이 공통으로 재사용할 수 있는가

위 조건에 해당하면 코어가 맞다.

### premium으로 가는 조건

-   다모앙 내부 정책인가
-   운영 노하우나 영업비밀인가
-   네트워크/머천트 규칙인가
-   공개 코어에 넣으면 과도하게 구체적인가

위 조건에 해당하면 premium이 맞다.

### ads로 가는 조건

-   저장/집계/정산/운영 보고인가
-   결과를 장기 보관해야 하는가
-   관리자 화면과 통계가 필요한가

위 조건에 해당하면 ads가 맞다.

## affiliate에 대한 적용

### 코어

-   link-processing hook
-   `/go/<id>` redirect
-   plugin 활성화
-   컨텐츠 렌더 연결
-   event 발행

### premium

-   affiliate 후보 판정
-   내부 decision 모델
-   reason 분류
-   LinkPrice, AliExpress 등 연동
-   fallback 정책

### ads

-   `reason_code` 집계
-   affiliate stats
-   정산 관측

## 금지 패턴

금지:

-   코어가 premium의 구체 타입 이름에 강하게 결합
-   코어가 영업비밀 정책을 문서화
-   ads가 변환 정책을 직접 판단
-   premium이 코어 redirect 구현 세부에 의존

## 허용 패턴

허용:

-   코어가 추상 hook 계약만 정의
-   premium이 concrete 모델을 구현
-   ads가 결과 event를 저장/집계

## 현재 기준 결론

-   `AffiliateDecision` concrete spec: premium 소유
-   link-processing 추상 계약: core 소유
-   `reason_code` 통계: ads 소유

## 다음 단계

이 경계 문서가 확정되면 다음을 진행한다.

1. 실제 코드에서 경계를 위반하는 import/의존을 목록화
2. 코어가 premium concrete 구현을 직접 아는 부분을 줄임
3. ads event schema를 premium decision 결과와 정렬
