# 발견 사항 (Findings)

## 테마 시스템 구조

### 테마 디렉터리
```
themes/                    # 공식 테마 (Git 추적)
├── damoang-default/
├── damoang-dev/          # 스크린샷 있음
├── damoang-legacy/       # 스크린샷 있음
├── colorful-blog/
├── corporate-landing/
└── ...

custom-themes/            # 커스텀 테마 (Git 무시)
```

### 테마 매니페스트 (theme.json)
```json
{
  "id": "damoang-dev",
  "name": "Damoang Dev",
  "version": "1.0.0",
  "description": "...",
  "screenshot": "screenshot.png",  // 파일이 없어도 설정되어 있음
  "angpleVersion": "0.1.0"
}
```

### 스크린샷 현황
| 테마 | 스크린샷 파일 |
|------|--------------|
| damoang-dev | ✅ screenshot.png |
| damoang-legacy | ✅ screenshot.png |
| 기타 테마 | ❌ placeholder만 존재 |

## 설정 파일 구조

### settings.json
```json
{
  "installed": true,
  "activeTheme": "damoang-dev",
  "themes": {},
  "version": "1.0.0",
  "siteName": "...",
  "language": "ko",
  "database": { ... },
  "adminEmail": "..."
}
```

## API 및 함수

### scanThemes()
- 위치: `apps/web/src/lib/server/themes/scanner.ts`
- 반환: `Map<string, ThemeManifest>`
- `themes/`와 `custom-themes/` 모두 스캔

### getThemePath(themeId)
- 위치: `apps/web/src/lib/server/themes/scanner.ts`
- 반환: 테마 디렉터리 절대 경로
- 공식/커스텀 테마 모두 지원

### updateSettings(updates)
- 위치: `apps/web/src/lib/server/install/check-installed.ts`
- 기능: settings.json 부분 업데이트
- activeTheme 필드 지원됨

## SSR 테마 로딩

### +layout.server.ts
```typescript
const activeTheme = await getActiveTheme();
return {
  activeTheme: activeTheme?.manifest.id || null,
  themeSettings: activeTheme?.currentSettings || {}
};
```

## 테마 정적 파일 서빙

### /themes/[...path]/+server.ts
- MIME 타입: json, js, css, png, jpg, svg 지원
- 보안: path traversal 방지 (`sanitizePath`)
- 캐시: `max-age=3600`
