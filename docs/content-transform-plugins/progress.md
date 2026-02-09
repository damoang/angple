# 진행 기록 (Progress)

## 2026-02-07

### 분석 1: ASIS 시스템 조사 ✅

**목표:** ASIS(그누보드5/나리야)의 컨텐츠 변환 기능 분석

**발견 사항:**

1. **숏코드 시스템** (`ShortcodeHelper.php`)
   - `[img URL]`, `[link URL]` → HTML 변환
   - 현재는 회원 서명에서만 사용
   - 보안: URL 검증, 확장자 화이트리스트, 단축URL 필터링

2. **나리야 컨텐츠 변환** (`content.lib.php`)
   - `{동영상:URL}` / `{video:URL}` → iframe 임베드
   - 7개 숏코드 형식 지원
   - 처리 순서: URL링크 → 첨부 → 지도 → 동영상 → 아이콘 → 이모티콘 → SoundCloud → 코드

3. **자동 임베드** (`nariya.js`)
   - jQuery 기반 프론트엔드 처리
   - 8개 플랫폼: YouTube, Instagram, Twitter/X, Bluesky, Reddit, Vimeo, Dailymotion, Kakao TV
   - `.na-convert` 클래스가 있는 요소에만 적용
   - Bluesky는 API 호출로 DID 해석 필요

**결과:** ASIS 기능 전체 매핑 완료

---

### 분석 2: Angple 기존 구현 확인 ✅

**목표:** Angple에 이미 구현된 컨텐츠 변환 기능 파악

**발견 사항:**

1. **이미 inline 구현된 기능:**
   - `transformEmoticons()` in `content-transform.ts` → `{emo:...}` 변환
   - `processBracketImages()` in `auto-embed/index.ts` → `[URL]` 이미지 변환
   - `processEmbeds()` in `auto-embed/index.ts` → YouTube, Vimeo, Instagram, Twitter, Twitch, TikTok

2. **훅 시스템 미연결 (중요!):**
   - `applyFilter('post_content', ...)` 가 렌더링 파이프라인에서 호출되지 않음
   - 플러그인 필터가 실행되지 않는 상태
   - emoticon 플러그인도 실제로는 동작하지 않음 (inline 코드가 대신 처리)

3. **기존 inline 코드 위치:**
   - `apps/web/src/lib/components/ui/markdown/markdown.svelte` (게시글)
   - `apps/web/src/lib/components/features/board/comment-list.svelte` (댓글)

**결과:** 훅 연결이 최우선 과제임을 확인

---

### 분석 3: 플러그인 시스템 구조 확인 ✅

**목표:** emoticon 플러그인 패턴 분석하여 새 플러그인 구조 결정

**발견 사항:**

1. **플러그인 구조:**
   ```
   plugins/{id}/
   ├── plugin.json          # 매니페스트
   ├── hooks/               # 필터/액션 콜백
   ├── lib/                 # 비즈니스 로직
   └── components/          # Svelte 컴포넌트
   ```

2. **필터 콜백 패턴:**
   ```typescript
   export default function filterName(content: string): string {
       if (!content) return content;
       return transform(content);
   }
   ```

3. **Admin 플러그인 페이지:**
   - `/admin/plugins` 에서 카드 형태로 표시
   - 활성화/비활성화 토글
   - 설정 페이지 자동 생성
   - `data/plugin-settings.json`에 상태 저장

4. **댓글 DOMPurify 제한:**
   - 현재 `blockquote` 미허용 → Instagram, Twitter 임베드에 필요
   - 플러그인 작업 시 ALLOWED_TAGS 확장 필요

**결과:** 플러그인 구조 패턴 확정

---

## 알려진 이슈

### 1. 훅 시스템 미연결
- **현상:** `applyFilter('post_content', ...)` 가 렌더링에서 호출되지 않음
- **영향:** 모든 플러그인 필터가 무효
- **해결:** markdown.svelte, comment-list.svelte에 훅 호출 추가 필요
- **주의:** 기존 inline 변환 코드와의 중복 처리 방안 결정 필요

### 2. 댓글 DOMPurify 제한
- **현상:** blockquote, script 태그 미허용
- **영향:** Instagram, Twitter, Reddit, Bluesky 임베드 불가능 (댓글에서)
- **해결:** ALLOWED_TAGS에 blockquote 추가, script는 별도 처리

### 3. 외부 스크립트 SSR 호환
- **현상:** Instagram embed.js 등은 브라우저에서만 실행 가능
- **영향:** SSR 렌더링 시 임베드 미표시
- **해결:** 클라이언트 사이드에서 `onMount` 또는 `$effect`로 스크립트 로딩

### 4. Bluesky DID 해석
- **현상:** Bluesky 핸들 → DID 변환에 API 호출 필요
- **영향:** 서버사이드에서 처리 시 지연, 클라이언트에서 처리 시 깜박임
- **해결:** 클라이언트 사이드 async 처리 (ASIS 방식과 동일)

---

## 성능 메모

- 플러그인 필터는 모든 게시글/댓글에 적용되므로 regex 최적화 중요
- 외부 스크립트(embed.js 등)는 한 번만 로딩하도록 중복 방지 필요
- YouTube iframe은 `loading="lazy"` 적용 권장
