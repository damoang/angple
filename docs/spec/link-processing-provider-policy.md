# Link Processing Provider Policy

## 목적

이 문서는 공개 코어가 link-processing provider를 선택할 때 따라야 하는 일반 정책을 정의한다.

이 문서는 구현 우선순위나 개별 제휴사 계약값을 공개하지 않는다.

## 원칙

1. 코어는 provider 선택 규칙의 틀만 소유한다.
2. concrete provider 우선순위는 private implementation이 소유한다.
3. 코어는 단일 provider에 강결합하지 않는다.
4. 같은 URL 후보라도 runtime 환경과 정책에 따라 다른 provider가 선택될 수 있다.

## 기본 선택 규칙

1. 직접 merchant API 또는 공식 affiliate API가 있으면 우선 고려한다.
2. 직접 API가 없으면 네트워크형 affiliate provider를 고려한다.
3. 둘 다 없으면 passthrough 또는 unsupported로 처리한다.
4. 이미 affiliate 링크면 중복 변환하지 않는다.

## 코어가 알아야 하는 최소 사실

-   provider는 여러 개일 수 있다.
-   provider는 우선순위를 가질 수 있다.
-   provider 선택은 환경값, merchant 상태, 정책 상태에 영향을 받는다.
-   실패는 `denied`, `error`, `unsupported`, `passthrough` 중 하나로 귀결돼야 한다.

## 코어가 몰라야 하는 것

-   개별 제휴사별 내부 우선순위
-   내부 수익 최적화 규칙
-   비공개 merchant allowlist 또는 denylist
-   내부 정산 기준

## adapter 기대사항

코어 adapter는 private provider 구현에 대해 아래만 기대한다.

-   URL 후보를 넣을 수 있다.
-   처리 결과를 구조화된 outcome으로 돌려받는다.
-   실패 이유를 관측 가능하게 남길 수 있다.

## fallback 원칙

-   direct API 실패가 항상 network fallback으로 이어지지는 않는다.
-   `merchant_denied`는 재시도보다 정책 판단이 우선이다.
-   `env_missing`은 운영 설정 문제로 분류한다.
-   `api_error`는 일시 오류로 분류할 수 있다.

## 구현 책임

-   공개 코어:

    -   추상 계약
    -   provider adapter
    -   redirect infra
    -   공용 observability hook

-   private implementation:
    -   concrete provider ordering
    -   merchant routing
    -   API 자격증명 요구사항
    -   fallback 정책
