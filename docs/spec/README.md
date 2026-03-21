# Spec

이 디렉터리는 `angple` 코어와 private plugin, 외부 운영 시스템 사이의 공식 계약을 정의한다.

원칙:

-   코어는 구현이 아니라 계약을 소유한다.
-   private plugin은 계약의 구현을 소유한다.
-   운영/정산 시스템은 계약의 관측과 집계를 소유한다.

현재 문서:

-   `link-processing-plugin-contract.md`: 코어가 link-processing plugin에 기대하는 추상 계약
-   `link-processing-provider-policy.md`: 코어가 따라야 하는 provider 선택의 일반 정책
-   `service-boundaries.md`: core / premium / ads 책임 경계
-   `affiliate-boundary-violations.md`: 현재 affiliate 구현의 경계 위반 목록
-   `affiliate-migration-plan.md`: affiliate 구조 이관 순서
