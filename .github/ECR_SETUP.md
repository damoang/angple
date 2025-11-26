# ECR 배포 설정 가이드

이 문서는 GitHub Actions를 통해 AWS ECR에 Docker 이미지를 자동으로 빌드하고 푸시하는 설정 방법을 설명합니다.

## 개선 사항 (yakkle 피드백 반영)

- ECR 직접 배포 방식 사용 (GHCR 미러링 제거)
- `environment: production` 사용
- Discord 웹훅 알림 기능 추가
- ECR 레지스트리 캐시 활용으로 빌드 속도 향상
- 성공/실패 상황별 Discord 알림 분리

## 사전 준비 사항

### 1. AWS ECR 리포지토리 생성

AWS 콘솔 또는 CLI로 ECR 리포지토리를 생성합니다:

```bash
# AWS CLI 사용
aws ecr create-repository \
  --repository-name angple-web \
  --region ap-northeast-2 \
  --image-scanning-configuration scanOnPush=true

aws ecr create-repository \
  --repository-name angple-admin \
  --region ap-northeast-2 \
  --image-scanning-configuration scanOnPush=true
```

**AWS 콘솔 사용:**
1. ECR 서비스로 이동
2. "리포지토리 생성" 클릭
3. 리포지토리 이름: `angple-web`, `angple-admin`
4. 리전: `ap-northeast-2` (서울)
5. "푸시 시 스캔" 활성화 (권장)

### 2. IAM 사용자 생성 및 권한 설정

**필요한 IAM 정책:**

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRPushPull",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload"
      ],
      "Resource": "*"
    }
  ]
}
```

**또는 AWS 관리형 정책 사용:**
- `AmazonEC2ContainerRegistryPowerUser`

### 3. GitHub Repository 설정

#### 3.1 Environment 생성

1. GitHub 리포지토리 → **Settings** → **Environments**
2. **New environment** 클릭
3. 이름: `production`
4. (선택) Protection rules 설정:
   - Required reviewers 추가 가능
   - 특정 브랜치에서만 배포 허용

#### 3.2 Secrets 설정

**Settings > Secrets and variables > Actions**

**Environment secrets (production 환경에 추가):**

| Secret 이름 | 설명 | 값 예시 |
|------------|------|---------|
| `AWS_ACCESS_KEY_ID` | IAM 사용자 Access Key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | IAM 사용자 Secret Key | `wJalrXUtnFEMI/K7MDENG/...` |

**Repository secrets (전체 리포지토리에 추가):**

| Secret 이름 | 설명 | 값 예시 |
|------------|------|---------|
| `DISCORD_WEBHOOK` | Discord 웹훅 URL (선택사항) | `https://discord.com/api/webhooks/...` |

#### 3.3 Discord 웹훅 생성 (선택사항)

Discord에서 배포 알림을 받으려면:

1. Discord 서버 설정 → **연동** → **웹훅**
2. **새 웹훅** 클릭
3. 이름 설정 (예: GitHub Actions)
4. 알림받을 채널 선택
5. **웹훅 URL 복사**
6. GitHub Secrets에 `DISCORD_WEBHOOK`으로 추가

**참고:** Discord 웹훅이 설정되지 않으면 알림 단계는 자동으로 스킵됩니다.

## 워크플로우 동작 방식

### 트리거 조건

- `main` 또는 `develop` 브랜치에 push
- `main` 브랜치로의 Pull Request
- 수동 실행 (Actions 탭에서 "Run workflow")

### 빌드 프로세스

1. **Web App 빌드** (`apps/web/`)
   - Dockerfile의 `production` 타겟 사용
   - ECR 레지스트리 캐시 활용
   - 태그: `latest`, `{commit-sha}`

2. **Admin App 빌드** (`apps/admin/`)
   - Dockerfile의 `production` 타겟 사용
   - ECR 레지스트리 캐시 활용
   - 태그: `latest`, `{commit-sha}`

3. **Discord 알림**
   - 성공 시: 초록색 메시지 + 이미지 URL
   - 실패 시: 빨간색 메시지

### 생성되는 이미지 태그

```
{AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-2.amazonaws.com/angple-web:latest
{AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-2.amazonaws.com/angple-web:{commit-sha}

{AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-2.amazonaws.com/angple-admin:latest
{AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-2.amazonaws.com/angple-admin:{commit-sha}
```

## 로컬에서 ECR 이미지 사용하기

### ECR 로그인

```bash
# AWS CLI로 ECR 인증
aws ecr get-login-password --region ap-northeast-2 | \
  docker login --username AWS --password-stdin \
  {AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-2.amazonaws.com
```

### 이미지 Pull 및 실행

```bash
# Web 앱
docker pull {AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-2.amazonaws.com/angple-web:latest
docker run -p 5173:80 {AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-2.amazonaws.com/angple-web:latest

# Admin 앱
docker pull {AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-2.amazonaws.com/angple-admin:latest
docker run -p 5174:80 {AWS_ACCOUNT_ID}.dkr.ecr.ap-northeast-2.amazonaws.com/angple-admin:latest
```

## 트러블슈팅

### Environment 'production' not found

**원인:** GitHub에서 production 환경이 생성되지 않음

**해결:**
1. Settings → Environments → New environment
2. 이름: `production`
3. AWS Secrets을 environment에 추가

### ECR 인증 실패

**증상:** `no basic auth credentials`

**해결:**
- AWS Secrets이 올바른지 확인
- IAM 사용자 권한 확인
- ECR 리포지토리가 생성되었는지 확인

### Discord 알림 실패

**증상:** Discord 알림 단계에서 에러

**해결:**
- `DISCORD_WEBHOOK` Secret이 설정되었는지 확인
- 웹훅 URL이 유효한지 확인
- 웹훅 URL이 `https://discord.com/api/webhooks/` 로 시작하는지 확인

### 빌드 캐시 에러

**증상:** `buildcache` 관련 에러

**해결:**
- 첫 빌드에서는 캐시가 없어 정상
- ECR에 buildcache 태그가 생성되면 다음 빌드부터 캐시 사용됨

## 주요 개선 사항 (PR #17 피드백 반영)

### 1. ECR 직접 배포
- GHCR 미러링 방식 제거
- ECR로 직접 빌드 및 푸시
- 불필요한 중간 단계 제거

### 2. Production 환경 사용
- `environment: production` 추가
- 환경별 Secret 관리 가능
- 배포 승인 프로세스 추가 가능

### 3. Discord 알림 개선
- Secret 없을 때 자동 스킵 (`secrets.DISCORD_WEBHOOK != ''`)
- 성공/실패 분리된 메시지
- 이미지 URL 포함

### 4. 빌드 최적화
- ECR 레지스트리 캐시 사용
- 빌드 속도 향상
- 네트워크 사용량 감소

## 다음 단계

yakkle님이 언급한 대로, **docker-compose 업데이트**가 우선 작업입니다:

1. ECR 이미지를 사용하도록 docker-compose.yml 수정
2. 환경변수 설정
3. 헬스체크 설정
4. 로깅 설정

이 작업은 별도 PR로 진행하는 것을 권장합니다.

## 참고 자료

- [AWS ECR 문서](https://docs.aws.amazon.com/ecr/)
- [GitHub Actions Environments](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [Discord Webhook Guide](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks)
