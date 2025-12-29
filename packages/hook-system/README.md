# @angple/hook-system

워드프레스 스타일 Hook 시스템 (Actions & Filters)

## 개요

Angple의 테마/플러그인 시스템을 위한 확장 가능한 Hook 시스템입니다. Actions와 Filters 두 가지 타입의 Hook을 제공합니다.

## 설치

```bash
pnpm add @angple/hook-system
```

## 사용법

### Actions

Actions는 특정 시점에 코드를 실행합니다. 반환값이 없습니다.

```typescript
import { hooks } from '@angple/hook-system';

// Action 등록
hooks.addAction('page_loaded', () => {
    console.log('Page loaded!');
});

// Action 실행
hooks.doAction('page_loaded');
```

### Filters

Filters는 데이터를 변환합니다. 반드시 값을 반환해야 합니다.

```typescript
import { hooks } from '@angple/hook-system';

// Filter 등록
hooks.addFilter('post_title', (title) => {
    return title.toUpperCase();
});

// Filter 적용
const title = hooks.applyFilters('post_title', 'hello world');
console.log(title); // "HELLO WORLD"
```

### 우선순위

낮은 숫자가 먼저 실행됩니다 (기본값: 10).

```typescript
hooks.addAction('init', () => console.log('Second'), 20);
hooks.addAction('init', () => console.log('First'), 5);
hooks.addAction('init', () => console.log('Third'), 30);

hooks.doAction('init');
// 출력:
// First
// Second
// Third
```

### Hook 제거

```typescript
const myCallback = () => console.log('Hello');

hooks.addAction('test', myCallback);
hooks.removeAction('test', myCallback);
```

### 디버깅

```typescript
// 등록된 모든 Hook 조회
const registered = hooks.getRegisteredHooks();
console.log(registered);
// { actions: ['page_loaded', 'init'], filters: ['post_title'] }

// 특정 Hook의 콜백 개수
const count = hooks.getHookCount('init', 'action');
console.log(count); // 3
```

## 내장 Hook 포인트

### Actions

-   `before_page_render` - 페이지 렌더링 직전
-   `after_page_render` - 페이지 렌더링 직후
-   `before_component_mount` - 컴포넌트 마운트 직전
-   `after_component_mount` - 컴포넌트 마운트 직후
-   `post_data_loaded` - 게시글 데이터 로드 완료
-   `comment_data_loaded` - 댓글 데이터 로드 완료
-   `user_data_loaded` - 사용자 데이터 로드 완료
-   `before_post_submit` - 게시글 제출 직전
-   `after_post_submit` - 게시글 제출 직후
-   `before_comment_submit` - 댓글 제출 직전
-   `after_comment_submit` - 댓글 제출 직후
-   `sidebar_widgets_render` - 사이드바 위젯 렌더링
-   `header_menu_render` - 헤더 메뉴 렌더링
-   `footer_content_render` - 푸터 콘텐츠 렌더링

### Filters

-   `post_content` - 게시글 내용 변환
-   `comment_content` - 댓글 내용 변환
-   `post_title` - 게시글 제목 변환
-   `sidebar_widgets` - 사이드바 위젯 목록 변환
-   `menu_items` - 메뉴 아이템 목록 변환
-   `api_response` - API 응답 데이터 변환
-   `api_error` - API 에러 변환

## 라이선스

MIT
