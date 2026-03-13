# 프론트엔드 404 캐시 장애 대응

## 현상

- 브라우저 콘솔에서 `/_app/immutable/bundle.*.js` 또는 `entry/app.*.js` 가 `404` 로 실패한다.
- 화면이 하얗게 보이거나 레이아웃이 깨진다.
- 사용자에게 "새 버전이 배포되었습니다" 배너가 반복 노출된다.

예시:

```text
GET https://damoang.net/_app/immutable/bundle.CcgrH9TJ.js net::ERR_ABORTED 404
Uncaught (in promise) TypeError: Failed to fetch dynamically imported module
```

## 1차 확인

문제 번들 URL을 직접 확인한다.

```bash
curl -I -s https://damoang.net/_app/immutable/bundle.CcgrH9TJ.js
```

아래 조건이면 Cloudflare가 오래된 `404` 를 캐시 중일 가능성이 높다.

- `cf-cache-status: HIT`
- `age: 0` 보다 큰 값
- 상태 코드가 `404`

## 원인

배포 전환 중 아주 짧은 시점에 HTML이 새 번들을 참조했는데, 해당 파일이 아직 원본에 없어서 `404` 가 발생할 수 있다.

이 `404` 응답을 Cloudflare가 캐시하면, 이후 원본에 파일이 생겨도 CDN이 계속 `404` 를 반환할 수 있다.

즉 문제는 "원본 파일 없음"이 아니라 "CDN이 오래된 404를 계속 서빙"하는 경우가 많다.

## 긴급 조치

HTML과 문제 번들을 핀셋 purge 한다.

대상 예시:

- `https://damoang.net/free`
- `https://damoang.net/_app/immutable/bundle.CcgrH9TJ.js`

Cloudflare API 예시:

```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/purge_cache" \
  -H "Authorization: Bearer <API_TOKEN>" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://damoang.net/free","https://damoang.net/_app/immutable/bundle.CcgrH9TJ.js"]}'
```

또는 대시보드에서 `Custom Purge` 로 동일 URL을 purge 한다.

## 운영 체크리스트

1. 공개 도메인 HTML이 어떤 bundle명을 참조하는지 확인
2. 해당 bundle URL이 `200` 인지 확인
3. `404 HIT` 이면 HTML + bundle URL 핀셋 purge
4. 새 탭/프라이빗탭에서 재확인

## 재발 방지

- `/_app/immutable/*` 의 `200` 응답은 장기 캐시 유지
- `/_app/immutable/*` 의 `404` 응답은 Cloudflare에서 캐시하지 않도록 규칙 적용
- HTML(`/`, `/free`) 은 짧게 캐시하거나 배포 직후 핀셋 purge
- 배포 후 origin smoke test로 HTML이 참조한 bundle `200` 확인

## 적용 완료 사항

2026-03-12 기준 Cloudflare `http_request_cache_settings` ruleset에 아래 규칙을 추가했다.

- 경로: `/_app/immutable/*`
- 동작: `set_cache_settings`
- 정책:
  - 일반 응답: origin cache control 존중
  - `404`: 캐시하지 않음

규칙 목적:

- 배포 전환 중 잠깐 발생한 immutable `404` 가 CDN에 `HIT` 로 오래 남는 문제 방지
- 이후 원본에 파일이 생겼을 때 CDN이 오래된 `404` 를 계속 반환하지 않도록 함

## 관련 구성

- 배포 스크립트: `/home/angple/k8s/prod/deploy.sh`
- 프론트 스모크 테스트: `/home/ec2-user/angple/scripts/smoke-test.sh`
- Cloudflare purge: `/home/ec2-user/angple/scripts/cloudflare-purge.sh`
