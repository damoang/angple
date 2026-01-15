# 자유게시판 사용 가이드

## 🚀 빠른 시작

자유게시판은 **Mock 데이터**로 바로 사용할 수 있습니다!

### 개발 서버 실행

```bash
cd apps/web
npm run dev
```

브라우저에서 http://localhost:3010/free 접속

---

## 🎯 Mock 모드 vs 실제 API

### Mock 모드 (기본값 - 추천)

-   **자동 활성화**: 별도 설정 없이 바로 사용 가능
-   **100개의 샘플 게시글** 제공
-   **API 서버 불필요**

### 실제 API 모드

API 서버(`https://api.ang.dev`)가 복구되면 사용 가능

---

## 🔧 설정 방법

### Mock 모드 끄기 (실제 API 사용)

```javascript
// 브라우저 콘솔(F12)에서 실행
localStorage.setItem('damoang_use_mock', 'false');
location.reload();
```

### Mock 모드 켜기 (다시 활성화)

```javascript
// 브라우저 콘솔(F12)에서 실행
localStorage.setItem('damoang_use_mock', 'true');
location.reload();
```

### 현재 모드 확인

```javascript
// 브라우저 콘솔(F12)에서 실행
localStorage.getItem('damoang_use_mock');
// null 또는 'true' → Mock 모드
// 'false' → 실제 API 모드
```

---

## 🔐 실제 API 연결 (API 서버 복구 후)

### 1. Mock 모드 비활성화

```javascript
localStorage.setItem('damoang_use_mock', 'false');
```

### 2. API 토큰 발급

```bash
curl -X POST https://api.ang.dev/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "My App", "email": "your@email.com"}'
```

### 3. 페이지 새로고침

```javascript
location.reload();
```

---

## 📱 주요 기능

### 목록 페이지 (`/free`)

-   ✅ 페이지네이션 (20개씩)
-   ✅ 태그 필터링
-   ✅ 조회수, 좋아요, 댓글 수
-   ✅ 상대 시간 표시

### 상세 페이지 (`/free/[id]`)

-   ✅ 마크다운 형식
-   ✅ 이미지 갤러리
-   ✅ SEO 메타 태그
-   ✅ 다크/라이트 모드

---

## 🐛 문제 해결

### "게시글을 불러오는데 실패했습니다" 에러

**원인**: Mock 모드가 비활성화되어 있고, API 서버에 연결할 수 없음

**해결**:

```javascript
// 1. Mock 모드 활성화
localStorage.setItem('damoang_use_mock', 'true');

// 2. 페이지 새로고침
location.reload();
```

### 빈 페이지가 나옴

**원인**: LocalStorage가 초기화되지 않음

**해결**: 위의 "Mock 모드 켜기" 방법 실행

---

## 📦 파일 구조

```
routes/free/
├── +page.svelte          # 목록 페이지 UI
├── +page.ts              # 목록 데이터 로더
├── [id]/
│   ├── +page.svelte      # 상세 페이지 UI
│   └── +page.ts          # 상세 데이터 로더
└── README.md             # 이 파일

lib/api/
├── client.ts             # API 클라이언트
├── mock-data.ts          # Mock 데이터 생성기
└── types.ts              # TypeScript 타입
```

---

## 💡 개발 팁

### Mock 데이터 커스터마이징

`lib/api/mock-data.ts`에서 샘플 데이터 수정 가능

### API 엔드포인트 변경

`lib/api/client.ts`의 `API_BASE_URL` 수정
