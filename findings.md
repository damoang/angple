# Findings: Frontend Phase 11

## 핵심 발견: 플러그인 시스템이 이미 상당 부분 구현되어 있음

### 이미 존재하는 파일들

| 파일 | 상태 | 설명 |
|------|------|------|
| `apps/web/src/lib/server/plugins/scanner.ts` | ✅ 존재 | 플러그인 스캐너 |
| `apps/web/src/lib/server/plugins/index.ts` | ✅ 존재 | 플러그인 서버 API (activate, deactivate, getActivePlugins) |
| `apps/web/src/lib/server/extensions/scanner.ts` | ✅ 존재 | 통합 Extension 스캐너 |
| `apps/web/src/lib/server/settings/plugin-settings-provider.ts` | ✅ 존재 | 플러그인 설정 Provider |
| `apps/web/src/lib/stores/plugin.svelte.ts` | ✅ 존재 | 플러그인 클라이언트 스토어 |
| `apps/web/data/plugin-settings.json` | ✅ 존재 | 플러그인 설정 저장소 |
| `apps/web/src/routes/api/plugins/[id]/+server.ts` | ✅ 존재 | API 엔드포인트 |
| `packages/hook-system/` | ✅ 완성 | Hook 시스템 패키지 |
| `packages/types/src/extension.ts` | ✅ 존재 | 타입 정의 |

### 결론: Phase 11은 "신규 구현"이 아니라 "검증 및 개선"

기존 코드가 있으므로 작업 방향을 조정해야 함:
1. 기존 scanner, loader, registry 코드의 **동작 검증**
2. 누락된 부분 **보완** (에러 격리, Zod 검증 강화 등)
3. 샘플 플러그인으로 **통합 테스트**

---

## 테마 스캐너 패턴 (복제 기반)

**파일**: `apps/web/src/lib/server/themes/scanner.ts`

핵심 흐름:
```
1. getProjectRoot() — Monorepo 환경 대응
2. THEMES_DIR / CUSTOM_THEMES_DIR 정의
3. isValidThemeDirectory() — theme.json 존재 확인
4. loadThemeManifest() — JSON 파싱 + Zod 검증
5. scanDirectory() — readdirSync → 유효성 → 매니페스트 로드 → Map
6. scanThemes() — 공식 + 커스텀 디렉토리 스캔
```

보안: `sanitizePath()` 경로 검증 (.. / \ / 절대경로 / null byte 차단)

---

## Hook 시스템 구현 상세

**패키지**: `@angple/hook-system`

```typescript
class HookManager {
    addAction(hookName, callback, priority = 10)
    doAction(hookName, ...args)
    addFilter(hookName, callback, priority = 10)
    applyFilters(hookName, value, ...args)
}

export const hooks = new HookManager(); // 글로벌 싱글톤
```

우선순위: 1-9 (보안), 10-49 (일반), 50-99 (후처리)

---

## 플러그인 매니페스트 구조 (extension.json)

```json
{
    "id": "plugin-banner-message",
    "name": "Banner Message System",
    "version": "1.0.0",
    "category": "plugin",
    "pluginType": "custom",
    "main": "./dist/index.js",
    "permissions": ["settings:read", "network:fetch"],
    "hooks": {
        "before_page_render": "./hooks/header-banner.js",
        "post_content": "./hooks/content-banner.js"
    },
    "settings": { ... },
    "active": false
}
```

---

## SSR 데이터 플로우

```
+layout.server.ts → getActivePlugins() → PageData
+layout.svelte → pluginStore.initFromServer(data.activePlugins)
```

---

## Settings 관리

- 테마: `apps/web/data/settings.json` (activeTheme)
- 플러그인: `apps/web/data/plugin-settings.json` (activePlugins[])
- Lock 메커니즘으로 동시 쓰기 방지

---

## 기존 샘플 플러그인 (6개)

| 플러그인 | 위치 | 설명 |
|---------|------|------|
| sample-extension | extensions/ | 기본 샘플 |
| plugin-mention | extensions/ | @멘션 기능 |
| sample-plugin-ai | extensions/ | AI 연동 |
| plugin-promotion | extensions/ | 프로모션 |
| plugin-banner-message | extensions/ | 배너 광고 |
| sample-plugin-seo | extensions/ | SEO |
