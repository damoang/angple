# Angple Extension System

> WordPress의 플러그인 혼란 없이, ZeroPress의 현대성과 Angple의 게시판 최적화를 결합

## 🎯 비전

**"플러그인 지옥 없는 확장 생태계"**

### WordPress의 문제점

-   🔴 플러그인 충돌 및 보안 취약점
-   🔴 PHP 레거시 코드 유지보수 부담
-   🔴 성능 저하 (플러그인 100개 설치 시)
-   🔴 복잡한 버전 호환성 관리

### ZeroPress의 장점

-   ✅ 플러그인 없는 클린 아키텍처
-   ✅ AI 기반 기능 내장
-   ✅ Jamstack 속도
-   ✅ 헤드리스 CMS

### Angple의 차별화

-   🎯 **TypeScript Native Extensions** (타입 안전성)
-   🎯 **Zero-Config Extensions** (설치 즉시 사용)
-   🎯 **Hot Module Replacement** (개발 중 재시작 불필요)
-   🎯 **Built-in Security Sandbox** (격리된 실행 환경)
-   🎯 **Real-time Event System** (WebSocket 기반)
-   🎯 **REST & GraphQL API** (개발자 우선)

---

## 🏗️ 아키텍처 설계

### 1. Extension vs Plugin 용어 정의

**WordPress**: Plugin (플러그인)
**ZeroPress**: 확장 기능 없음 (All-in-One)
**Angple**: **Extension** (확장 프로그램)

**왜 Extension인가?**

-   더 현대적인 용어 (VSCode, Chrome 등)
-   단순한 기능 추가가 아닌 "시스템 확장" 의미
-   테마와 명확히 구분 (Theme = 디자인, Extension = 기능)

### 2. Extension 타입

```typescript
/**
 * Extension 타입 분류
 */
export enum ExtensionType {
    /** 게시판 기능 확장 (추천/비추천, 익명 게시 등) */
    BOARD = 'board',

    /** 에디터 확장 (마크다운, WYSIWYG, AI 글쓰기 등) */
    EDITOR = 'editor',

    /** 인증/보안 확장 (OAuth, 2FA, reCAPTCHA 등) */
    AUTH = 'auth',

    /** SEO/마케팅 확장 (메타태그, 사이트맵, Analytics 등) */
    SEO = 'seo',

    /** 미디어 확장 (이미지 최적화, 동영상 임베드 등) */
    MEDIA = 'media',

    /** 소셜 기능 (공유, 좋아요, 팔로우 등) */
    SOCIAL = 'social',

    /** 알림/메시징 (푸시, 이메일, 슬랙 연동 등) */
    NOTIFICATION = 'notification',

    /** 분석/통계 (방문자 추적, 대시보드 등) */
    ANALYTICS = 'analytics',

    /** 결제/커머스 (정기구독, 포인트 등) */
    PAYMENT = 'payment',

    /** 커스텀 (기타) */
    CUSTOM = 'custom'
}
```

### 3. Extension Manifest (extension.json)

WordPress의 `plugin.php` 헤더와 달리, **TypeScript로 타입 검증 가능**한 JSON 매니페스트:

```json
{
    "id": "ai-writing-assistant",
    "name": "AI Writing Assistant",
    "version": "1.0.0",
    "description": "AI 기반 글쓰기 도우미 (번역, 요약, SEO 최적화)",
    "author": {
        "name": "Angple Team",
        "email": "dev@angple.com",
        "url": "https://angple.com"
    },
    "license": "MIT",
    "type": "editor",
    "category": ["productivity", "ai"],
    "keywords": ["ai", "writing", "editor", "gpt", "translation"],

    "angpleVersion": ">=1.0.0",
    "engines": {
        "node": ">=20.0.0",
        "sveltekit": ">=2.0.0"
    },

    "main": "./dist/index.js",
    "types": "./dist/index.d.ts",

    "permissions": ["posts:read", "posts:write", "api:external", "settings:write"],

    "hooks": {
        "onPostCreate": "./hooks/on-post-create.js",
        "onPostUpdate": "./hooks/on-post-update.js"
    },

    "api": {
        "rest": {
            "prefix": "/ai-assistant",
            "routes": [
                {
                    "method": "POST",
                    "path": "/generate",
                    "handler": "./api/generate.js"
                }
            ]
        },
        "graphql": {
            "schema": "./graphql/schema.graphql",
            "resolvers": "./graphql/resolvers.js"
        }
    },

    "ui": {
        "admin": {
            "menu": {
                "title": "AI Assistant",
                "icon": "sparkles",
                "position": 10,
                "component": "./ui/admin-page.svelte"
            },
            "settings": {
                "component": "./ui/settings.svelte"
            }
        },
        "editor": {
            "toolbar": {
                "component": "./ui/editor-toolbar.svelte"
            }
        }
    },

    "settings": {
        "apiKey": {
            "type": "string",
            "label": "OpenAI API Key",
            "description": "Your OpenAI API key for AI features",
            "required": true,
            "secret": true
        },
        "model": {
            "type": "select",
            "label": "AI Model",
            "default": "gpt-4",
            "options": ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo"]
        }
    },

    "dependencies": {
        "openai": "^4.0.0"
    },

    "homepage": "https://github.com/angple/ai-writing-assistant",
    "repository": {
        "type": "git",
        "url": "https://github.com/angple/ai-writing-assistant.git"
    },
    "bugs": "https://github.com/angple/ai-writing-assistant/issues"
}
```

### 4. Extension Entry Point (index.ts)

**WordPress 방식 (PHP):**

```php
<?php
// 레거시 PHP 코드...
add_action('init', 'my_plugin_init');
```

**Angple 방식 (TypeScript):**

```typescript
import type { Extension, ExtensionContext } from '@angple/extension-api';

export default class AIWritingAssistant implements Extension {
    private context: ExtensionContext;

    async activate(context: ExtensionContext): Promise<void> {
        this.context = context;

        // Hook 등록
        context.hooks.on('post:beforeCreate', this.handlePostCreate);

        // API 라우트 등록
        context.api.rest.register('/ai-assistant/generate', this.generateContent);

        // UI 컴포넌트 등록
        context.ui.registerEditorToolbar(EditorToolbar);

        console.log('✅ AI Writing Assistant activated');
    }

    async deactivate(): Promise<void> {
        // 정리 작업
        this.context.hooks.off('post:beforeCreate', this.handlePostCreate);
        console.log('❌ AI Writing Assistant deactivated');
    }

    private handlePostCreate = async (post: Post) => {
        // AI 기반 SEO 메타데이터 자동 생성
        if (!post.metaDescription) {
            post.metaDescription = await this.generateSEO(post.content);
        }
    };

    private generateContent = async (req: Request) => {
        // OpenAI API 호출
        const { prompt } = await req.json();
        const content = await this.context.ai.generate(prompt);
        return new Response(JSON.stringify({ content }));
    };

    private generateSEO = async (content: string): Promise<string> => {
        const settings = await this.context.settings.get('apiKey');
        // OpenAI를 사용한 SEO 메타 생성 로직
        return 'AI-generated SEO description';
    };
}
```

---

## 🔐 보안 모델

### WordPress 문제점

-   플러그인이 시스템 전체 접근 가능
-   SQL Injection, XSS 취약점
-   업데이트 시 보안 패치 혼란

### Angple 보안 전략

#### 1. Permission System (권한 시스템)

```typescript
export enum ExtensionPermission {
    // 게시글 관련
    'posts:read' = 'posts:read',
    'posts:write' = 'posts:write',
    'posts:delete' = 'posts:delete',

    // 사용자 관련
    'users:read' = 'users:read',
    'users:write' = 'users:write',

    // 설정 관련
    'settings:read' = 'settings:read',
    'settings:write' = 'settings:write',

    // 외부 API
    'api:external' = 'api:external',

    // 파일 시스템
    'files:read' = 'files:read',
    'files:write' = 'files:write'
}
```

사용자에게 권한 요청 UI 표시:

```
┌─────────────────────────────────────────────────┐
│ 🔐 AI Writing Assistant가 다음 권한을 요청합니다:│
├─────────────────────────────────────────────────┤
│ ✅ 게시글 읽기 (posts:read)                      │
│ ✅ 게시글 쓰기 (posts:write)                     │
│ ⚠️  외부 API 호출 (api:external)                │
│ ⚠️  설정 변경 (settings:write)                  │
├─────────────────────────────────────────────────┤
│ [거부]                              [승인]      │
└─────────────────────────────────────────────────┘
```

#### 2. Sandbox 실행 환경

-   Extension은 격리된 Worker Thread에서 실행
-   직접 파일 시스템 접근 불가 (API를 통해서만 가능)
-   데이터베이스 직접 쿼리 불가 (ORM API 사용)

#### 3. Code Signing (코드 서명)

마켓플레이스에서 배포되는 Extension은:

-   Angple Team의 디지털 서명 필수
-   SHA-256 해시 검증
-   악성코드 자동 스캔

---

## ⚡ 성능 최적화

### 1. Lazy Loading (지연 로딩)

```typescript
// Extension은 필요할 때만 로드
const extension = await context.extensions.load('ai-writing-assistant');
```

### 2. Hot Module Replacement (HMR)

개발 중 Extension 코드 수정 시 **서버 재시작 없이** 즉시 반영:

```bash
✨ [Extension HMR] ai-writing-assistant 코드 변경 감지
🔄 [Extension HMR] 리로드 중...
✅ [Extension HMR] 리로드 완료 (42ms)
```

### 3. Caching Strategy

```typescript
// Extension 설정 캐싱 (Redis)
const cachedSettings = await context.cache.get('extension:settings:ai-assistant');
```

---

## 🌐 API 우선 설계

### REST API

```typescript
// Extension에서 REST API 제공
context.api.rest.register('/ai-assistant/generate', {
    method: 'POST',
    handler: async (req) => {
        const { prompt } = await req.json();
        return { content: await generateAI(prompt) };
    },
    permissions: ['api:external']
});
```

**사용 예시:**

```bash
POST /api/extensions/ai-assistant/generate
{
  "prompt": "SvelteKit 5 튜토리얼 작성해줘"
}
```

### GraphQL API

```graphql
type Query {
    aiGenerate(prompt: String!): AIGenerateResult
}

type AIGenerateResult {
    content: String!
    tokens: Int!
}
```

### WebHooks

```typescript
// Extension이 WebHook 등록
context.webhooks.register('post.created', {
    url: 'https://external-service.com/webhook',
    secret: 'webhook-secret'
});
```

---

## 🎨 UI 통합

### Admin UI 자동 생성

```typescript
// Extension 설정 페이지 자동 생성
context.ui.admin.addPage({
    title: 'AI Assistant',
    icon: 'sparkles',
    component: AISettingsPage
});
```

**결과:**

```
관리자 대시보드 > Extensions > AI Assistant
┌─────────────────────────────────────────┐
│ 🎨 AI Writing Assistant                 │
├─────────────────────────────────────────┤
│ OpenAI API Key: [********************]  │
│ Model: [gpt-4 ▼]                        │
│ Temperature: [0.7 ━━━━━━━━━━━ 1.0]      │
│                                         │
│                              [저장]      │
└─────────────────────────────────────────┘
```

### Editor Toolbar 확장

```svelte
<!-- EditorToolbar.svelte -->
<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import Sparkles from '@lucide/svelte/icons/sparkles';

    async function generateAI() {
        const content = await fetch('/api/extensions/ai-assistant/generate', {
            method: 'POST',
            body: JSON.stringify({ prompt: '...' })
        });
    }
</script>

<Button on:click={generateAI}>
    <Sparkles class="mr-2 h-4 w-4" />
    AI 생성
</Button>
```

---

## 📦 Extension 배포

### 1. 개발 환경

```bash
# Extension 스캐폴딩
npx create-angple-extension my-extension

# 개발 서버 (HMR 지원)
npm run dev

# 빌드
npm run build

# Extension 패키징
npm run package
```

### 2. Marketplace 등록

```bash
# Angple CLI 인증
angple login

# Extension 업로드
angple publish ./dist/my-extension.zip

# 버전 업데이트
angple publish --version 1.0.1
```

### 3. 설치

**사용자 측:**

```bash
# Marketplace에서 검색 및 설치
angple extension install ai-writing-assistant

# ZIP 파일로 직접 설치 (개발자용)
angple extension install ./my-extension.zip
```

**Admin UI:**

```
Extensions > Marketplace > "AI Writing Assistant" > [설치]
```

---

## 🚀 로드맵

### Phase 1: 기본 시스템 (현재)

-   [x] Extension Manifest 스펙 정의
-   [ ] Extension Loader & Scanner
-   [ ] Permission System
-   [ ] Admin UI (기본)

### Phase 2: 고급 기능

-   [ ] Hot Module Replacement
-   [ ] REST & GraphQL API
-   [ ] WebHooks System
-   [ ] Marketplace UI

### Phase 3: 생태계 구축

-   [ ] Extension 개발 가이드
-   [ ] 샘플 Extension 제작
-   [ ] Marketplace 오픈
-   [ ] Extension 수익 분배

---

## 📚 비교표: Angple vs WordPress vs ZeroPress

| 기능              | WordPress        | ZeroPress         | **Angple**                       |
| ----------------- | ---------------- | ----------------- | -------------------------------- |
| **확장 방식**     | 플러그인 (PHP)   | 내장 기능만       | **Extension (TypeScript)**       |
| **타입 안전성**   | ❌ 없음          | ⚠️ 부분 지원      | ✅ **TypeScript Strict**         |
| **보안 모델**     | ❌ 취약          | ✅ 서버리스       | ✅ **Sandbox + Permissions**     |
| **성능**          | ⚠️ 느림          | ✅ 빠름           | ✅ **Vite HMR + 지연 로딩**      |
| **개발 경험**     | ⚠️ 레거시        | ✅ 현대적         | ✅ **DX 최우선**                 |
| **API**           | ⚠️ REST만        | ✅ REST + GraphQL | ✅ **REST + GraphQL + WebHooks** |
| **실시간 기능**   | ❌ 없음          | ❌ 없음           | ✅ **WebSocket 내장**            |
| **AI 통합**       | ❌ 플러그인 필요 | ✅ 내장           | ✅ **Extension API 제공**        |
| **플러그인 충돌** | ❌ 빈번          | ✅ 없음           | ✅ **격리된 실행**               |

---

**마지막 업데이트**: 2025-12-30
**버전**: Draft v1.0
