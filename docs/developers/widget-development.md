# Widget Development Guide

Angple 위젯 개발 가이드입니다. 위젯은 메인 영역이나 사이드바에 배치할 수 있는 독립적인 UI 블록입니다.

## 디렉토리 구조

```
widgets/my-widget/
  widget.json        # 위젯 매니페스트 (필수)
  index.svelte       # 위젯 Svelte 컴포넌트 (필수)
```

빌트인 위젯은 `widgets/`, 사용자 위젯은 `custom-widgets/`에 배치합니다. 두 디렉토리 모두 `import.meta.glob`으로 자동 스캔됩니다.

---

## Widget Manifest (widget.json)

### 전체 스키마

```jsonc
{
    // === 필수 필드 ===
    "id": "my-widget",          // kebab-case, 소문자/숫자/하이픈 (3~50자)
    "name": "My Widget",        // 표시 이름 (최대 100자)
    "version": "1.0.0",         // semver 형식
    "author": {
        "name": "Author Name",  // 필수
        "email": "dev@example.com",  // 선택
        "url": "https://example.com" // 선택
    },
    "category": "content",      // 위젯 카테고리
    "slots": ["main", "sidebar"], // 배치 가능한 슬롯 (최소 1개)

    // === 선택 필드 ===
    "description": "위젯 설명 (최대 500자)",
    "icon": "Star",             // Lucide 아이콘 이름 (기본: "Box")
    "main": "index.svelte",     // 메인 컴포넌트 파일 (기본: "index.svelte")
    "allowMultiple": false,     // 다중 인스턴스 허용 여부 (기본: false)
    "angpleVersion": ">=1.0.0", // 호환 Angple 버전
    "screenshot": "screenshot.png",

    // 설정 스키마
    "settings": {
        "settingKey": {
            "label": "설정 라벨",
            "type": "text",
            "default": "기본값",
            "description": "설정 설명",
            "placeholder": "입력 힌트"
        }
    }
}
```

### Zod 검증

위젯 매니페스트는 런타임에 Zod 스키마로 검증됩니다.

```typescript
import { validateWidgetManifest, safeValidateWidgetManifest } from '$lib/types/widget-manifest';

// 실패 시 예외 발생
const manifest = validateWidgetManifest(data);

// 실패 시 결과 객체 반환
const result = safeValidateWidgetManifest(data);
if (result.success) {
    console.log(result.data);
} else {
    console.error(result.error.issues);
}
```

---

## Widget Categories

| Category   | 설명       | 예시                        |
| ---------- | ---------- | --------------------------- |
| `content`  | 콘텐츠     | 게시글 목록, 추천 글, AI 분석 |
| `sidebar`  | 사이드바   | 공지사항, 이미지 배너       |
| `ad`       | 광고       | 광고 슬롯, 애드센스         |
| `social`   | 소셜       | 소셜 피드, 공유 버튼        |
| `utility`  | 유틸리티   | 검색, 캘린더, 날씨          |
| `layout`   | 레이아웃   | 구분선, 스페이서            |

한글 라벨은 `WIDGET_CATEGORY_LABELS`에서 접근할 수 있습니다:

```typescript
import { WIDGET_CATEGORY_LABELS } from '$lib/types/widget-manifest';
// { content: '콘텐츠', sidebar: '사이드바', ad: '광고', ... }
```

---

## Widget Slots

위젯이 배치될 수 있는 영역입니다.

| Slot      | 설명       |
| --------- | ---------- |
| `main`    | 메인 영역  |
| `sidebar` | 사이드바   |
| `header`  | 헤더       |
| `footer`  | 푸터       |

한글 라벨은 `WIDGET_SLOT_LABELS`에서 접근할 수 있습니다:

```typescript
import { WIDGET_SLOT_LABELS } from '$lib/types/widget-manifest';
// { main: '메인 영역', sidebar: '사이드바', header: '헤더', footer: '푸터' }
```

---

## Settings Schema

위젯 설정 필드의 타입과 옵션을 정의합니다.

### Field Types

| Type      | 설명        | 추가 속성                          |
| --------- | ----------- | ---------------------------------- |
| `text`    | 텍스트 입력 | `placeholder`                      |
| `color`   | 색상 선택   | --                                 |
| `boolean` | 토글 스위치 | --                                 |
| `number`  | 숫자 입력   | `min`, `max`, `step`               |
| `select`  | 드롭다운    | `options`, `dynamic`, `dynamicEndpoint` |

### 설정 필드 예시

```json
{
    "settings": {
        "title": {
            "label": "제목",
            "type": "text",
            "default": "인기 게시글",
            "placeholder": "위젯 제목을 입력하세요"
        },
        "backgroundColor": {
            "label": "배경 색상",
            "type": "color",
            "default": "#ffffff"
        },
        "showHeader": {
            "label": "헤더 표시",
            "type": "boolean",
            "default": true
        },
        "itemCount": {
            "label": "표시 개수",
            "type": "number",
            "default": 5,
            "min": 1,
            "max": 20,
            "step": 1
        },
        "sortBy": {
            "label": "정렬",
            "type": "select",
            "default": "date",
            "options": [
                { "label": "최신순", "value": "date" },
                { "label": "추천순", "value": "recommend" },
                { "label": "조회순", "value": "hit" }
            ]
        }
    }
}
```

### Dynamic Settings

`select` 타입에서 옵션을 API에서 동적으로 로드할 수 있습니다.

```json
{
    "boardId": {
        "label": "게시판",
        "type": "select",
        "default": "notice",
        "options": [
            { "label": "공지사항", "value": "notice" }
        ],
        "dynamic": true,
        "dynamicEndpoint": "/api/boards"
    }
}
```

`dynamic: true`이면 관리자 UI에서 `dynamicEndpoint`를 호출하여 최신 옵션 목록을 가져옵니다. `options`는 API 호출 전 fallback으로 사용됩니다.

---

## allowMultiple

`allowMultiple: true`이면 같은 위젯을 여러 번 배치할 수 있습니다. 각 인스턴스는 고유한 `id`와 독립된 `settings`를 가집니다.

```json
{
    "id": "ad-slot",
    "allowMultiple": true
}
```

- `allowMultiple: false` (기본): 레이아웃에 한 번만 배치 가능. 이미 배치된 위젯은 추가 목록에서 제외됩니다.
- `allowMultiple: true`: 같은 위젯을 여러 번 배치 가능. 각각 다른 설정을 적용할 수 있습니다.

```typescript
// widget-component-loader.ts의 getAddableWidgets() 내부 로직
function getAddableWidgets(currentWidgetTypes: string[], slot: 'main' | 'sidebar'): string[] {
    return Array.from(widgets.entries())
        .filter(([type, w]) => {
            if (!w.manifest.slots.includes(slot)) return false;
            if (w.manifest.allowMultiple) return true;  // 항상 추가 가능
            return !currentWidgetTypes.includes(type);    // 이미 있으면 제외
        })
        .map(([type]) => type);
}
```

---

## Widget Component Loader

위젯은 `import.meta.glob`을 사용하여 빌드 타임에 자동 발견됩니다.

### 발견 과정

1. `widgets/*/widget.json` -- 빌트인 위젯 매니페스트 스캔
2. `widgets/*/index.svelte` -- 빌트인 위젯 컴포넌트 스캔
3. `custom-widgets/*/widget.json` -- 커스텀 위젯 매니페스트 스캔
4. `custom-widgets/*/index.svelte` -- 커스텀 위젯 컴포넌트 스캔

매니페스트는 eager 로드, 컴포넌트는 lazy 로드됩니다.

### 주요 API

```typescript
import {
    getScannedWidgets,       // 전체 위젯 맵 (캐시)
    loadWidgetComponent,     // 위젯 컴포넌트 동적 로드
    getWidgetManifest,       // 매니페스트 조회
    getWidgetName,           // 위젯 이름 조회
    getWidgetIcon,           // 위젯 아이콘 조회
    getWidgetsBySlot,        // 슬롯별 위젯 목록
    getAddableWidgets,       // 추가 가능한 위젯 목록
    getWidgetsByCategory,    // 카테고리별 위젯 목록
    getWidgetRegistry        // 전체 레지스트리 (호환용)
} from '$lib/utils/widget-component-loader';
```

```typescript
// 사이드바에 배치 가능한 위젯 목록
const sidebarWidgets = getWidgetsBySlot('sidebar');

// 현재 레이아웃 기준으로 추가 가능한 위젯
const addable = getAddableWidgets(['post-list', 'notice'], 'sidebar');

// 위젯 컴포넌트 동적 로드
const Component = await loadWidgetComponent('post-list');
```

### ScannedWidget 타입

```typescript
interface ScannedWidget {
    manifest: WidgetManifest;
    isCustom: boolean;
    load: () => Promise<{ default: Component }>;
}
```

---

## WidgetProps

모든 위젯 컴포넌트는 `WidgetProps` 인터페이스를 받습니다.

```typescript
interface WidgetProps {
    config: WidgetConfig;     // 위젯 인스턴스 설정
    slot: WidgetSlot;         // 배치 슬롯 ('main' | 'sidebar' | 'header' | 'footer')
    isEditMode?: boolean;     // 편집 모드 여부
    prefetchData?: unknown;   // SSR prefetch 데이터
}

interface WidgetConfig {
    id: string;               // 위젯 인스턴스 고유 ID
    type: string;             // 위젯 타입 (widget.json의 id)
    position: number;         // 배치 순서
    enabled: boolean;         // 활성화 여부
    settings?: Record<string, unknown>;  // 인스턴스별 설정값
}
```

---

## CLI Scaffolding

CLI 도구를 사용하여 위젯 보일러플레이트를 생성할 수 있습니다.

```bash
pnpm angple create widget my-widget
```

`widgets/my-widget/` 디렉토리에 `widget.json`과 `index.svelte`가 생성됩니다.

---

## 전체 예시: 위젯 만들기

### widget.json

```json
{
    "id": "recent-comments",
    "name": "최근 댓글",
    "version": "1.0.0",
    "description": "최근 작성된 댓글 목록을 표시합니다.",
    "author": { "name": "Angple" },
    "category": "content",
    "slots": ["main", "sidebar"],
    "icon": "MessageSquare",
    "allowMultiple": false,
    "main": "index.svelte",
    "settings": {
        "count": {
            "label": "표시 개수",
            "type": "number",
            "default": 5,
            "min": 3,
            "max": 20,
            "step": 1
        },
        "showAvatar": {
            "label": "아바타 표시",
            "type": "boolean",
            "default": true
        },
        "boardId": {
            "label": "게시판",
            "type": "select",
            "default": "all",
            "options": [
                { "label": "전체", "value": "all" },
                { "label": "자유게시판", "value": "free" },
                { "label": "공지사항", "value": "notice" }
            ],
            "dynamic": true,
            "dynamicEndpoint": "/api/boards"
        },
        "headerColor": {
            "label": "헤더 색상",
            "type": "color",
            "default": "#3b82f6"
        }
    }
}
```

### index.svelte

Svelte 5 runes 모드를 사용해야 합니다 (`$props`, `$state`, `$derived`, `$effect`).

```svelte
<script lang="ts">
    import type { WidgetProps } from '$lib/types/widget-props';

    // $props()로 위젯 표준 Props 수신
    let { config, slot, isEditMode = false }: WidgetProps = $props();

    // 설정값을 $derived로 반응적으로 추출
    const count = $derived((config.settings?.count as number) ?? 5);
    const showAvatar = $derived((config.settings?.showAvatar as boolean) ?? true);
    const boardId = $derived((config.settings?.boardId as string) ?? 'all');
    const headerColor = $derived((config.settings?.headerColor as string) ?? '#3b82f6');

    const isSidebar = $derived(slot === 'sidebar');

    // 댓글 데이터 상태
    interface Comment {
        id: string;
        author: string;
        avatarUrl?: string;
        content: string;
        boardId: string;
        postId: string;
        createdAt: string;
    }

    let comments = $state<Comment[]>([]);
    let loading = $state(true);

    // 설정이 변경되면 자동으로 데이터 재요청
    $effect(() => {
        loading = true;
        const params = new URLSearchParams({
            limit: String(count),
            ...(boardId !== 'all' && { boardId })
        });

        fetch(`/api/v1/comments/recent?${params}`)
            .then((res) => res.json())
            .then((data) => {
                comments = data.comments ?? [];
            })
            .catch((err) => {
                console.error('댓글 로드 실패:', err);
                comments = [];
            })
            .finally(() => {
                loading = false;
            });
    });
</script>

<div class="recent-comments" class:compact={isSidebar}>
    <h3 style="color: {headerColor}">최근 댓글</h3>

    {#if loading}
        <p class="text-sm text-gray-400">로딩 중...</p>
    {:else if comments.length === 0}
        <p class="text-sm text-gray-400">댓글이 없습니다.</p>
    {:else}
        <ul>
            {#each comments as comment (comment.id)}
                <li class="comment-item">
                    {#if showAvatar && comment.avatarUrl}
                        <img
                            src={comment.avatarUrl}
                            alt={comment.author}
                            class="avatar"
                        />
                    {/if}
                    <div>
                        <span class="author">{comment.author}</span>
                        <p class="content">{comment.content}</p>
                    </div>
                </li>
            {/each}
        </ul>
    {/if}

    {#if isEditMode}
        <div class="edit-overlay">편집 모드</div>
    {/if}
</div>

<style>
    .recent-comments {
        padding: 1rem;
    }
    .compact {
        padding: 0.5rem;
    }
    .comment-item {
        display: flex;
        gap: 0.5rem;
        padding: 0.5rem 0;
        border-bottom: 1px solid #f1f5f9;
    }
    .avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
    }
    .author {
        font-weight: 600;
        font-size: 0.875rem;
    }
    .content {
        font-size: 0.875rem;
        color: #64748b;
        margin: 0.25rem 0 0;
    }
    .edit-overlay {
        position: absolute;
        inset: 0;
        background: rgba(59, 130, 246, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        color: #3b82f6;
        pointer-events: none;
    }
</style>
```

### 핵심 패턴 요약

1. `$props()`로 `WidgetProps` 수신
2. `$derived()`로 `config.settings`에서 설정값 추출 (기본값 제공)
3. `$derived()`로 `slot`에 따른 레이아웃 분기
4. `$effect()`로 데이터 fetching (설정 변경 시 자동 재실행)
5. `$state()`로 컴포넌트 내부 상태 관리
6. `isEditMode`에 따른 편집 모드 UI 표시
