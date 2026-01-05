# Sample Extension

Angple Extension 개발 가이드용 샘플 프로젝트입니다.

## 📚 목적

이 샘플 Extension은 Angple Extension을 처음 개발하는 개발자를 위한 참고 자료입니다.

## 🎯 주요 기능

-   Extension 기본 구조 예시
-   Manifest 파일 작성법
-   TypeScript 타입 사용법

## 🚀 시작하기

### 1. Extension 구조

\`\`\`
sample-extension/
├── extension.json # Extension 매니페스트
├── README.md # 문서
├── src/
│ └── index.ts # Entry Point
└── dist/ # 빌드 결과
├── index.js
└── index.d.ts
\`\`\`

### 2. Extension Manifest

\`extension.json\` 파일은 Extension의 메타데이터를 정의합니다:

\`\`\`json
{
"id": "sample-extension",
"name": "Sample Extension",
"version": "1.0.0",
...
}
\`\`\`

### 3. 필수 필드

-   \`id\`: Extension 고유 ID (kebab-case)
-   \`name\`: Extension 이름
-   \`version\`: Semver 버전
-   \`type\`: Extension 타입
-   \`main\`: Entry Point 파일 경로

## 📖 더 알아보기

-   [Extension API 문서](https://docs.angple.com/extensions)
-   [Extension 개발 가이드](https://docs.angple.com/extensions/guide)
-   [Extension Marketplace](https://angple.com/marketplace)

## 📜 라이선스

MIT License - Angple Team
