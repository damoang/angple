# Angple 배포 가이드

Angple은 여러 배포 방식을 지원합니다. 프로젝트 요구사항에 맞는 방식을 선택하세요.

## 배포 방식 비교

| 방식 | 어댑터 | 사용 사례 | 장점 | 단점 |
|------|--------|-----------|------|------|
| **정적 사이트** | adapter-static | GitHub Pages, Netlify, Vercel | 무료, 빠름, 간단함 | 서버 사이드 기능 제한 |
| **SSR 서버** | adapter-node | VPS, Docker, Vercel | SSR, API 통합, 동적 콘텐츠 | 서버 관리 필요 |
| **풀스택** | adapter-node + Backend | 프로덕션 환경 | 완전한 기능, 확장성 | 복잡한 인프라 |

## 1. 정적 사이트 배포 (GitHub Pages)

### 특징
- ✅ 완전 무료 호스팅
- ✅ CI/CD 자동화 (GitHub Actions)
- ✅ HTTPS 기본 제공
- ⚠️ 클라이언트 사이드 렌더링 (CSR)만 지원
- ⚠️ 백엔드 API 별도 호스팅 필요

### 배포 방법

#### A. GitHub Pages (추천)

1. **GitHub 저장소 설정**
   ```bash
   # 저장소를 public으로 설정 (또는 GitHub Pro 계정 필요)
   ```

2. **GitHub Pages 활성화**
   - 저장소 Settings → Pages
   - Source: GitHub Actions 선택

3. **코드 푸시**
   ```bash
   git push origin main
   ```

4. **배포 확인**
   - Actions 탭에서 워크플로우 진행 상황 확인
   - 배포 완료 후 `https://<username>.github.io/<repo-name>` 접속

#### B. Netlify

1. **로컬 빌드**
   ```bash
   cd apps/web
   pnpm build:static
   ```

2. **Netlify 배포**
   - Netlify 대시보드에서 `build` 폴더 드래그 앤 드롭
   - 또는 Netlify CLI 사용:
     ```bash
     netlify deploy --prod --dir=build
     ```

#### C. Vercel

```bash
cd apps/web
pnpm build:static
vercel --prod
```

## 2. SSR 서버 배포 (Node.js)

### 특징
- ✅ 서버 사이드 렌더링 (SEO 최적화)
- ✅ API 엔드포인트 지원
- ✅ 실시간 데이터 처리

### 배포 방법

#### A. Vercel (추천)

1. **Vercel CLI 설치**
   ```bash
   npm i -g vercel
   ```

2. **배포**
   ```bash
   cd apps/web
   pnpm build  # adapter-node 사용 (기본값)
   vercel --prod
   ```

#### B. Docker

1. **Docker 이미지 빌드**
   ```bash
   docker compose build web
   ```

2. **컨테이너 실행**
   ```bash
   docker compose up -d web
   ```

3. **http://localhost:5173** 접속

#### C. VPS (Ubuntu/Debian)

1. **서버 준비**
   ```bash
   # Node.js 20+ 설치
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # pnpm 설치
   npm install -g pnpm
   ```

2. **프로젝트 배포**
   ```bash
   git clone <your-repo>
   cd angple/apps/web
   pnpm install
   pnpm build
   ```

3. **PM2로 실행**
   ```bash
   npm install -g pm2
   pm2 start build/index.js --name angple-web
   pm2 save
   pm2 startup
   ```

4. **Nginx 리버스 프록시 설정**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## 3. 풀스택 배포 (Web + Backend)

### Docker Compose (추천)

```bash
# 프로덕션 빌드 및 실행
docker compose -f compose.yml up -d

# 서비스 확인
docker compose ps
```

### 개별 서비스 관리

```bash
# Web 앱만 실행
docker compose up -d web

# Admin 앱만 실행
docker compose up -d admin
```

## 환경 변수 설정

### 정적 빌드 (.env)
```bash
# API 엔드포인트 (빌드 타임에만 사용됨)
VITE_API_BASE_URL=https://api.your-domain.com
```

### SSR 빌드 (.env)
```bash
# 빌드 타임 변수
VITE_API_BASE_URL=https://api.your-domain.com

# 런타임 변수 (adapter-node)
PUBLIC_API_BASE_URL=https://api.your-domain.com
PORT=3000
HOST=0.0.0.0
```

## Base Path 설정 (서브디렉터리 배포)

GitHub Pages에서 `https://<username>.github.io/<repo-name>` 형태로 배포할 경우:

**svelte.config.js 수정:**
```javascript
const config = {
    kit: {
        adapter,
        paths: {
            base: process.env.NODE_ENV === 'production' ? '/repo-name' : ''
        }
    }
};
```

**package.json에 환경 변수 추가:**
```json
{
  "scripts": {
    "build:static": "NODE_ENV=production ADAPTER=static vite build"
  }
}
```

## 문제 해결

### GitHub Pages 404 에러
- `.nojekyll` 파일이 `static/` 디렉터리에 있는지 확인
- SPA fallback이 활성화되어 있는지 확인 (`fallback: 'index.html'`)

### API 연결 실패
- CORS 설정 확인
- 환경 변수 (`VITE_API_BASE_URL`) 확인
- Mock 모드 비활성화: 브라우저 개발자 도구에서 `localStorage.setItem('damoang_use_mock', 'false')`

### 빌드 에러
```bash
# 캐시 클리어
rm -rf .svelte-kit node_modules
pnpm install

# 타입 검사
pnpm check

# 린트 검사
pnpm lint
```

## 성능 최적화

### 정적 사이트
- ✅ Precompress 활성화 (Gzip/Brotli)
- ✅ CDN 사용 (Cloudflare, Netlify CDN)
- ✅ 이미지 최적화 (WebP, lazy loading)

### SSR 서버
- ✅ Redis 캐싱
- ✅ 로드 밸런싱 (Nginx, HAProxy)
- ✅ 정적 파일은 CDN으로 서빙

## 모니터링

### Vercel Analytics
```bash
pnpm add @vercel/analytics
```

```svelte
<!-- +layout.svelte -->
<script>
  import { inject } from '@vercel/analytics';
  inject();
</script>
```

### Google Analytics
```html
<!-- app.html -->
<head>
  <script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'GA_MEASUREMENT_ID');
  </script>
</head>
```

## 참고 문서

- [SvelteKit Adapters](https://kit.svelte.dev/docs/adapters)
- [GitHub Pages 문서](https://docs.github.com/en/pages)
- [Vercel 배포 가이드](https://vercel.com/docs)
- [Netlify 배포 가이드](https://docs.netlify.com/)
