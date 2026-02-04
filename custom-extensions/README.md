# Custom Extensions

이 디렉터리에는 GitHub Packages에서 설치된 플러그인(확장)이 저장됩니다.

## 설치 방법

Admin 대시보드의 플러그인 관리 페이지에서 "GitHub에서 설치" 버튼을 클릭하여 설치할 수 있습니다.

### Public 패키지

```
@angple/plugin-example
```

### Private 패키지

Private 저장소의 패키지를 설치하려면 GitHub Personal Access Token (PAT)이 필요합니다.

1. [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)에서 토큰 생성
2. `read:packages` 권한 부여
3. Admin에서 설치 시 토큰 입력

## 주의사항

-   이 디렉터리의 내용은 Git에서 무시됩니다
-   서버 이전 시 수동으로 백업/복원이 필요합니다
-   플러그인 업데이트는 Admin에서 재설치로 가능합니다
