# 진행 기록 (Progress)

## 2026-02-05

### 시도 1: 기본 구현 ✅

**목표:** Step 1에 테마 선택 UI 추가

**변경 사항:**

1. `+page.server.ts` 수정

    - `scanThemes()` import 추가
    - 테마 목록을 `load()` 함수에서 반환
    - form action에 `activeTheme` 필드 추가

2. `+page.svelte` 수정
    - `data` props 추가
    - 테마 카드 그리드 UI 추가
    - `selectedTheme` state 추가 (기본값: `damoang-default`)
    - hidden input으로 선택값 전송

**결과:** 성공

---

### 시도 2: 스크린샷 404 에러 수정 ✅

**문제:** theme.json에 `screenshot: "screenshot.png"` 설정되어 있지만 실제 파일 없음

```
GET /themes/damoang-default/screenshot.png [404]
GET /themes/colorful-blog/screenshot.png [404]
...
```

**원인:**

-   theme.json에 screenshot 경로가 설정되어 있으면 무조건 이미지 로드 시도
-   실제 파일은 2개 테마(damoang-dev, damoang-legacy)만 존재

**해결:**

```typescript
// +page.server.ts
import { existsSync } from 'fs';
import { join } from 'path';

// 스크린샷 파일 실제 존재 여부 확인
let screenshotPath: string | null = null;
if (theme.screenshot) {
    const themePath = getThemePath(theme.id);
    const fullScreenshotPath = join(themePath, theme.screenshot);
    if (existsSync(fullScreenshotPath)) {
        screenshotPath = theme.screenshot;
    }
}
```

**결과:** 성공 - 404 에러 제거, "미리보기 없음" 정상 표시

---

### 시도 3: 설치 플로우 테스트 ✅

**테스트 시나리오:**

1. settings.json 삭제
2. /install 접속
3. 사이트 이름 입력: "테스트 사이트"
4. 테마 선택: "Damoang Dev"
5. 다음 단계 → DB 설정 → 관리자 계정 → 완료

**확인 사항:**

-   [x] 테마 카드 UI 정상 표시
-   [x] 테마 선택 시 체크마크 표시
-   [x] settings.json에 `activeTheme: "damoang-dev"` 저장
-   [x] SSR 데이터에 `activeTheme: "damoang-dev"` 확인

**결과:** 성공

---

### 시도 4: StepIndicator 컴포넌트 리팩토링 ✅

**목표:** 설치 마법사 4개 페이지에서 중복되는 진행 상태 표시 UI를 컴포넌트로 분리

**문제:**

-   동일한 코드가 4개 파일에 각각 25줄씩 중복
-   스타일 변경 시 4곳 모두 수정 필요
-   유지보수성 저하

**해결:**

1. `StepIndicator` 컴포넌트 생성

    ```
    apps/web/src/lib/components/install/
    ├── step-indicator.svelte
    └── index.ts
    ```

2. 컴포넌트 구현

    ```svelte
    <script lang="ts">
        interface Props {
            currentStep: number;
            totalSteps?: number;
        }
        let { currentStep, totalSteps = 4 }: Props = $props();

        function getStepClass(step: number): string {
            if (step < currentStep) return 'bg-primary/50 text-primary-foreground';
            if (step === currentStep) return 'bg-primary text-primary-foreground';
            return 'bg-muted-foreground/30 text-muted-foreground';
        }
    </script>
    ```

3. 4개 페이지에서 사용

    ```svelte
    import {StepIndicator} from '$lib/components/install';

    <StepIndicator currentStep={1} />
    <!-- Step 1 -->
    <StepIndicator currentStep={2} />
    <!-- Step 2 -->
    <StepIndicator currentStep={3} />
    <!-- Step 3 -->
    <StepIndicator currentStep={4} />
    <!-- Complete -->
    ```

**변경된 파일:**
| 파일 | 변경 전 | 변경 후 |
|------|---------|---------|
| `install/+page.svelte` | 25줄 | 1줄 |
| `install/step-2/+page.svelte` | 25줄 | 1줄 |
| `install/step-3/+page.svelte` | 25줄 | 1줄 |
| `install/complete/+page.svelte` | 25줄 | 1줄 |

**결과:**

-   성공 - 100줄 중복 코드 제거
-   타입 체크 통과 (기존 에러는 무관한 모듈 이슈)
-   브라우저 테스트 정상 동작 확인

---

## 알려진 이슈

### 1. 백엔드 API 404 에러

-   **현상:** 메인 페이지에서 "서버 에러 (404)" 표시
-   **원인:** angple-backend가 실행되지 않음
-   **영향:** 테마 선택 기능과 무관
-   **해결:** angple-backend 실행 필요

### 2. 대부분 테마에 스크린샷 없음

-   **현상:** 11개 중 2개만 스크린샷 있음
-   **영향:** UX 저하 (미리보기 없음 표시)
-   **해결:** 각 테마에 screenshot.png 추가 필요

---

## 성능 메모

-   테마 스캔: 동기 방식 (fs.readdirSync)
-   설치 시 1회만 호출되므로 문제 없음
-   프로덕션에서는 캐싱 고려 가능
