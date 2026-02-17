# Extension API Reference

Angple Extension 시스템의 핵심 API 레퍼런스입니다. Extension은 플랫폼의 기능을 확장하는 플러그인으로, 격리된 컨텍스트에서 안전하게 실행됩니다.

## Extension Manifest (extension.json)

모든 Extension은 루트 디렉토리에 `extension.json` 매니페스트 파일이 필요합니다.

### 전체 스키마

```jsonc
{
    // === 필수 필드 ===
    "id": "my-extension",             // kebab-case, 영문자/숫자/하이픈 (3~50자)
    "name": "My Extension",           // 표시 이름 (최대 100자)
    "version": "1.0.0",               // semver 형식
    "description": "Extension 설명",   // 최대 500자
    "author": {
        "name": "Author Name",        // 필수
        "email": "dev@example.com",   // 선택
        "url": "https://example.com", // 선택
        "github": "username"          // 선택
    },
    "license": "MIT",
    "category": "plugin",             // "theme" | "plugin"
    "main": "./dist/index.js",        // Entry point

    // === 선택 필드 ===
    "pluginType": "board",            // category가 "plugin"일 때만 사용
    "tags": ["history", "admin"],
    "keywords": ["soft-delete", "restore"],
    "angpleVersion": ">=1.0.0",
    "engines": {
        "node": ">=20.0.0",
        "sveltekit": ">=2.0.0"
    },
    "types": "./dist/index.d.ts",

    // 권한
    "permissions": ["posts:read", "posts:write"],

    // Hook 등록
    "hooks": [
        {
            "name": "post_content",
            "type": "filter",
            "callback": "./src/hooks/content-filter.js",
            "priority": 5
        }
    ],

    // UI 컴포넌트 등록
    "components": [
        {
            "id": "history-viewer",
            "name": "History Viewer",
            "slot": "content-after",
            "path": "./src/ui/history-viewer.svelte",
            "priority": 20
        }
    ],

    // 설정 필드
    "settings": {
        "enable_feature": {
            "type": "boolean",
            "label": "기능 활성화",
            "description": "이 기능을 활성화합니다.",
            "default": true
        }
    },

    // API 설정
    "api": {
        "rest": {
            "prefix": "/my-extension",
            "routes": [
                {
                    "method": "GET",
                    "path": "/data",
                    "handler": "./src/api/get-data.js",
                    "authenticated": true,
                    "rateLimit": 60
                }
            ]
        }
    },

    // Admin UI
    "ui": {
        "admin": {
            "menu": {
                "title": "My Extension",
                "icon": "Settings",
                "position": 50,
                "component": "./src/admin/settings-page.svelte"
            }
        }
    },

    // 메타데이터
    "homepage": "https://github.com/example/my-extension",
    "repository": {
        "type": "git",
        "url": "https://github.com/example/my-extension.git"
    },
    "active": false,
    "isCustom": false
}
```

### PluginType 값

`category`가 `"plugin"`일 때 `pluginType`으로 세부 분류합니다.

| pluginType       | 설명                                                   |
| ---------------- | ------------------------------------------------------ |
| `board`          | 게시판 기능 확장 (추천/비추천, 익명 게시, 신고 등)     |
| `editor`         | 에디터 확장 (마크다운, WYSIWYG, 코드 하이라이팅 등)    |
| `auth`           | 인증/보안 확장 (OAuth, 2FA, reCAPTCHA, 스팸 필터 등)   |
| `seo`            | SEO/마케팅 (메타태그, 사이트맵, Analytics, OG 이미지)  |
| `media`          | 미디어 확장 (이미지 최적화, 동영상 임베드, 갤러리 등)  |
| `social`         | 소셜 기능 (공유, 좋아요, 팔로우, 멘션 등)              |
| `notification`   | 알림/메시징 (푸시, 이메일, 슬랙/디스코드 연동 등)      |
| `analytics`      | 분석/통계 (방문자 추적, 대시보드, 리포트 등)           |
| `payment`        | 결제/커머스 (정기구독, 포인트, 후원 등)                |
| `ai`             | AI 통합 (GPT, Claude, 번역, 요약, 감정 분석 등)       |
| `custom`         | 기타                                                   |

---

## ExtensionContext API

Extension이 활성화되면 `ExtensionContext`가 주입됩니다. 이 컨텍스트를 통해 Hook, 설정, 권한, UI 슬롯에 접근합니다.

```typescript
interface ExtensionContext {
    hooks: HookManager;
    settings: {
        get(key: string): unknown;
        set(key: string, value: unknown): void;
        getAll(): Record<string, unknown>;
    };
    permissions: {
        check(permission: PluginPermission): boolean;
        getGranted(): PluginPermission[];
    };
    ui: {
        registerSlot(name: string, component: unknown, priority?: number): void;
        removeSlot(name: string): void;
    };
    logger: PluginLogger;
    pluginId: string;
    pluginVersion: string;
}
```

### hooks

플러그인 전용 격리된 HookManager입니다. 전역 HookManager에 위임하되, 권한 검증을 거칩니다. 비활성화 시 해당 플러그인의 모든 훅이 자동 제거됩니다.

```typescript
// Action 등록
context.hooks.addAction('after_post_create', (post) => {
    context.logger.info('새 게시글 생성:', post.title);
}, 10);

// Filter 등록
context.hooks.addFilter('post_content', (content, post) => {
    return content + '<p>Powered by My Extension</p>';
}, 20);
```

### settings

매니페스트에 정의된 설정값을 읽고 쓸 수 있습니다. `get()`은 현재 값이 없으면 매니페스트의 `default`를 반환합니다.

```typescript
const enabled = context.settings.get('enable_feature') as boolean; // true (default)
context.settings.set('enable_feature', false);
const all = context.settings.getAll(); // { enable_feature: false, ... }
```

### permissions

현재 플러그인에 부여된 권한을 확인합니다.

```typescript
if (context.permissions.check('posts:write')) {
    // 게시글 쓰기 권한 있음
}
const granted = context.permissions.getGranted(); // ['posts:read', 'posts:write']
```

### ui

UI 슬롯에 Svelte 컴포넌트를 등록합니다. priority가 낮을수록 먼저 렌더링됩니다.

```typescript
import MyBanner from './components/my-banner.svelte';

context.ui.registerSlot('content-before', MyBanner, 5);

// 제거
context.ui.removeSlot('content-before');
```

### logger

플러그인 ID가 prefix로 자동 포함되는 로거입니다.

```typescript
context.logger.info('초기화 완료');   // [Plugin:my-extension] 초기화 완료
context.logger.warn('주의 사항');
context.logger.error('오류 발생', err);
```

---

## PluginManifestInfo

plugin-engine 내부에서 사용하는 최소 매니페스트 인터페이스입니다.

```typescript
interface PluginManifestInfo {
    id: string;
    name: string;
    version: string;
    description?: string;
    permissions?: PluginPermission[];
    settings?: Record<string, PluginSettingField>;
}
```

---

## PluginSettingField

설정 필드 정의 타입입니다. 매니페스트의 `settings` 객체에서 사용합니다.

```typescript
interface PluginSettingField {
    type: 'string' | 'number' | 'boolean' | 'select' | 'textarea' | 'url' | 'color' | 'email';
    label: string;
    description?: string;
    default?: unknown;
    required?: boolean;
    options?: string[] | { label: string; value: string }[];
    min?: number;        // number 타입에서 사용
    max?: number;        // number 타입에서 사용
    placeholder?: string;
}
```

### 설정 필드 예시

```json
{
    "settings": {
        "api_key": {
            "type": "string",
            "label": "API 키",
            "description": "외부 서비스 API 키",
            "required": true,
            "placeholder": "sk-..."
        },
        "max_retries": {
            "type": "number",
            "label": "최대 재시도 횟수",
            "default": 3,
            "min": 1,
            "max": 10
        },
        "enable_cache": {
            "type": "boolean",
            "label": "캐시 활성화",
            "default": true
        },
        "log_level": {
            "type": "select",
            "label": "로그 레벨",
            "default": "warn",
            "options": [
                { "label": "디버그", "value": "debug" },
                { "label": "정보", "value": "info" },
                { "label": "경고", "value": "warn" },
                { "label": "오류", "value": "error" }
            ]
        },
        "webhook_url": {
            "type": "url",
            "label": "Webhook URL",
            "placeholder": "https://hooks.slack.com/..."
        },
        "theme_color": {
            "type": "color",
            "label": "테마 색상",
            "default": "#3b82f6"
        }
    }
}
```

---

## Extension Lifecycle

Extension은 4단계 생명주기를 따릅니다.

```
register  -->  activate  -->  deactivate  -->  unregister
(등록)         (활성화)        (비활성화)        (제거)
```

### 1. register (등록)

매니페스트를 레지스트리에 등록합니다. 아직 활성화되지 않은 상태입니다.

```typescript
const registry = new PluginRegistry(globalHooks);
registry.register(manifest, initialSettings);
```

### 2. activate (활성화)

권한을 부여하고, `ExtensionContext`를 생성하며, 초기화 함수(`initFn`)를 실행합니다.

```typescript
const context = await registry.activate(
    'my-extension',
    async (ctx) => {
        // 초기화 로직
        ctx.hooks.addFilter('post_content', myFilter);
        ctx.ui.registerSlot('sidebar-right', MySidebarWidget);
        ctx.logger.info('활성화 완료');
    },
    async () => {
        // 정리(cleanup) 로직
        console.log('Extension 정리 완료');
    }
);
```

초기화 함수에서 에러가 발생하면 자동으로 권한이 회수되고 컨텍스트가 제거됩니다.

### 3. deactivate (비활성화)

정리(cleanup) 함수를 실행하고, UI 슬롯에서 해당 플러그인의 컴포넌트를 제거하며, 권한을 회수합니다.

```typescript
await registry.deactivate('my-extension');
```

### 4. unregister (제거)

비활성화 후 레지스트리에서 완전히 제거합니다.

```typescript
await registry.unregister('my-extension');
```

---

## Permission System

최소 권한 원칙을 적용합니다. Extension은 매니페스트에 명시한 권한만 사용할 수 있습니다.

### 전체 PluginPermission 값

| Permission          | 설명                | 위험 등급 |
| ------------------- | ------------------- | --------- |
| `posts:read`        | 게시글 읽기         | safe      |
| `posts:write`       | 게시글 쓰기         | safe      |
| `posts:delete`      | 게시글 삭제         | safe      |
| `comments:read`     | 댓글 읽기           | safe      |
| `comments:write`    | 댓글 쓰기           | safe      |
| `comments:delete`   | 댓글 삭제           | safe      |
| `users:read`        | 사용자 읽기         | safe      |
| `users:write`       | 사용자 쓰기         | dangerous |
| `users:delete`      | 사용자 삭제         | dangerous |
| `settings:read`     | 설정 읽기           | safe      |
| `settings:write`    | 설정 쓰기           | safe      |
| `files:read`        | 파일 읽기           | safe      |
| `files:write`       | 파일 쓰기           | safe      |
| `files:delete`      | 파일 삭제           | dangerous |
| `api:external`      | 외부 API 호출       | dangerous |
| `database:read`     | DB 직접 읽기        | safe      |
| `database:write`    | DB 직접 쓰기        | dangerous |
| `network:fetch`     | 네트워크 요청       | dangerous |
| `network:websocket` | WebSocket 연결      | dangerous |

### DANGEROUS_PERMISSIONS

다음 권한은 설치 시 사용자에게 경고를 표시합니다.

```typescript
const DANGEROUS_PERMISSIONS: PluginPermission[] = [
    'database:write',
    'users:write',
    'users:delete',
    'files:delete',
    'network:fetch',
    'network:websocket',
    'api:external'
];
```

위험 등급 분석:
- 위험 권한 0개: `low`
- 위험 권한 1~2개: `medium`
- 위험 권한 3개 이상: `high`

```typescript
const analysis = PermissionManager.analyzeDangerousPermissions(manifest.permissions);
// { dangerous: ['api:external'], safe: ['posts:read'], riskLevel: 'medium' }
```

### HOOK_PERMISSION_MAP

특정 Hook을 등록하려면 해당 권한이 필요합니다. 매핑에 없는 Hook은 자유롭게 등록 가능합니다.

```typescript
const HOOK_PERMISSION_MAP: Record<string, PluginPermission> = {
    post_created: 'posts:write',
    post_updated: 'posts:write',
    post_deleted: 'posts:delete',
    post_title: 'posts:read',
    post_content: 'posts:read',
    before_post_save: 'posts:write',
    after_post_save: 'posts:write',
    comment_created: 'comments:write',
    comment_updated: 'comments:write',
    comment_deleted: 'comments:delete',
    comment_content: 'comments:read',
    user_registered: 'users:write',
    user_updated: 'users:write',
    user_deleted: 'users:delete',
    user_login: 'users:read',
    user_logout: 'users:read',
    file_uploaded: 'files:write',
    file_deleted: 'files:delete',
    before_file_upload: 'files:write',
    settings_updated: 'settings:write',
    settings_loaded: 'settings:read'
};
```

---

## createExtensionContext()

`ExtensionContext` 팩토리 함수입니다. 일반적으로 `PluginRegistry.activate()`가 내부에서 호출하므로 직접 사용할 일은 드뭅니다.

```typescript
import { createExtensionContext } from '@angple/plugin-engine';

const context = createExtensionContext(
    manifest,           // PluginManifestInfo
    globalHooks,        // HookManager (전역)
    permissionManager,  // PermissionManager
    currentSettings,    // Record<string, unknown>
    slotRegistry,       // Map<string, SlotRegistration[]>
    onSettingsChange    // (pluginId, key, value) => void (선택)
);
```

---

## 전체 예시: Extension 작성

```typescript
// src/index.ts
import type { PluginInitFunction, PluginCleanupFunction } from '@angple/plugin-engine';

export const init: PluginInitFunction = async (context) => {
    // 권한 확인
    if (!context.permissions.check('posts:read')) {
        context.logger.error('posts:read 권한이 필요합니다');
        return;
    }

    // 설정 읽기
    const maxVersions = context.settings.get('max_versions') as number;

    // Filter Hook 등록
    context.hooks.addFilter('post_content', (content: string, post: any) => {
        return `${content}<footer>Version tracking enabled (max: ${maxVersions})</footer>`;
    }, 20);

    // Action Hook 등록
    context.hooks.addAction('after_post_update', (post: any) => {
        context.logger.info(`게시글 업데이트 추적: ${post.id}`);
    });

    context.logger.info('Extension 초기화 완료');
};

export const cleanup: PluginCleanupFunction = async () => {
    console.log('Extension 정리 완료');
};
```
