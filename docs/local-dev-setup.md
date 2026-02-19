# Angple 로컬 개발 환경 셋업 가이드

## 필수 도구

| 도구           | 최소 버전 | 설치                                              |
| -------------- | --------- | ------------------------------------------------- |
| Docker Desktop | 4.x       | [docker.com](https://docs.docker.com/get-docker/) |
| Node.js        | 22+ (LTS) | [nodejs.org](https://nodejs.org/)                 |
| pnpm           | 9+        | `npm install -g pnpm`                             |
| Git            | 2.x       | OS 기본 설치                                      |

## 빠른 시작 (5분)

### 1. 레포지토리 클론

```bash
# 메인 레포
git clone git@github.com:angple/angple.git
cd angple

# (선택) 백엔드 레포 — API 연동 테스트 시 필요
git clone git@github.com:angple/angple-backend.git ../angple-backend

# (선택) 프리미엄 에셋 — 다모앙 테마/플러그인
git clone git@github.com:angple/angple-premium.git ../angple-premium
```

### 2. 원커맨드 환경 시작

```bash
./scripts/local-up.sh
```

이 스크립트가 자동으로:

-   `.env.example` → `.env.local` 복사 (없는 경우)
-   Docker로 MySQL, Redis 시작
-   angple-backend가 있으면 API 서버도 시작
-   angple-premium이 있으면 에셋 자동 설치
-   `pnpm install` 실행

### 3. 프론트엔드 시작

```bash
pnpm dev
```

브라우저에서 http://localhost:3010 접속.

## 서비스 포트

| 서비스          | URL                   | 비고                                      |
| --------------- | --------------------- | ----------------------------------------- |
| Web (SvelteKit) | http://localhost:3010 | `pnpm dev`                                |
| Backend API     | http://localhost:8081 | Docker 또는 로컬 Go                       |
| MySQL           | localhost:3306        | user: `angple_user` / pass: `angple_pass` |
| Redis           | localhost:6379        | -                                         |

## 디렉토리 구조

```
~/projects/
  angple/              ← 메인 프론트엔드 (이 레포)
  angple-backend/      ← Go 백엔드 API (선택)
  angple-premium/      ← 프리미엄 에셋 (선택, 비공개)
```

## 환경 변수

환경 변수 파일은 `.env.example`을 참고하세요:

-   **루트** `.env.local` — Docker Compose, 공통 설정
-   **apps/web** `.env.local` — Vite/SvelteKit 전용 설정

주요 변수:

| 변수               | 기본값                         | 설명                           |
| ------------------ | ------------------------------ | ------------------------------ |
| `VITE_API_URL`     | `http://localhost:8081/api/v2` | 클라이언트 API URL             |
| `INTERNAL_API_URL` | `http://localhost:8081/api/v2` | SSR 서버 API URL               |
| `VITE_USE_MOCK`    | `false`                        | Mock 모드 (백엔드 없이 테스트) |
| `DB_HOST`          | `localhost`                    | MySQL 호스트                   |
| `DB_USER`          | `angple_user`                  | MySQL 사용자                   |
| `DB_PASSWORD`      | `angple_pass`                  | MySQL 비밀번호                 |

## 유용한 명령어

```bash
# 인프라 로그 확인
docker compose -f compose.local.yml logs -f

# 인프라 종료
docker compose -f compose.local.yml down

# 데이터 완전 초기화 (MySQL/Redis 데이터 삭제)
docker compose -f compose.local.yml down -v

# 빌드 확인
pnpm build

# 타입 체크
pnpm check

# 린트
pnpm lint

# 테스트
pnpm test:unit
```

## 트러블슈팅

### 포트 충돌

기존에 MySQL이나 Redis가 실행 중이면 포트 충돌이 발생합니다:

```bash
# 사용 중인 포트 확인
lsof -i :3306
lsof -i :6379

# 기존 서비스 중지 후 재시작
docker compose -f compose.local.yml down
docker compose -f compose.local.yml up -d
```

### Docker 빌드 실패

```bash
# 캐시 없이 재빌드
docker compose -f compose.local.yml build --no-cache

# 볼륨 초기화
docker compose -f compose.local.yml down -v
```

### pnpm install 오류

```bash
# node_modules 삭제 후 재설치
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
```

### Mock 모드로 백엔드 없이 개발

백엔드 API 없이 프론트엔드만 개발하려면:

```bash
# apps/web/.env.local에서 설정
VITE_USE_MOCK=true
```

## Git 워크플로우

```bash
# 1. 새 브랜치 생성
./scripts/new-branch.sh fix/작업명

# 2. 코드 수정 + 확인

# 3. 커밋 & PR 생성
git add -A && git commit -m "feat: 기능 설명"
git push origin fix/작업명
gh pr create

# 4. PR 머지 후 브랜치 정리
./scripts/finish-branch.sh
```
