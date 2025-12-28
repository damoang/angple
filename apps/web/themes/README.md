# Angple 테마 디렉터리

이 디렉터리는 Angple 웹 애플리케이션의 테마 파일들을 관리합니다.

## 📁 디렉터리 구조

```
themes/
├── README.md                    # 이 파일
├── sample-theme/                # 샘플 블루 테마
│   ├── theme.json              # 테마 매니페스트
│   ├── screenshot.png          # 테마 스크린샷
│   ├── components/             # 테마 전용 컴포넌트
│   └── layouts/                # 테마 레이아웃
└── damoang-classic/            # 다모앙 클래식 테마
    ├── theme.json
    └── screenshot.png
```

## 🎨 테마 생성 가이드

### 1. 테마 디렉터리 생성

```bash
mkdir -p themes/my-theme/components
mkdir -p themes/my-theme/layouts
```

### 2. theme.json 작성

`theme.json`은 테마의 메타데이터와 설정을 정의합니다.

```json
{
  "id": "my-theme",
  "name": "My Awesome Theme",
  "version": "1.0.0",
  "author": {
    "name": "Your Name",
    "email": "your@email.com",
    "url": "https://your-website.com"
  },
  "description": "간단한 설명",
  "screenshot": "screenshot.png",
  "angpleVersion": "0.1.0",
  "tags": ["modern", "minimal"],

  "settings": {
    "appearance": {
      "primaryColor": {
        "label": "Primary Color",
        "type": "color",
        "default": "#3b82f6"
      },
      "showBanner": {
        "label": "Show Banner",
        "type": "boolean",
        "default": true
      }
    }
  },

  "hooks": [
    {
      "name": "page_loaded",
      "type": "action",
      "callback": "hooks/on-page-load.js",
      "priority": 10
    }
  ],

  "components": [
    {
      "id": "custom-header",
      "name": "Custom Header",
      "slot": "header",
      "path": "components/header.svelte",
      "priority": 10
    }
  ]
}
```

### 3. 레이아웃 생성

`layouts/main-layout.svelte`:

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="my-theme-layout">
  <header>
    <!-- 커스텀 헤더 -->
  </header>

  <main>
    {@render children()}
  </main>

  <footer>
    <!-- 커스텀 푸터 -->
  </footer>
</div>

<style>
  .my-theme-layout {
    /* 테마 스타일 */
  }
</style>
```

### 4. 스크린샷 추가

테마 미리보기 이미지를 `screenshot.png`로 저장하세요.
권장 크기: 1200x900px

## 📋 theme.json 필드 설명

### 필수 필드

- **id**: 테마 고유 ID (kebab-case, 예: my-theme)
- **name**: 테마 표시 이름
- **version**: Semver 형식 버전 (예: 1.0.0)
- **author**: 작성자 정보
  - `name`: 작성자 이름 (필수)
  - `email`: 이메일 (선택)
  - `url`: 웹사이트 (선택)
- **angpleVersion**: 필요한 Angple 버전 (semver)

### 선택 필드

- **description**: 테마 설명 (최대 500자)
- **screenshot**: 스크린샷 파일명
- **tags**: 검색용 태그 배열
- **dependencies**: 의존성 패키지 및 버전
- **settings**: 테마 설정 스키마
- **hooks**: Hook 정의 배열
- **components**: Component 정의 배열

## 🎛️ 설정 필드 타입

### text
```json
{
  "label": "Site Title",
  "type": "text",
  "default": "My Site"
}
```

### color
```json
{
  "label": "Primary Color",
  "type": "color",
  "default": "#3b82f6"
}
```

### boolean
```json
{
  "label": "Show Banner",
  "type": "boolean",
  "default": true
}
```

### number
```json
{
  "label": "Max Width",
  "type": "number",
  "default": 1200,
  "min": 800,
  "max": 1600,
  "step": 100
}
```

### select
```json
{
  "label": "Layout Style",
  "type": "select",
  "default": "wide",
  "options": [
    { "label": "Wide", "value": "wide" },
    { "label": "Boxed", "value": "boxed" }
  ]
}
```

## 🪝 Hooks

Hook은 테마가 시스템 이벤트에 반응하도록 합니다.

### Hook 타입

- **action**: 이벤트 발생 시 실행 (반환값 없음)
- **filter**: 데이터 변환 (반환값 필요)

### 예시

```json
{
  "name": "post_title",
  "type": "filter",
  "callback": "hooks/filter-title.js",
  "priority": 10
}
```

`hooks/filter-title.js`:
```javascript
export default function filterTitle(title) {
  return title.toUpperCase();
}
```

## 🧩 Components

Component는 특정 슬롯에 UI를 주입합니다.

### 슬롯 종류

- `header`: 헤더 영역
- `footer`: 푸터 영역
- `sidebar-left`: 왼쪽 사이드바
- `sidebar-right`: 오른쪽 사이드바
- `content-before`: 콘텐츠 전
- `content-after`: 콘텐츠 후

### 예시

```json
{
  "id": "custom-banner",
  "name": "Custom Banner",
  "slot": "content-before",
  "path": "components/banner.svelte",
  "priority": 5
}
```

## 🔍 테마 검증

테마를 등록하기 전에 `theme.json`이 올바른지 검증됩니다.

```typescript
import { validateThemeManifest } from '$lib/types/theme';

try {
  const manifest = validateThemeManifest(jsonData);
  console.log('✅ 테마 검증 성공');
} catch (error) {
  console.error('❌ 테마 검증 실패:', error.issues);
}
```

## 📦 테마 배포

### GitHub에서 설치

```
https://github.com/username/my-theme
```

### Zip 파일로 업로드

테마 디렉터리를 압축하여 관리자 대시보드에서 업로드하세요.

## 🚀 베스트 프랙티스

1. **ID는 kebab-case로**: `my-awesome-theme`
2. **버전은 Semver로**: `1.0.0`
3. **설정은 카테고리별로 그룹화**: `appearance`, `layout`, `features`
4. **컴포넌트는 재사용 가능하게**: 다른 테마에서도 사용 가능하도록
5. **Hook은 최소한으로**: 성능에 영향을 줄 수 있음
6. **스크린샷 제공**: 사용자가 테마를 미리 볼 수 있도록
7. **문서 작성**: README.md에 테마 사용법 설명

## 🔗 참고 자료

- [Angple 테마 개발 가이드](https://docs.angple.com/themes)
- [SvelteKit 5 문서](https://svelte.dev/docs/kit)
- [Tailwind CSS](https://tailwindcss.com)
