# Theme Development Guide

Angple 테마 개발 가이드입니다. 테마는 커뮤니티의 UI 레이아웃과 스타일을 정의합니다.

## 디렉토리 구조

```
themes/my-theme/
  theme.json                  # 테마 매니페스트 (필수, theme.manifest.json도 지원)
  screenshot.png              # 테마 스크린샷 (권장)
  components/
    sample-header.svelte      # 슬롯에 등록할 Svelte 컴포넌트
    sample-footer.svelte
    banner.svelte
  hooks/
    on-page-load.js           # Action Hook 콜백
    filter-post-title.js      # Filter Hook 콜백
  layouts/
    main-layout.svelte        # 레이아웃 컴포넌트
  dist/
    index.js                  # 컴파일된 Entry point
```

## themes/ vs custom-themes/

| 디렉토리         | 용도                 | 보호 | 삭제 가능 |
| ---------------- | -------------------- | ---- | --------- |
| `themes/`        | 공식 테마 (Git 관리) | O    | X         |
| `custom-themes/` | 사용자 업로드 (ZIP)  | X    | O         |

공식 테마는 `themes/` 디렉토리에 두고 Git으로 관리합니다. 사용자가 업로드한 테마는 `custom-themes/`에 저장되며 관리자 패널에서 삭제할 수 있습니다.

---

## Theme Manifest (theme.json)

`ThemeManifest`는 `ExtensionManifest`를 확장하며, `category`가 `"theme"`으로 고정됩니다.

### 전체 스키마

```jsonc
{
    // === 필수 필드 ===
    "id": "my-theme",
    "name": "My Custom Theme",
    "version": "1.0.0",
    "description": "깔끔한 블루 테마입니다.",
    "author": {
        "name": "Theme Author",
        "email": "author@example.com",
        "url": "https://example.com"
    },
    "license": "MIT",
    "category": "theme", // 반드시 "theme"
    "main": "./dist/index.js",

    // === 테마 전용 필드 ===

    // 스크린샷
    "screenshot": "screenshot.png",

    // Angple 호환 버전
    "angpleVersion": ">=1.0.0",

    // 검색 태그
    "tags": ["minimal", "blue", "responsive"],

    // 테마 설정 (그룹 > 항목 구조)
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
            },
            "fontSize": {
                "label": "Font Size",
                "type": "number",
                "default": 14,
                "validation": {
                    "min": 12,
                    "max": 24
                }
            },
            "layout": {
                "label": "Layout Mode",
                "type": "select",
                "default": "wide",
                "options": [
                    { "label": "넓게", "value": "wide" },
                    { "label": "좁게", "value": "narrow" },
                    { "label": "전체 화면", "value": "fullwidth" }
                ]
            }
        },
        "footer": {
            "copyrightText": {
                "label": "Copyright Text",
                "type": "text",
                "default": "2024 My Community"
            }
        }
    },

    // Hook 등록
    "hooks": [
        {
            "name": "page_loaded",
            "type": "action",
            "callback": "hooks/on-page-load.js",
            "priority": 15
        },
        {
            "name": "post_title",
            "type": "filter",
            "callback": "hooks/filter-post-title.js",
            "priority": 10
        }
    ],

    // 컴포넌트 등록
    "components": [
        {
            "id": "custom-banner",
            "name": "Custom Banner",
            "slot": "content-before",
            "path": "components/banner.svelte",
            "priority": 5
        },
        {
            "id": "custom-header",
            "name": "Custom Header",
            "slot": "header",
            "path": "components/sample-header.svelte",
            "priority": 10
        },
        {
            "id": "sidebar-widget",
            "name": "Sidebar Widget",
            "slot": "sidebar-right",
            "path": "components/sidebar-widget.svelte",
            "priority": 10,
            "props": { "maxItems": 5 },
            "condition": "route.path !== '/admin'"
        }
    ]
}
```

---

## ComponentSlot Types

컴포넌트가 렌더링될 수 있는 슬롯 위치입니다.

| Slot             | 설명             |
| ---------------- | ---------------- |
| `header`         | 페이지 상단 헤더 |
| `footer`         | 페이지 하단 푸터 |
| `sidebar-left`   | 왼쪽 사이드바    |
| `sidebar-right`  | 오른쪽 사이드바  |
| `panel`          | 패널 영역        |
| `content-before` | 본문 콘텐츠 위   |
| `content-after`  | 본문 콘텐츠 아래 |
| `banner-left`    | 왼쪽 배너 영역   |
| `banner-right`   | 오른쪽 배너 영역 |

---

## ComponentDefinition

테마가 슬롯에 등록하는 컴포넌트의 정의입니다.

```typescript
interface ComponentDefinition {
    id: string; // 컴포넌트 고유 식별자 (kebab-case)
    name: string; // 표시 이름
    slot: ComponentSlot; // 렌더링될 슬롯 위치
    path: string; // 컴포넌트 파일 경로 (테마 디렉토리 기준)
    props?: Record<string, any>; // 컴포넌트에 전달될 props
    priority?: number; // 우선순위 (기본: 10, 낮을수록 먼저)
    condition?: string; // 조건부 렌더링 표현식
}
```

### priority

같은 슬롯에 여러 컴포넌트가 등록된 경우 priority 순서대로 렌더링됩니다.

```json
{
    "components": [
        { "id": "urgent-notice", "slot": "content-before", "priority": 1, "path": "..." },
        { "id": "banner", "slot": "content-before", "priority": 5, "path": "..." },
        { "id": "ad-slot", "slot": "content-before", "priority": 20, "path": "..." }
    ]
}
```

렌더링 순서: `urgent-notice` -> `banner` -> `ad-slot`

### condition

조건부 렌더링 문자열입니다. 특정 페이지나 상태에서만 컴포넌트를 표시할 때 사용합니다.

```json
{
    "id": "sidebar-widget",
    "slot": "sidebar-right",
    "condition": "route.path !== '/admin'",
    "path": "components/sidebar-widget.svelte"
}
```

---

## ThemeSettings Schema

테마 설정은 그룹 > 항목 구조로 정의합니다. `ThemeManager`가 기본값을 자동으로 추출하여 `group.key` 형식으로 저장합니다.

```typescript
interface ThemeSettings {
    [group: string]: {
        [key: string]: {
            label: string;
            description?: string;
            type: 'text' | 'number' | 'color' | 'boolean' | 'select' | 'textarea';
            default: any;
            options?: Array<{ label: string; value: any }>;
            validation?: {
                required?: boolean;
                min?: number;
                max?: number;
                pattern?: string; // 정규식 패턴
            };
        };
    };
}
```

설정값 접근:

```typescript
const settings = themeManager.getSettings();
// { "appearance.primaryColor": "#3b82f6", "appearance.showBanner": true, ... }

themeManager.updateSettings({ 'appearance.primaryColor': '#ef4444' });
```

---

## Theme Lifecycle Hooks

테마 활성화/비활성화 시 자동으로 실행되는 Hook입니다.

### theme_activated

`ThemeManager.activateTheme()` 성공 후 실행됩니다.

```typescript
hooks.addAction('theme_activated', (themeId: string) => {
    console.log(`테마 활성화: ${themeId}`);
    // 테마별 초기화 로직
});
```

### theme_deactivated

`ThemeManager.deactivateTheme()` 실행 시, 기존 테마의 Hook/컴포넌트 제거 후 실행됩니다.

```typescript
hooks.addAction('theme_deactivated', (themeId: string) => {
    console.log(`테마 비활성화: ${themeId}`);
    // 정리 로직
});
```

### 자동 Hook 로딩

테마의 `hooks[]`에 정의된 Hook은 `loadThemeHooks()`에 의해 자동으로 로드됩니다. 각 Hook 파일은 함수를 default export해야 합니다.

```javascript
// hooks/on-page-load.js
export default function onPageLoad() {
    console.log('Page loaded - from theme hook');
}
```

```javascript
// hooks/filter-post-title.js
export default function filterPostTitle(title, post) {
    if (post.isPinned) {
        return `📌 ${title}`;
    }
    return title;
}
```

테마 전환 시 이전 테마의 Hook은 `removeHooksBySource(themeId)`로 자동 제거됩니다.

---

## CLI Scaffolding

CLI 도구를 사용하여 테마 보일러플레이트를 생성할 수 있습니다.

```bash
pnpm angple create theme my-theme
```

`themes/my-theme/` 디렉토리에 기본 구조가 생성됩니다.

---

## 전체 예시

### theme.json

```json
{
    "id": "modern-community",
    "name": "Modern Community Theme",
    "version": "1.0.0",
    "description": "모던한 디자인의 커뮤니티 테마",
    "author": {
        "name": "Angple Team",
        "email": "team@angple.com"
    },
    "license": "MIT",
    "category": "theme",
    "main": "./dist/index.js",
    "screenshot": "screenshot.png",
    "angpleVersion": ">=1.0.0",
    "tags": ["modern", "community", "responsive"],
    "settings": {
        "colors": {
            "primaryColor": {
                "label": "메인 색상",
                "type": "color",
                "default": "#6366f1",
                "description": "브랜드 메인 색상"
            },
            "darkMode": {
                "label": "다크 모드",
                "type": "boolean",
                "default": false
            }
        },
        "layout": {
            "sidebarPosition": {
                "label": "사이드바 위치",
                "type": "select",
                "default": "right",
                "options": [
                    { "label": "왼쪽", "value": "left" },
                    { "label": "오른쪽", "value": "right" },
                    { "label": "없음", "value": "none" }
                ]
            },
            "maxWidth": {
                "label": "최대 너비 (px)",
                "type": "number",
                "default": 1200,
                "validation": {
                    "min": 800,
                    "max": 1920
                }
            }
        }
    },
    "hooks": [
        {
            "name": "page_loaded",
            "type": "action",
            "callback": "hooks/analytics.js",
            "priority": 20
        },
        {
            "name": "post_content",
            "type": "filter",
            "callback": "hooks/content-enhancer.js",
            "priority": 10
        }
    ],
    "components": [
        {
            "id": "branded-header",
            "name": "Branded Header",
            "slot": "header",
            "path": "components/branded-header.svelte",
            "priority": 1
        },
        {
            "id": "trending-sidebar",
            "name": "Trending Posts",
            "slot": "sidebar-right",
            "path": "components/trending-sidebar.svelte",
            "priority": 10,
            "props": { "limit": 5, "period": "week" }
        },
        {
            "id": "custom-footer",
            "name": "Custom Footer",
            "slot": "footer",
            "path": "components/custom-footer.svelte",
            "priority": 10,
            "condition": "route.path !== '/admin'"
        }
    ]
}
```

### 컴포넌트 예시 (Svelte 5)

```svelte
<!-- components/trending-sidebar.svelte -->
<script lang="ts">
    let { limit = 5, period = 'week' } = $props();

    let posts = $state<any[]>([]);

    $effect(() => {
        fetch(`/api/v1/posts/trending?limit=${limit}&period=${period}`)
            .then((res) => res.json())
            .then((data) => {
                posts = data.posts;
            });
    });
</script>

<div class="trending-sidebar">
    <h3>인기 게시글</h3>
    <ul>
        {#each posts as post}
            <li>
                <a href="/{post.boardId}/{post.id}">{post.title}</a>
                <span class="views">{post.views}</span>
            </li>
        {/each}
    </ul>
</div>
```

### Hook 콜백 예시

```javascript
// hooks/content-enhancer.js
export default function enhanceContent(content, post) {
    // 외부 링크에 target="_blank" 추가
    return content.replace(
        /<a href="(https?:\/\/[^"]+)">/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">'
    );
}
```
