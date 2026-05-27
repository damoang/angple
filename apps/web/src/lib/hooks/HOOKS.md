# Angple Hook System — 런타임 경계 & 컨텍스트 규약

WordPress 식 Action/Filter 확장 시스템. 코어는 확장점(hook)만 호출하고, 플러그인이
`addFilter`/`addAction`(또는 `registerHook`)으로 등록한다. open-core 빌드에서 등록된
hook 이 없으면 모든 호출은 no-op(pass-through).

## 런타임이 둘이다 (G2) — 용도별로 골라 쓴다

| 런타임 | import | 실행 | 쓰는 곳 |
|---|---|---|---|
| **app registry** | `$lib/hooks/registry` (`applyFilter`/`doAction`/`registerHook`) | **async** (await) | **서버 사이드** hook. DB/네트워크 I/O 필터·액션. 예: `post.list.enrich` |
| **package** | `@angple/hook-system` (`hooks.applyFilters`/`addFilter`) | **sync** | **클라이언트** sync UI 필터. 예: `should_render_ad`, `sidebar_widgets` |

규칙:
- **서버에서 async 작업이 필요한 hook → app registry** (`$lib/hooks/registry`). 패키지는 sync 라 DB await 불가.
- **클라이언트 sync UI 필터 → 패키지** (`@angple/hook-system`).
- 신규 플러그인 hook 은 이 경계를 따른다. (기존 혼재 등록은 점진 정리 — 강제 마이그레이션은 동작 위험이 있어 보류.)

> 현재 혼재 예시: `member-memo`(server) = registry `registerHook`, `ad-free` = 패키지 `hooks.addFilter`. 신규는 위 표 기준.

## 서버 hook 컨텍스트 규약 (`HookContext`)

모든 **서버** hook 호출은 마지막 인자로 `HookContext` 를 넘긴다:

```ts
import { applyFilter } from '$lib/hooks/registry';
import { buildHookContext } from '$lib/hooks/context';

const enriched = await applyFilter('post.list.enrich', posts, buildHookContext(locals));
```

`buildHookContext(locals)` → `{ site, user }`.

- **단일 테넌트(self-host / 사이트별 별도 배포 = 현 운영)**: site 가 단일이라 콜백이 ctx 를
  무시해도 무방 → **동작 변화 0**.
- **멀티테넌트(managed SaaS, 향후)**: 디스패치/콜백이 `ctx.site` 로 사이트별 게이팅
  (활성 플러그인/entitlement)에 사용. ctx 인자가 이미 흐르고 있으므로 **호출부 수정 없이**
  게이팅만 끼우면 된다.

기존 콜백은 추가 인자를 무시하므로 ctx 도입은 점진적이며 회귀가 없다.

### 클라이언트 hook 의 site

클라이언트에는 `locals` 가 없다 → site 컨텍스트는 page data(`data.site`)로 전달된 값을
쓴다. (현재는 단일 테넌트라 미사용. 멀티테넌트 시점에 규약화.)

## 로더

- 서버: `$lib/server/plugin-server-loader.ts` — `plugins/**/hooks/*.server.{ts,js}` 를 부팅
  시 1회 동적 import(self-register). 멱등·에러격리. (= "Phase 1A")
- 클라: `$lib/client/plugin-client-loader.ts` — `plugins/**/hooks/*.client.{ts,js}`.

## 현재 등록된 서버 hook point (예시)

| hook | 종류 | 호출처 | 등록 플러그인 |
|---|---|---|---|
| `post.list.enrich` | filter | `[boardId]/+page.server.ts`, `[boardId]/[postId]/+page.server.ts` | member-memo (author_memo 등) |
| `comment_content` / `post_content` | filter | comment-list / markdown (클라) | affiliate-link |
| `should_render_ad` | filter | ad-slot (클라) | ad-free |
| `layout_server_data` | filter | `+layout.server.ts` (패키지 sync) | — |
