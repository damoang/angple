# Hook System Reference

Angple는 WordPress 스타일의 Action/Filter Hook 시스템을 제공합니다. 두 개의 Hook 구현이 있습니다:

1. **`@angple/hook-system`** (HookManager) -- 서버 사이드 / plugin-engine 코어용 (동기)
2. **Frontend HookRegistry** (`$lib/hooks/registry`) -- 클라이언트 사이드 / 테마 및 플러그인 프론트엔드용 (비동기)

---

## @angple/hook-system (HookManager)

코어 Hook 시스템입니다. 동기적으로 실행되며, plugin-engine의 내부에서 사용됩니다.

### Import

```typescript
import { HookManager, hooks } from '@angple/hook-system';
// hooks는 전역 싱글톤 인스턴스
```

### API

#### addAction(hookName, callback, priority?)

Action Hook을 등록합니다. Action은 부수효과를 실행하며, 반환값은 무시됩니다.

```typescript
hooks.addAction(
    'theme_activated',
    (themeId: string) => {
        console.log('테마 활성화:', themeId);
    },
    10
);
```

| 파라미터 | 타입             | 기본값 | 설명                          |
| -------- | ---------------- | ------ | ----------------------------- |
| hookName | `string`         | --     | Hook 이름                     |
| callback | `ActionCallback` | --     | `(...args: any[]) => void`    |
| priority | `number`         | `10`   | 우선순위 (낮을수록 먼저 실행) |

#### doAction(hookName, ...args)

등록된 모든 Action 콜백을 우선순위 순서로 실행합니다.

```typescript
hooks.doAction('theme_activated', 'my-theme');
```

#### addFilter(hookName, callback, priority?)

Filter Hook을 등록합니다. Filter는 값을 변환하여 반환합니다.

```typescript
hooks.addFilter(
    'post_title',
    (title: string, post: any) => {
        return `[공지] ${title}`;
    },
    5
);
```

| 파라미터 | 타입             | 기본값 | 설명                                  |
| -------- | ---------------- | ------ | ------------------------------------- |
| hookName | `string`         | --     | Hook 이름                             |
| callback | `FilterCallback` | --     | `(value: any, ...args: any[]) => any` |
| priority | `number`         | `10`   | 우선순위                              |

#### applyFilters(hookName, value, ...args)

등록된 모든 Filter 콜백을 체이닝하여 값을 변환합니다.

```typescript
let title = '안녕하세요';
title = hooks.applyFilters('post_title', title, post);
// 결과: "[공지] 안녕하세요"
```

#### removeAction(hookName, callback)

특정 Action 콜백을 제거합니다. 등록 시 사용한 함수 참조를 전달해야 합니다.

```typescript
const myCallback = () => console.log('hello');
hooks.addAction('page_loaded', myCallback);
hooks.removeAction('page_loaded', myCallback);
```

#### removeFilter(hookName, callback)

특정 Filter 콜백을 제거합니다.

```typescript
hooks.removeFilter('post_title', myFilter);
```

#### getRegisteredHooks()

등록된 모든 Hook 이름을 반환합니다 (디버깅용).

```typescript
const { actions, filters } = hooks.getRegisteredHooks();
// { actions: ['theme_activated', ...], filters: ['post_title', ...] }
```

#### getHookCount(hookName, type)

특정 Hook에 등록된 콜백 개수를 반환합니다.

```typescript
hooks.getHookCount('post_title', 'filter'); // 2
```

#### clearAll()

모든 Hook을 초기화합니다 (테스트용).

```typescript
hooks.clearAll();
```

---

## Priority System

우선순위는 숫자가 낮을수록 먼저 실행됩니다. 기본값은 `10`입니다.

```
priority 1  --> 가장 먼저 실행
priority 5  --> 두 번째
priority 10 --> 기본 (세 번째)
priority 20 --> 나중에 실행
priority 99 --> 거의 마지막
```

동일 우선순위일 경우 등록 순서대로 실행됩니다.

```typescript
// priority 1: 가장 먼저 실행
hooks.addFilter('post_content', removeSpam, 1);

// priority 10 (기본): 중간에 실행
hooks.addFilter('post_content', addEmbed, 10);

// priority 99: 마지막에 실행
hooks.addFilter('post_content', wrapInContainer, 99);
```

---

## Predefined HookPoints

### ActionHookPoints

플랫폼에서 사전 정의된 Action Hook입니다.

| Hook Name                  | 파라미터                          | 설명                 |
| -------------------------- | --------------------------------- | -------------------- |
| `before_page_render`       | --                                | 페이지 렌더링 전     |
| `after_page_render`        | --                                | 페이지 렌더링 후     |
| `page_loaded`              | --                                | 페이지 로드 완료     |
| `before_component_mount`   | `componentName: string`           | 컴포넌트 마운트 전   |
| `after_component_mount`    | `componentName: string`           | 컴포넌트 마운트 후   |
| `before_component_unmount` | `componentName: string`           | 컴포넌트 언마운트 전 |
| `after_component_unmount`  | `componentName: string`           | 컴포넌트 언마운트 후 |
| `before_data_fetch`        | `endpoint: string`                | 데이터 요청 전       |
| `after_data_fetch`         | `endpoint: string, data: any`     | 데이터 요청 후       |
| `data_fetch_error`         | `endpoint: string, error: Error`  | 데이터 요청 실패     |
| `user_login`               | `userId: string`                  | 사용자 로그인        |
| `user_logout`              | `userId: string`                  | 사용자 로그아웃      |
| `user_register`            | `userId: string`                  | 사용자 가입          |
| `before_post_create`       | `postData: any`                   | 게시글 생성 전       |
| `after_post_create`        | `post: any`                       | 게시글 생성 후       |
| `before_post_update`       | `postId: string, updateData: any` | 게시글 수정 전       |
| `after_post_update`        | `post: any`                       | 게시글 수정 후       |
| `before_post_delete`       | `postId: string`                  | 게시글 삭제 전       |
| `after_post_delete`        | `postId: string`                  | 게시글 삭제 후       |
| `before_comment_create`    | `commentData: any`                | 댓글 생성 전         |
| `after_comment_create`     | `comment: any`                    | 댓글 생성 후         |
| `before_comment_delete`    | `commentId: string`               | 댓글 삭제 전         |
| `after_comment_delete`     | `commentId: string`               | 댓글 삭제 후         |
| `theme_activated`          | `themeId: string`                 | 테마 활성화          |
| `theme_deactivated`        | `themeId: string`                 | 테마 비활성화        |
| `plugin_activated`         | `pluginId: string`                | 플러그인 활성화      |
| `plugin_deactivated`       | `pluginId: string`                | 플러그인 비활성화    |

### FilterHookPoints

플랫폼에서 사전 정의된 Filter Hook입니다. 첫 번째 파라미터가 변환 대상 값입니다.

| Hook Name             | 파라미터                                   | 설명                 |
| --------------------- | ------------------------------------------ | -------------------- |
| `page_title`          | `title: string`                            | 페이지 제목 변환     |
| `page_meta`           | `meta: Record<string, any>`                | 페이지 메타 변환     |
| `post_content`        | `content: string, post: any`               | 게시글 본문 변환     |
| `post_excerpt`        | `excerpt: string, post: any`               | 게시글 요약 변환     |
| `post_title`          | `title: string, post: any`                 | 게시글 제목 변환     |
| `comment_content`     | `content: string, comment: any`            | 댓글 내용 변환       |
| `comment_author_name` | `name: string, comment: any`               | 댓글 작성자명 변환   |
| `post_permalink`      | `url: string, post: any`                   | 게시글 링크 변환     |
| `asset_url`           | `url: string, assetPath: string`           | 에셋 URL 변환        |
| `user_display_name`   | `name: string, user: any`                  | 사용자 표시명 변환   |
| `user_avatar_url`     | `url: string, user: any`                   | 아바타 URL 변환      |
| `api_response`        | `response: any, endpoint: string`          | API 응답 변환        |
| `api_error_message`   | `message: string, error: Error`            | API 에러 메시지 변환 |
| `search_query`        | `query: string`                            | 검색어 변환          |
| `search_results`      | `results: any[], query: string`            | 검색 결과 변환       |
| `component_props`     | `props: Record<string, any>, name: string` | 컴포넌트 props 변환  |
| `html_output`         | `html: string, context: string`            | HTML 출력 변환       |

---

## Frontend HookRegistry (비동기)

클라이언트 사이드에서 사용하는 비동기 Hook 레지스트리입니다. 싱글톤 패턴으로 구현되어 있으며, Svelte의 reactive 시스템과 통합됩니다.

### Import

```typescript
import {
    registerHook,
    doAction,
    applyFilter,
    removeHook,
    removeHooksBySource,
    clearHooks,
    getHooks,
    getHookNames,
    hookRegistry
} from '$lib/hooks/registry';
```

### registerHook(name, callback, priority?, source?, type?)

Hook을 등록합니다.

```typescript
registerHook(
    'post_content', // Hook 이름
    (html: unknown) => processContent(html as string), // 콜백
    10, // 우선순위 (기본: 10)
    'my-plugin', // 소스 (제거 시 활용)
    'filter' // 타입 (기본: 'action')
);
```

### doAction(name, ...args)

비동기로 Action Hook을 실행합니다. 에러가 발생해도 나머지 콜백은 계속 실행됩니다.

```typescript
await doAction('page_loaded', { url: '/home', userId: 123 });
```

### applyFilter(name, value, ...args)

비동기로 Filter Hook을 체이닝하여 값을 변환합니다.

```typescript
let title = 'Hello';
title = await applyFilter('post_title', title, post);
// 결과: "🔥 Hello" (등록된 필터에 따라)
```

### removeHook(name)

특정 Hook 이름의 모든 콜백을 제거합니다.

```typescript
removeHook('post_title');
```

### removeHooksBySource(source)

특정 소스가 등록한 모든 Hook을 일괄 제거합니다. 테마/플러그인 비활성화 시 사용됩니다.

```typescript
removeHooksBySource('my-theme'); // my-theme이 등록한 모든 Hook 제거
```

### clearHooks()

모든 Hook을 초기화합니다.

### getHooks(name?)

등록된 Hook 목록을 반환합니다. name을 전달하면 해당 Hook만, 생략하면 전체를 반환합니다.

### getHookNames()

등록된 모든 Hook 이름 목록을 반환합니다.

---

## Built-in Hooks

플랫폼이 기본으로 초기화하는 Hook입니다.

### Content Embed Filter

`post_content` 필터에 동영상 URL 자동 임베드 기능을 등록합니다.

```typescript
// $lib/hooks/builtin/content-embed.ts
import { registerHook } from '../registry';
import { processContent } from '$lib/plugins/auto-embed';

export function initContentEmbed(): void {
    registerHook(
        'post_content',
        (html: unknown) => processContent(html as string),
        10,
        'core', // source: 'core'로 등록
        'filter'
    );
}
```

---

## 예시: Custom Filter 만들기

게시글 제목에 카테고리 접두사를 추가하는 필터입니다.

```typescript
// hooks/category-prefix.ts
import { registerHook } from '$lib/hooks/registry';

export function initCategoryPrefix(): void {
    registerHook(
        'post_title',
        (title: unknown, post: unknown) => {
            const p = post as { category?: string };
            if (p.category === 'notice') {
                return `[공지] ${title}`;
            }
            return title;
        },
        5, // 다른 필터보다 먼저 실행
        'category-prefix-plugin',
        'filter'
    );
}
```

## 예시: Custom Action 만들기

게시글 생성 후 분석 이벤트를 전송하는 Action입니다.

```typescript
// hooks/analytics-tracker.ts
import { registerHook } from '$lib/hooks/registry';

export function initAnalyticsTracker(): void {
    registerHook(
        'after_post_create',
        async (post: unknown) => {
            const p = post as { id: string; boardId: string };
            await fetch('/api/analytics/track', {
                method: 'POST',
                body: JSON.stringify({
                    event: 'post_created',
                    postId: p.id,
                    boardId: p.boardId
                })
            });
        },
        99, // 다른 Hook 이후 실행
        'analytics-plugin',
        'action'
    );
}
```

---

## HookManager vs Frontend HookRegistry 비교

| 특성            | HookManager (`@angple/hook-system`) | Frontend HookRegistry (`$lib/hooks/registry`) |
| --------------- | ----------------------------------- | --------------------------------------------- |
| 실행 환경       | 서버 + 클라이언트                   | 클라이언트 전용                               |
| 동기/비동기     | 동기                                | 비동기 (`async/await`)                        |
| 에러 격리       | try/catch (계속 실행)               | try/catch (계속 실행)                         |
| source 추적     | 없음                                | 있음 (`source` 파라미터)                      |
| Svelte reactive | 없음                                | 있음 (`incrementHookVersion()`)               |
| 사용 패턴       | plugin-engine 내부                  | 테마/플러그인 프론트엔드 코드                 |
