# Affiliate Migration Plan

## 목적

이 문서는 affiliate 기능을 현재 임시 구조에서 목표 구조로 옮기는 순서를 정의한다.

목표 구조:

-   `angple core`
    -   추상 hook contract
    -   plugin runtime
    -   redirect infra
    -   공용 event 발행
-   `premium`
    -   concrete affiliate implementation
    -   private decision model
    -   business rule
-   `ads`
    -   event 저장
    -   `reason_code` 집계
    -   관리자 통계

## 현재 범위

이관 대상 처리 경로:

-   본문
-   댓글
-   `wr_link1`
-   `wr_link2`

즉 컨텐츠 본문과 direct link field 전체를 같은 구조로 옮겨야 한다.

## 원칙

1. 동작 범위를 줄이지 않는다.
2. 본문, 댓글, direct field 중 어느 하나도 누락시키지 않는다.
3. 코어는 추상화만 남기고, concrete 구현은 premium으로 수렴한다.
4. ads 집계는 마지막에 끊기지 않게 유지한다.
5. 한 번에 전부 바꾸지 않고 adapter를 두고 점진적으로 옮긴다.

## 단계

### 단계 1. premium을 단일 concrete 소유자로 고정

목표:

-   concrete affiliate 구현의 최종 소유자는 `premium`임을 코드 기준으로 확정

작업:

-   `premium/plugins/affiliate-link-private`를 기준 구현으로 삼는다
-   `web/plugins/affiliate-link-private`는 복제본으로 더 키우지 않는다
-   필요 시 `web` 쪽 복제본은 bridge 또는 임시 adapter로만 취급한다

완료 조건:

-   새 concrete 로직은 `premium`에만 추가된다
-   문서와 구현 위치가 일치한다

### 단계 2. core adapter 계층을 명시적으로 만든다

목표:

-   코어가 concrete plugin 구현을 직접 import하지 않게 만드는 중간 계층 확보

작업:

-   `apps/web/src/lib/server/link-processing` 같은 adapter 계층 정의
-   route는 adapter만 호출
-   adapter는 runtime/hook/plugin 호출을 캡슐화

완료 조건:

-   route가 private plugin 구현 경로를 모른다
-   코어 호출점이 한 군데로 수렴한다

### 단계 3. 본문/댓글/direct field 흐름을 adapter로 통합

목표:

-   본문, 댓글, `wr_link1`, `wr_link2`가 같은 adapter 구조를 탄다

작업:

-   본문 변환
-   댓글 변환
-   post `link1/link2`
-   comment `link1/link2`

완료 조건:

-   네 경로가 모두 같은 코어 adapter를 사용한다
-   개별 route 파일에 사설 변환 규칙이 남지 않는다

### 단계 4. observability를 추상 payload로 일반화

목표:

-   코어 observability가 concrete private 타입에 결합되지 않도록 정리

작업:

-   코어 observability 입력을 일반화된 result payload로 축소
-   private 타입 import 제거

완료 조건:

-   코어 로그/이벤트 계층이 private type 이름을 직접 알지 않는다

### 단계 5. plugin id 하드코딩 축소

목표:

-   코어가 특정 private plugin id를 직접 아는 구조를 줄임

작업:

-   capability 또는 hook 존재 기반 판별로 이동
-   임시로는 adapter 내부에만 한정

완료 조건:

-   id 결합이 route/코어 전역에 퍼지지 않는다

### 단계 6. ads event schema 정렬

목표:

-   premium 결과와 ads 저장 구조를 일관되게 유지

작업:

-   `reason_code`
-   `network`
-   `source`
-   컨텐츠 문맥

완료 조건:

-   ads가 `reason_code` 기준으로 집계 가능
-   코어와 ads 사이 event contract가 안정화

### 단계 7. core repo의 concrete 복제 제거

목표:

-   최종적으로 `web/plugins/affiliate-link-private`의 concrete 구현 제거

작업:

-   남은 bridge만 유지하거나 완전히 제거
-   코어에는 추상 계약과 adapter만 남김

완료 조건:

-   concrete affiliate business logic은 `premium`에만 존재

## 권장 순서

권장 실행 순서:

1. 문서 확정
2. adapter 계층 도입
3. 본문/댓글/direct field 호출 통합
4. observability 일반화
5. ads contract 정렬
6. 마지막에 concrete 복제 제거

## 하지 말아야 할 순서

비권장:

-   먼저 복제본부터 삭제
-   route에서 직접 premium 구현을 계속 import한 채 문서만 정리
-   ads event schema보다 먼저 결과 코드를 바꿔 집계 단절 만들기

## 각 단계의 테스트 관점

매 단계마다 아래를 확인한다.

### 본문

-   일반 링크
-   plain text URL
-   스키마 없는 URL

### 댓글

-   일반 링크
-   plain text URL
-   스키마 없는 URL

### direct field

-   `wr_link1`
-   `wr_link2`

### 결과

-   원본 유지
-   redirect 링크 생성
-   실패 사유 관측

## 현재 기준의 다음 구현 순서

지금 바로 들어갈 다음 구현은 아래가 맞다.

1. 코어 adapter 계층 이름과 위치를 확정
2. `affiliate.ts`를 그 adapter의 첫 진입점으로 축소
3. route는 adapter만 사용하게 유지
4. 그 다음에 `web/plugins/affiliate-link-private` 복제 제거 준비
