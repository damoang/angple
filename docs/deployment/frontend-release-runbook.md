# Frontend Release Runbook

## 목표

프론트 배포를 항상 같은 절차로 수행해서 `/_app/immutable/*` 404, CSP 차단, 배포 중 흰 화면 장애를 방지한다.

## 운영 원칙

1. `canary -> 검증 -> production` 순서만 사용한다.
2. 이미지와 static asset은 같은 release SHA를 사용한다.
3. mutable `latest`를 운영 기준으로 믿지 않는다.
4. HTML이 참조하는 immutable asset은 항상 `https://static.damoang.net/releases/<sha>/...` 형식이어야 한다.
5. `/_app/immutable/*` 404는 경미한 오류가 아니라 장애로 본다.

## 배포 전 확인

1. GitHub Actions secrets 존재
    - `CLOUDFLARE_R2_ACCESS_KEY_ID`
    - `CLOUDFLARE_R2_SECRET_ACCESS_KEY`
    - `CLOUDFLARE_R2_ACCOUNT_ID`
    - `CLOUDFLARE_R2_BUCKET`
2. `static.damoang.net` 정상 응답
3. canary/prod ingress 및 service 정상
4. backend 주요 API 장애 없음

## 정식 배포 절차

1. 웹을 빌드한다.
2. `apps/web/build/client/_app/immutable/`를 R2 `releases/<sha>/_app/immutable/`로 업로드한다.
3. canary에 같은 `<sha>` 이미지와 `ASSET_BASE_URL=https://static.damoang.net/releases/<sha>`를 배포한다.
4. canary 검증을 통과하면 prod에 같은 `<sha>`를 승격한다.

## 운영 필수 엔드포인트

아래 경로는 단순 정적 파일이 아니라 운영 필수 엔드포인트로 관리한다.

1. `/ads.txt`
2. `/robots.txt`
3. `/manifest.json`
4. `/favicon.ico`

배포 시 이 경로들이 `200` 이 아니면 배포 실패로 본다.

## canary 검증

필수 확인:

1. `https://canary.damoang.net` 또는 내부 NodePort `/` 가 `200`
2. `/ads.txt` 가 `200`
3. `/health` 가 `200`
4. HTML 안에 `https://static.damoang.net/releases/<sha>/_app/immutable/...` 가 보인다
5. HTML이 참조한 JS/CSS URL이 실제로 `200`
6. CSP 헤더에 `https://static.damoang.net` 이 포함된다
7. 브라우저 콘솔에 CSP/CORS 오류가 없다

예시:

```bash
curl -sS http://127.0.0.1:30082/ | tr "\"'" "\n\n\n" | grep 'https://static.damoang.net/releases/.*/_app/immutable' | head
curl -I -sS https://static.damoang.net/releases/<sha>/_app/immutable/bundle.<hash>.js
```

## production 검증

필수 확인:

1. `/`, `/ads.txt`, `/health` 가 `200`
2. HTML이 새 release SHA를 참조한다
3. HTML이 참조한 bundle JS/CSS가 `200`
4. CSP 헤더에 `https://static.damoang.net` 이 포함된다
5. 브라우저 콘솔에 `Failed to fetch dynamically imported module`, CSP 차단, stylesheet 차단이 없다

## 장애 대응

증상:

1. 흰 화면
2. 콘솔에 immutable JS/CSS `404`
3. `Failed to fetch dynamically imported module`
4. `Loading the script/style ... violates Content Security Policy`
5. `/ads.txt` 가 `404` 이거나 AdSense에서 파일을 찾지 못함

즉시 확인:

1. HTML이 어떤 release SHA를 참조하는지 확인
2. 해당 JS/CSS 파일이 R2에 존재하는지 확인
3. CSP 헤더에 `static.damoang.net` 이 들어있는지 확인
4. R2 CORS가 대상 origin을 허용하는지 확인
5. `/ads.txt` 가 root에서 실제 `200` 으로 보이는지 확인

즉시 조치:

1. HTML + 문제 asset URL targeted purge
2. 필요 시 직전 정상 release SHA로 롤백

## 롤백

롤백 원칙:

1. 직전 정상 `<sha>` 를 다시 배포한다
2. old asset은 이미 R2 `releases/<sha>/...` 에 남아 있어야 한다
3. 개별 파일 복구나 pod 내부 복사는 하지 않는다

## 금지 사항

1. 배포 중 임의로 `latest` 태그 재사용
2. pod 시작 시 immutable asset 복사로 문제를 덮는 방식
3. 사용자에게 새 버전 배너/강제 새로고침으로 복구를 맡기는 방식
4. canary 검증 없이 바로 production 반영

## 관련 파일

1. `/home/angple/web/.github/workflows/deploy.yml`
2. `/home/angple/web/apps/web/src/hooks.server.ts`
3. `/home/angple/web/scripts/cloudflare-purge.sh`
4. `/home/angple/k8s/prod/deploy.sh`
5. `/home/angple/web/apps/web/src/routes/ads.txt/+server.ts`
