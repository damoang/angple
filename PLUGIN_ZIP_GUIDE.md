# Plugin ZIP Upload Guide

이 문서는 Angple 플러그인 ZIP 파일 구조와 업로드 방법을 설명합니다.

## ZIP 파일 구조

```
my-plugin.zip
└── my-plugin/              ← 루트 폴더 (플러그인 ID와 동일해야 함)
    ├── plugin.json         ← 필수! 플러그인 매니페스트
    ├── README.md           ← 선택 사항
    ├── hooks/              ← Hook 파일들
    │   └── my-hook.ts
    └── components/         ← Svelte 컴포넌트들
        └── my-component.svelte
```

### 필수 파일

**plugin.json** 또는 **extension.json** (둘 중 하나 필수)

```json
{
    "id": "my-plugin",
    "name": "My Plugin",
    "version": "1.0.0",
    "description": "플러그인 설명",
    "license": "MIT",
    "category": "plugin",
    "author": {
        "name": "Your Name",
        "email": "your@email.com",
        "url": "https://example.com"
    },
    "hooks": [
        {
            "name": "my_hook",
            "type": "action",
            "callback": "hooks/my-hook.ts",
            "priority": 10
        }
    ],
    "components": [
        {
            "id": "my-component",
            "name": "My Component",
            "slot": "main",
            "path": "components/my-component.svelte",
            "priority": 10
        }
    ],
    "settings": {
        "enabled": {
            "label": "활성화",
            "type": "boolean",
            "default": true,
            "description": "플러그인 활성화 여부"
        }
    },
    "tags": ["example", "sample"]
}
```

### 주요 필드 설명

| 필드          | 필수 | 설명                                              |
| ------------- | ---- | ------------------------------------------------- |
| `id`          | ✅   | 플러그인 고유 ID (kebab-case, 루트 폴더명과 동일) |
| `name`        | ✅   | 플러그인 이름                                     |
| `version`     | ✅   | 버전 (semver)                                     |
| `description` | ✅   | 플러그인 설명                                     |
| `license`     | ✅   | 라이선스 (예: MIT, GPL-3.0)                       |
| `category`    | ✅   | 반드시 `"plugin"`                                 |
| `author`      | ✅   | 작성자 정보                                       |
| `hooks`       | ❌   | Hook 배열                                         |
| `components`  | ❌   | Svelte 컴포넌트 배열                              |
| `settings`    | ❌   | 설정 스키마                                       |
| `tags`        | ❌   | 태그 배열                                         |

## 업로드 방법

### 1. Admin UI에서 업로드

1. Admin 페이지 접속: `http://localhost:5174`
2. 사이드바에서 **플러그인 관리** 클릭
3. **새 플러그인 업로드** 버튼 클릭
4. ZIP 파일 선택 (드래그 앤 드롭 가능)
5. 업로드 완료 후 **활성화** 버튼 클릭

### 2. API로 업로드

```bash
curl -X POST http://localhost:5173/api/plugins/upload \
  -F "file=@my-plugin.zip"
```

## 보안 및 제약사항

### 파일 크기

-   최대 **10MB**

### 허용 MIME 타입

-   `application/zip`
-   `application/x-zip-compressed`
-   `application/octet-stream`

### 검증 항목

1. ✅ plugin.json 또는 extension.json 존재 확인
2. ✅ ExtensionManifest 스키마 검증 (Zod)
3. ✅ category가 "plugin"인지 확인
4. ✅ 루트 폴더명과 플러그인 ID 일치 확인
5. ✅ 중복 플러그인 ID 체크
6. ✅ 경로 보안 검증 (.. / \ 차단)

## 에러 케이스

| 에러                               | 원인                 | 해결 방법                      |
| ---------------------------------- | -------------------- | ------------------------------ |
| `plugin.json이 없습니다`           | 매니페스트 파일 누락 | 루트 폴더에 plugin.json 추가   |
| `형식이 올바르지 않습니다`         | 스키마 검증 실패     | 필수 필드 확인                 |
| `카테고리가 'plugin'이어야 합니다` | category 필드 오류   | category를 "plugin"으로 수정   |
| `폴더명과 ID가 일치하지 않습니다`  | 폴더명 ≠ ID          | 폴더명을 ID와 동일하게 변경    |
| `이미 설치되어 있습니다`           | 중복 ID              | 기존 플러그인 삭제 후 재업로드 |

## 샘플 플러그인

테스트용 샘플 플러그인: `/tmp/sample-test-plugin.zip`

```bash
# ZIP 생성
cd /tmp
mkdir -p sample-test-plugin/hooks
cat > sample-test-plugin/plugin.json << 'JSON'
{
    "id": "sample-test-plugin",
    "name": "Sample Test Plugin",
    "version": "1.0.0",
    "description": "테스트용 샘플 플러그인",
    "license": "MIT",
    "category": "plugin",
    "author": {
        "name": "Test Developer"
    },
    "hooks": [
        {
            "name": "test_hook",
            "type": "action",
            "callback": "hooks/test-init.ts",
            "priority": 10
        }
    ],
    "tags": ["test"]
}
JSON

cat > sample-test-plugin/hooks/test-init.ts << 'TS'
export default function testInit() {
    console.log('✅ Test plugin initialized!');
}
TS

zip -r sample-test-plugin.zip sample-test-plugin/
```

## 문제 해결

### ZIP 구조 확인

```bash
unzip -l my-plugin.zip
```

### plugin.json 검증

```bash
cat plugin.json | jq .
```

### 로그 확인

-   서버: Web 앱 콘솔
-   클라이언트: 브라우저 개발자 도구 콘솔

## 참고

-   [ExtensionManifest 스키마](packages/types/src/extension-schema.ts)
-   [테마 ZIP 업로드 가이드](THEME_ZIP_GUIDE.md)
