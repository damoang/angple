# Angple Plugin System Phase 11~15 QA Plan

> 작성: 2026-02-01 | 대상: Phase 11~15 구현 검증

---

## 환경 정보

| 항목      | 값                                                           |
| --------- | ------------------------------------------------------------ |
| Web App   | `http://localhost:5173`                                      |
| Admin App | `http://localhost:5174` (또는 `http://localhost:5173/admin`) |
| 동접 규모 | 상시 1만, 피크 2만                                           |

---

## Phase 11: Plugin Engine 패키지

### QA-11-1: 패키지 빌드 검증

-   [ ] `cd packages/plugin-engine && pnpm build` 성공 확인
-   [ ] `dist/` 폴더에 `.js` + `.d.ts` 파일 생성 확인
-   [ ] 다른 패키지에서 `@angple/plugin-engine` import 가능 확인

### QA-11-2: PluginRegistry 기능 검증

-   [ ] `register()` → 플러그인 등록 확인
-   [ ] `activate()` → ExtensionContext 반환 확인
-   [ ] `deactivate()` → 권한 회수 + 슬롯 제거 확인
-   [ ] 중복 등록 시 경고 로그 출력 확인

### QA-11-3: ExtensionContext 기능 검증

-   [ ] `context.hooks.addAction()` → 전역 HookManager에 등록 확인
-   [ ] `context.settings.get()` → 기본값 폴백 확인
-   [ ] `context.settings.set()` → 변경 콜백 호출 확인
-   [ ] `context.permissions.check()` → 미부여 권한 false 확인
-   [ ] `context.ui.registerSlot()` → 슬롯 레지스트리에 등록 확인
-   [ ] `context.logger.info/warn/error()` → 플러그인 prefix 로그 확인

### QA-11-4: PermissionManager 검증

-   [ ] `grant()` → 권한 부여 후 `check()` true 확인
-   [ ] `revoke()` → 권한 회수 후 `check()` false 확인
-   [ ] 미등록 플러그인 `check()` → false 확인

---

## Phase 12: PluginSlot + ZIP 업로드

### QA-12-1: PluginSlot 컴포넌트 검증 (Web App)

-   [ ] `<PluginSlot name="header-after" />` 렌더링 확인 (빈 슬롯 = DOM 없음)
-   [ ] 슬롯에 컴포넌트 등록 시 렌더링 확인
-   [ ] 컴포넌트 에러 시 다른 컴포넌트에 영향 없음 확인 (에러 격리)
-   [ ] DEV 모드에서 에러 메시지 표시 확인
-   [ ] 슬롯 name 변경 시 컴포넌트 목록 갱신 확인

### QA-12-2: ZIP 업로드 API 검증

-   [ ] `POST /api/plugins/upload` - 정상 ZIP 업로드 → 성공 응답 확인
-   [ ] 파일 없는 요청 → 400 에러 확인
-   [ ] 20MB 초과 파일 → 400 에러 확인
-   [ ] ZIP 아닌 파일 → 400 에러 (MIME 검증)
-   [ ] plugin.json/extension.json 없는 ZIP → 400 에러
-   [ ] 매니페스트 검증 실패 → 400 에러 + details
-   [ ] 폴더명과 ID 불일치 → 400 에러
-   [ ] 중복 설치 → 409 에러
-   [ ] Zip Slip 공격 시도 → 400 에러
-   [ ] 업로드 후 `custom-plugins/`에 디렉터리 생성 확인
-   [ ] 업로드 후 `scanPlugins()` 재스캔 확인

### QA-12-3: ZIP 업로더 UI 검증 (Admin)

-   [ ] Admin > 플러그인 > 프론트엔드 탭 → "플러그인 업로드" 버튼 표시 확인 (disabled 아님)
-   [ ] 버튼 클릭 → 다이얼로그 열림 확인
-   [ ] 파일 선택 영역 클릭 → 파일 선택기 열림
-   [ ] ZIP 파일 선택 → 업로드 진행 상태 (스피너) 표시
-   [ ] 업로드 성공 → 성공 메시지 + 플러그인 목록 갱신
-   [ ] 업로드 실패 → 에러 메시지 표시 + "다시 시도" 버튼

### QA-12-4: 마켓플레이스 버튼 활성화 검증

-   [ ] "마켓플레이스" 버튼 클릭 → `/plugins/marketplace` 이동 확인

---

## Phase 13: Plugin Settings 자동 UI + 마켓플레이스

### QA-13-1: 자동 설정 폼 렌더링 검증

-   [ ] `boolean` 필드 → Switch 컴포넌트 렌더링 확인
-   [ ] `number` 필드 → Input[number] 렌더링 + min/max 적용 확인
-   [ ] `select` 필드 → Select 드롭다운 렌더링 + 옵션 목록 확인
-   [ ] `textarea` 필드 → textarea 렌더링 확인
-   [ ] `color` 필드 → 컬러 피커 + 텍스트 입력 렌더링 확인
-   [ ] `string`/`text`/`url` 필드 → Input[text/url] 렌더링 확인
-   [ ] 설정값 변경 → values 객체 업데이트 확인
-   [ ] 기본값 표시 확인 (settings에 값 없을 때 default 사용)
-   [ ] description 필드 → 설명 텍스트 표시 확인

### QA-13-2: 플러그인 설정 페이지 통합 검증

-   [ ] `/plugins/[id]/settings` → PluginSettingsForm 렌더링 확인
-   [ ] "저장" 클릭 → API 호출 + 성공 토스트
-   [ ] "기본값 복원" 클릭 → 모든 필드 기본값으로 리셋

### QA-13-3: 마켓플레이스 페이지 검증

-   [ ] `/plugins/marketplace` 페이지 로딩 확인
-   [ ] 뒤로가기 버튼 → `/plugins`로 이동
-   [ ] 검색창 입력 → 플러그인 필터링 확인
-   [ ] 카테고리 버튼 클릭 → 해당 카테고리만 표시
-   [ ] "전체" 카테고리 → 모든 플러그인 표시
-   [ ] 플러그인 카드에 이름/설명/버전/작성자/태그 표시
-   [ ] "무료" 배지 표시 (price === 0)
-   [ ] 검색 결과 없음 → "플러그인을 찾을 수 없습니다" 표시

---

## Phase 14: 게시판 뷰 시스템

### QA-14-1: BoardViewStore 검증

-   [ ] `getViewMode('test-board')` → 기본값 'list' 반환
-   [ ] `setViewMode('test-board', 'card')` → localStorage 저장 확인
-   [ ] 페이지 새로고침 → 저장된 뷰 모드 복원 확인
-   [ ] `resetViewMode('test-board')` → localStorage에서 제거 확인
-   [ ] 서버 기본값 설정 → 사용자 선호 없을 때 서버 기본값 사용 확인
-   [ ] 우선순위: 사용자 선호 > 서버 기본값 > 전역 기본값('list')

### QA-14-2: BoardViewSwitcher 컴포넌트 검증

-   [ ] 5가지 뷰 모드 아이콘 버튼 렌더링 확인
-   [ ] 현재 모드 하이라이트 (bg-primary) 확인
-   [ ] 버튼 클릭 → 뷰 모드 변경 + 즉시 반영
-   [ ] `allowedModes` prop → 제한된 모드만 표시 확인
-   [ ] aria-label, role="radiogroup" 접근성 확인

### QA-14-3: 뷰 컴포넌트별 렌더링 검증

-   [ ] **ListView**: 제목 + 작성자 + 날짜 + 조회/좋아요 수 표시
-   [ ] **CardView**: 썸네일 + 제목 + 발췌 + 태그 + 메타 표시
-   [ ] **GalleryView**: 이미지 그리드 + 호버 오버레이 표시
-   [ ] **CompactView**: 밀집 텍스트 행 (제목 + 댓글수 + 작성자 + 날짜 + 조회)
-   [ ] **TimelineView**: 타임라인 도트 + 시간 + 카드 형태 표시
-   [ ] 모든 뷰: 게시물 0개 → "게시물이 없습니다." 표시
-   [ ] 모든 뷰: 고정글 아이콘 표시 (isPinned)

### QA-14-4: Admin 게시판 뷰 설정 검증

-   [ ] `/boards/[boardId]/view-settings` 페이지 로딩 확인
-   [ ] 기본 뷰 모드 Select → 5개 옵션 표시
-   [ ] 허용 뷰 모드 Switch → 온/오프 토글 확인
-   [ ] 모든 뷰 비활성화 시도 → 최소 1개 유지 (마지막은 끌 수 없음)
-   [ ] 기본 뷰가 비활성화 모드면 → 자동으로 첫 번째 허용 뷰로 변경
-   [ ] "저장" 버튼 클릭 → 토스트 메시지 표시

---

## Phase 15: Content History Plugin

### QA-15-1: plugin.json 매니페스트 검증

-   [ ] `extensions/plugin-content-history/plugin.json` 파싱 성공
-   [ ] Zod 스키마 검증 통과 확인
-   [ ] settings 3개 필드 존재: enable_soft_delete(boolean), history_visibility(select), max_versions(number)
-   [ ] hooks 3개 정의: before_post_delete, post_content, after_post_update
-   [ ] components 2개 정의: history-viewer, deleted-banner

### QA-15-2: 소프트 삭제 훅 검증

-   [ ] enable_soft_delete=true → before_post_delete 필터에서 proceed=false 반환
-   [ ] 삭제 요청 시 softDeleted=true 플래그 설정 확인

### QA-15-3: 콘텐츠 필터 훅 검증

-   [ ] 삭제되지 않은 게시물 → 원본 콘텐츠 그대로 반환
-   [ ] 삭제된 게시물 + 관리자 → "[삭제됨] 제목" 표시 + 원본 콘텐츠 유지
-   [ ] 삭제된 게시물 + 일반 사용자 → "[삭제된 게시물입니다]" 표시
-   [ ] history_visibility=author_admins + 작성자 → "[삭제됨] 제목" 표시

### QA-15-4: 수정 이력 추적 훅 검증

-   [ ] 게시물 수정 시 이전 버전 저장 확인
-   [ ] version 번호 순차 증가 확인
-   [ ] max_versions 초과 시 오래된 버전 제거 확인
-   [ ] changeType 올바르게 기록 (create/update/soft_delete/restore)

### QA-15-5: deleted-banner.svelte UI 검증

-   [ ] deletedAt 없음 → 배너 미표시
-   [ ] deletedAt 있음 → 빨간 배너 표시 + 삭제 일시 표시
-   [ ] isAdmin=true → "복구" 버튼 표시
-   [ ] "복구" 클릭 → onRestore 콜백 호출 확인
-   [ ] 다크/라이트 모드 대응 확인

### QA-15-6: history-viewer.svelte UI 검증

-   [ ] 이력 0개 → 컴포넌트 미표시
-   [ ] 이력 있음 → "수정 이력 (N개 버전)" 헤더 표시
-   [ ] 클릭으로 펼침/접기 토글
-   [ ] 버전 역순 정렬 (최신 먼저)
-   [ ] 변경 타입별 아이콘/색상 구분 (create=초록, update=파랑, delete=빨강, restore=주황)
-   [ ] isAdmin=true → "내용 보기" 링크 표시
-   [ ] "내용 보기" 클릭 → 해당 버전 내용 표시

---

## 크로스 커팅 QA

### 성능 (동접 1~2만 대응)

-   [ ] PluginSlot 빈 슬롯 → DOM 요소 생성 안 함 확인
-   [ ] 뷰 스토어 localStorage 접근 → browser 체크로 SSR 안전 확인
-   [ ] plugin-engine 메모리 누수 없음 (deactivate 시 정리)
-   [ ] 마켓플레이스 페이지 초기 로딩 시 불필요한 API 호출 없음

### 다크/라이트 모드

-   [ ] deleted-banner: 다크 모드 색상 대응 확인
-   [ ] 뷰 스위처: 다크 모드에서 아이콘 가시성 확인
-   [ ] 마켓플레이스: 카드 그림자/배경 다크 모드 대응

### 접근성

-   [ ] 뷰 스위처: role="radiogroup", aria-checked, aria-label 확인
-   [ ] ZIP 업로더: 키보드(Enter) 트리거 확인
-   [ ] 이력 뷰어: 펼침/접기 키보드 접근 가능

### 보안

-   [ ] ZIP 업로드 Zip Slip 방어 확인
-   [ ] ZIP 업로드 Symlink 방어 확인
-   [ ] ZIP 업로드 파일 크기 제한 확인 (개별 20MB, 전체 50MB)
-   [ ] sanitizePath로 경로 탐색 공격 방지 확인

---

## Chrome MCP 기반 QA 실행 순서

1. **빌드 확인**: web + admin 빌드 성공 (사용자 제공)
2. **Admin 플러그인 페이지** 접속 → 프론트엔드 탭 확인
    - ZIP 업로드 버튼 활성 상태
    - 마켓플레이스 버튼 활성 상태
    - 기존 플러그인 카드 렌더링
3. **ZIP 업로드 다이얼로그** 열기 → UI 확인
4. **마켓플레이스 페이지** 이동 → 카테고리/검색 테스트
5. **플러그인 설정 페이지** → 자동 폼 렌더링 확인
6. **콘솔 에러** 확인 (각 페이지)
