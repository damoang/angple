# Web Deploy Runbook

## 표준 절차

운영 웹 배포는 아래 순서로만 진행한다.

1. `dev.damoang.net`에서 수정 확인
2. `canary-only` 배포
3. 핵심 시나리오 확인
4. 같은 `sha-*` 아티팩트를 production으로 승격

## 기본 원칙

-   production 직행 배포 금지
-   canary에서 확인한 동일 `sha-*`만 production 승격
-   rollback은 재빌드가 아니라 기존 `sha-*` 재승격으로 처리
-   장애 중에는 개선보다 복구를 우선
-   web immutable 자산은 `https://static.damoang.net/releases/<sha>` 단일 경로만 사용

## dev 확인 항목

-   상세 페이지가 500 없이 열린다
-   `목록으로`가 실제 목록으로 이동한다
-   댓글 목록이 보인다
-   댓글 에디터가 입력 가능하다
-   뒤로가기/재진입이 멈추지 않는다

## canary 확인 항목

-   상세 페이지 500 없음
-   `__data.json` 정상
-   댓글 목록 정상
-   댓글 에디터 정상
-   `목록으로` 정상
-   뒤로가기/재진입 정상
-   blocker 콘솔 에러 없음
    -   `effect_update_depth_exceeded`
    -   `DOMPurify ... sanitize is not a function`
    -   chunk load failure

## production 승인 기준

-   `verify-canary` success
-   핵심 시나리오 확인 완료
-   canary와 production이 같은 `sha-*` 아티팩트임을 확인
-   `ASSET_RELEASE_ID`, `ASSET_BASE_URL`, image tag가 같은 SHA인지 확인
-   CSP가 `https://static.damoang.net`을 허용하는지 확인

## rollback 기준

즉시 rollback:

-   상세 페이지 전반 500
-   댓글/목록/내비게이션 공통 장애
-   canary와 동일 SHA가 production에서 회귀

rollback 시 아래 3개를 같은 SHA로 맞춘다.

-   image
-   `ASSET_RELEASE_ID`
-   `ASSET_BASE_URL`

## 장애 시 purge 원칙

-   current release asset이 200이면 `/_app/immutable/*` 전체 purge 금지
-   먼저 HTML shell만 purge
-   기본 경로: `/`, `/free`, `/hot`, `/best`, `/new`, `/manifest.json`, `/sw.js`
-   상세 제보가 있으면 최근 상세 1건만 추가

## 체크리스트

### dev

-   [ ] 수정이 dev에서 재현/해결 확인됨
-   [ ] 상세 페이지 500 없음
-   [ ] `목록으로` 정상
-   [ ] 댓글 목록 정상
-   [ ] 댓글 에디터 정상
-   [ ] 뒤로가기/재진입 정상

### canary

-   [ ] canary-only 배포
-   [ ] `verify-canary` success
-   [ ] 핵심 시나리오 수동 확인 완료

### production

-   [ ] canary와 same artifact SHA 확인
-   [ ] production gate 승인
-   [ ] `verify-production` success
