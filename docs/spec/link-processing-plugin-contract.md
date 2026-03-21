# Link Processing Plugin Contract

## 목적

이 문서는 `angple` 코어가 외부 link-processing plugin에 기대하는 추상 계약만 정의한다.

이 문서는 공개 코어 문서이므로 아래는 포함하지 않는다.

-   내부 decision 이름
-   내부 상태값
-   내부 사유 코드
-   머천트/네트워크 정책
-   수익화 세부 규칙

이 문서의 역할은 코어의 확장 포인트를 설명하는 것이다.

## 코어의 책임

코어는 아래만 소유한다.

-   plugin hook 호출
-   plugin activation
-   redirect infra
-   공용 observability/event 발행
-   컨텐츠 렌더 경로와 plugin 연결

코어는 아래를 소유하지 않는다.

-   어떤 URL이 처리 대상인지
-   어떤 정책을 쓸지
-   어떤 외부 서비스를 쓸지
-   실패를 어떻게 분류할지

## plugin 입력 계약

코어는 plugin에 “링크 후보와 문맥”을 전달할 수 있어야 한다.

최소 의미 요소:

-   원본 링크 문자열
-   normalize된 내부 판정용 링크
-   링크가 발견된 위치
-   컨텐츠 문맥
    -   게시판
    -   글
    -   댓글
-   direct field 문맥

코어는 입력의 의미만 보장하고, 구체 타입 이름은 plugin 구현에 맡긴다.

## plugin 출력 계약

plugin은 코어에 “처리 결과”를 반환해야 한다.

코어가 알아야 하는 최소 의미는 아래뿐이다.

-   이 링크를 치환할 것인지
-   원본 유지인지
-   외부 노출용 URL이 무엇인지
-   관측 가능한 결과 코드가 무엇인지

코어는 이 결과를 아래 용도로만 사용한다.

-   컨텐츠 치환
-   redirect 연결
-   공용 observability/event 발행

## 코어가 기대하는 결과 성질

1. 결과는 deterministic 해야 한다.
2. 동일 입력이면 동일 정책 판단을 낼 수 있어야 한다.
3. 실패는 관측 가능한 결과를 반환해야 한다.
4. 외부 노출 링크는 코어 redirect와 호환 가능해야 한다.

## 공개 코어 원칙

코어는 plugin의 내부 business object 이름을 문서화하지 않는다.

즉 코어 문서는 아래만 정의한다.

-   입력 의미
-   출력 의미
-   런타임 경계
-   책임 분리

구체 타입, 상태값, 사유 코드는 private implementation 문서가 소유한다.

## 다음 단계

이 계약 문서가 확정되면 다음을 진행한다.

1. premium이 concrete decision spec을 소유한다.
2. 코어 hook contract를 이 추상 계약과 맞춘다.
3. 코어의 직접 구현 import를 줄이고 plugin runtime 호출로 수렴한다.
