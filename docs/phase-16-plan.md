# Phase 16: 코어 기능 확장 설계

## 개요

Phase 15의 Content History Plugin에서 구현한 소프트 삭제/수정 이력을 **코어 기능으로 승격**하고,
스크랩(북마크)과 게시판 그룹 관리를 추가합니다.

---

## 1. 소프트 삭제 (Soft Delete) - 코어 내장

### 1.1 데이터 모델 변경

**FreePost 확장** (`apps/web/src/lib/api/types.ts`):

```typescript
export interface FreePost {
    // ... 기존 필드 유지 ...
    deleted_at?: string | null;
    deleted_by?: string | null;
}
```

**FreeComment 확장**:

```typescript
export interface FreeComment {
    // ... 기존 필드 유지 ...
    deleted_at?: string | null;
}
```

### 1.2 백엔드 API 스펙

| Method   | Endpoint                                              | 설명               | 권한           |
| -------- | ----------------------------------------------------- | ------------------ | -------------- |
| `PATCH`  | `/api/v2/boards/{boardId}/posts/{postId}/soft-delete` | 소프트 삭제        | 작성자, 관리자 |
| `POST`   | `/api/v2/boards/{boardId}/posts/{postId}/restore`     | 복구               | 관리자         |
| `DELETE` | `/api/v2/boards/{boardId}/posts/{postId}/permanent`   | 영구 삭제          | 관리자         |
| `GET`    | `/api/v2/admin/posts/deleted`                         | 삭제된 게시물 목록 | 관리자         |

**백엔드 DB 마이그레이션** (Go/Fiber):

```sql
ALTER TABLE posts ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE posts ADD COLUMN deleted_by VARCHAR(50) NULL DEFAULT NULL;
CREATE INDEX idx_posts_deleted_at ON posts(deleted_at);

ALTER TABLE comments ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL;
CREATE INDEX idx_comments_deleted_at ON comments(deleted_at);
```

### 1.3 프론트엔드 구현

#### API 클라이언트 추가 (`client.ts`)

```typescript
async softDeletePost(boardId: string, postId: string): Promise<void>
async restorePost(boardId: string, postId: string): Promise<FreePost>
async permanentDeletePost(boardId: string, postId: string): Promise<void>
async getDeletedPosts(page?: number, limit?: number): Promise<PaginatedResponse<FreePost>>
```

#### 컴포넌트

| 파일                         | 위치                                   | 설명                                |
| ---------------------------- | -------------------------------------- | ----------------------------------- |
| `deleted-post-banner.svelte` | `apps/web/src/lib/components/post/`    | 삭제된 게시물 안내 배너 + 복구 버튼 |
| `deleted-posts-list.svelte`  | `apps/admin/src/routes/posts/deleted/` | Admin 삭제 게시물 관리              |

#### 동작 흐름

1. 사용자가 삭제 클릭 → `softDeletePost()` 호출
2. 게시물 목록에서 삭제된 글 숨김 (기본) 또는 `[삭제됨]` 표시
3. 관리자: Admin에서 삭제 게시물 목록 조회 + 복구/영구삭제
4. 기존 `deletePost()` → `softDeletePost()`로 교체

---

## 2. 수정 이력 (Revision) - 코어 내장

### 2.1 데이터 모델

**새 타입** (`types.ts`):

```typescript
export interface PostRevision {
    id: number;
    post_id: number;
    version: number;
    title: string;
    content: string;
    tags?: string[];
    edited_by: string;
    edited_at: string;
    change_type: 'create' | 'update' | 'soft_delete' | 'restore';
}

export interface RevisionDiff {
    field: string;
    old_value: string;
    new_value: string;
}
```

### 2.2 백엔드 API 스펙

| Method | Endpoint                                                              | 설명           | 권한           |
| ------ | --------------------------------------------------------------------- | -------------- | -------------- |
| `GET`  | `/api/v2/boards/{boardId}/posts/{postId}/revisions`                   | 수정 이력 목록 | 작성자, 관리자 |
| `GET`  | `/api/v2/boards/{boardId}/posts/{postId}/revisions/{version}`         | 특정 버전 조회 | 작성자, 관리자 |
| `POST` | `/api/v2/boards/{boardId}/posts/{postId}/revisions/{version}/restore` | 버전 복원      | 작성자, 관리자 |

**백엔드 DB 마이그레이션**:

```sql
CREATE TABLE post_revisions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    title VARCHAR(500) NOT NULL,
    content LONGTEXT NOT NULL,
    tags JSON NULL,
    edited_by VARCHAR(50) NOT NULL,
    edited_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    change_type ENUM('create', 'update', 'soft_delete', 'restore') DEFAULT 'update',
    UNIQUE KEY uk_post_version (post_id, version),
    INDEX idx_post_id (post_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);
```

### 2.3 프론트엔드 구현

#### API 클라이언트 추가

```typescript
async getPostRevisions(boardId: string, postId: string): Promise<PostRevision[]>
async getPostRevision(boardId: string, postId: string, version: number): Promise<PostRevision>
async restoreRevision(boardId: string, postId: string, version: number): Promise<FreePost>
```

#### 컴포넌트

| 파일                             | 위치                                | 설명                         |
| -------------------------------- | ----------------------------------- | ---------------------------- |
| `revision-history.svelte`        | `apps/web/src/lib/components/post/` | 수정 이력 타임라인 + diff 뷰 |
| `revision-diff.svelte`           | `apps/web/src/lib/components/post/` | 두 버전 간 차이 비교         |
| `revision-restore-dialog.svelte` | `apps/web/src/lib/components/post/` | 버전 복원 확인 다이얼로그    |

#### 동작 흐름

1. 게시물 수정 저장 시 → 백엔드에서 자동으로 revision 생성
2. 게시물 상세 페이지 하단에 "수정 이력" 버튼 (작성자 + 관리자)
3. 이력 뷰어에서 버전 간 diff 비교
4. "이 버전으로 복원" 클릭 → 확인 다이얼로그 → 복원 API 호출

---

## 3. 스크랩 (북마크) 기능

### 3.1 데이터 모델

```typescript
export interface Scrap {
    id: number;
    post_id: number;
    board_id: string;
    user_id: string;
    memo?: string;
    created_at: string;
    post?: FreePost; // 조회 시 포함
}
```

### 3.2 백엔드 API 스펙

| Method   | Endpoint                              | 설명           | 권한   |
| -------- | ------------------------------------- | -------------- | ------ |
| `POST`   | `/api/v2/posts/{postId}/scrap`        | 스크랩 추가    | 로그인 |
| `DELETE` | `/api/v2/posts/{postId}/scrap`        | 스크랩 해제    | 로그인 |
| `GET`    | `/api/v2/my/scraps`                   | 내 스크랩 목록 | 로그인 |
| `GET`    | `/api/v2/posts/{postId}/scrap/status` | 스크랩 여부    | 로그인 |

**백엔드 DB 마이그레이션**:

```sql
CREATE TABLE scraps (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT NOT NULL,
    board_id VARCHAR(50) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    memo VARCHAR(500) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_user_post (user_id, post_id),
    INDEX idx_user_id (user_id),
    INDEX idx_post_id (post_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);
```

### 3.3 프론트엔드 구현

#### API 클라이언트 추가

```typescript
async scrapPost(postId: string, memo?: string): Promise<Scrap>
async unscrapPost(postId: string): Promise<void>
async getMyScraps(page?: number, limit?: number): Promise<PaginatedResponse<Scrap>>
async getScrapStatus(postId: string): Promise<{ scrapped: boolean }>
```

#### 컴포넌트

| 파일                  | 위치                                | 설명                               |
| --------------------- | ----------------------------------- | ---------------------------------- |
| `scrap-button.svelte` | `apps/web/src/lib/components/post/` | 스크랩 토글 버튼 (Bookmark 아이콘) |
| `+page.svelte`        | `apps/web/src/routes/my/scraps/`    | 내 스크랩 목록 페이지              |

#### 동작 흐름

1. 게시물 상세에서 Bookmark 아이콘 클릭 → 토글
2. `/my/scraps` 페이지에서 스크랩 목록 조회
3. 스크랩 메모 기능 (선택)

---

## 4. 게시판 그룹 관리

### 4.1 데이터 모델

```typescript
export interface BoardGroup {
    id: string;
    name: string;
    description?: string;
    sort_order: number;
    is_visible: boolean;
    boards?: Board[];
}
```

### 4.2 백엔드 API 스펙

| Method   | Endpoint                               | 설명                    | 권한   |
| -------- | -------------------------------------- | ----------------------- | ------ |
| `GET`    | `/api/v2/board-groups`                 | 그룹 목록 (게시판 포함) | 공개   |
| `POST`   | `/api/v2/admin/board-groups`           | 그룹 생성               | 관리자 |
| `PUT`    | `/api/v2/admin/board-groups/{groupId}` | 그룹 수정               | 관리자 |
| `DELETE` | `/api/v2/admin/board-groups/{groupId}` | 그룹 삭제               | 관리자 |
| `PATCH`  | `/api/v2/admin/board-groups/reorder`   | 그룹 순서 변경          | 관리자 |
| `PATCH`  | `/api/v2/admin/boards/{boardId}/group` | 게시판 그룹 변경        | 관리자 |

**백엔드 DB 마이그레이션**:

```sql
CREATE TABLE board_groups (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- boards 테이블에 group_id 이미 존재 (Board.group_id)
-- 필요 시 FK 추가
ALTER TABLE boards ADD FOREIGN KEY (group_id) REFERENCES board_groups(id);
```

### 4.3 프론트엔드 구현

#### 컴포넌트

| 파일                          | 위치                                   | 설명                        |
| ----------------------------- | -------------------------------------- | --------------------------- |
| `+page.svelte`                | `apps/admin/src/routes/board-groups/`  | Admin 게시판 그룹 CRUD      |
| `board-group-form.svelte`     | `apps/admin/src/lib/components/board/` | 그룹 생성/수정 폼           |
| `sidebar-board-groups.svelte` | `apps/web/src/lib/components/layout/`  | 사이드바 그룹별 게시판 표시 |

#### 동작 흐름

1. Admin에서 게시판 그룹 생성/수정/삭제/순서변경
2. 게시판을 그룹에 할당
3. 사용자 사이드바에서 그룹별로 게시판 묶어서 표시

---

## 5. 구현 순서

```
task-48: 소프트 삭제 코어
    ├── types.ts 확장 (deleted_at, deleted_by)
    ├── client.ts API 메서드 추가
    ├── deleted-post-banner.svelte
    ├── 기존 deletePost → softDeletePost 교체
    └── Admin 삭제 게시물 관리 페이지

task-49: 수정 이력 코어
    ├── PostRevision 타입 추가
    ├── client.ts API 메서드 추가
    ├── revision-history.svelte
    ├── revision-diff.svelte
    └── 게시물 상세에 이력 버튼 추가

task-50: 스크랩 기능
    ├── Scrap 타입 추가
    ├── client.ts API 메서드 추가
    ├── scrap-button.svelte
    └── /my/scraps 페이지

task-51: 게시판 그룹 관리
    ├── BoardGroup 타입 추가
    ├── Admin 그룹 CRUD 페이지
    └── 사이드바 그룹별 표시
```

---

## 6. Content History Plugin 마이그레이션

Phase 16 코어 기능 완성 후, `extensions/plugin-content-history/`는:

1. **hooks/soft-delete.ts** → 코어 `softDeletePost()` 사용으로 대체
2. **hooks/history-track.ts** → 코어 `post_revisions` 테이블 사용으로 대체
3. **hooks/content-filter.ts** → 코어의 `deleted_at` 기반 필터로 대체
4. **ui/history-viewer.svelte** → 코어 `revision-history.svelte`로 대체
5. **ui/deleted-banner.svelte** → 코어 `deleted-post-banner.svelte`로 대체

플러그인은 deprecated 처리하고, 코어 기능으로 안내.

---

## 7. QA 이슈 반영 (Phase 11-15에서 발견)

| 이슈                              | 해결 방안                             | 적용 시점             |
| --------------------------------- | ------------------------------------- | --------------------- |
| PluginSlot handleError 미연결     | ErrorBoundary 래퍼 추가               | Phase 16과 별도       |
| ALLOWED_EXTENSIONS 미적용         | validateZipEntries에서 검증 추가      | Phase 16과 별도       |
| Web 설정페이지 코드 중복          | PluginSettingsForm 공유 컴포넌트 사용 | Phase 16과 별도       |
| 마켓플레이스 GitHub 미연동        | 하드코딩 → API 연동                   | Phase 17 이후         |
| 다크모드 미지원 (plugin-slot 등)  | dark: 클래스 추가                     | Phase 16 구현 시 반영 |
| 접근성 미지원 (history-viewer 등) | role/aria 속성 추가                   | Phase 16 구현 시 반영 |
| history-track 인메모리 저장       | 코어 DB 연동으로 해결                 | task-49               |

---

**작성일**: 2026-02-01
**작성자**: Claude Code
**상태**: 설계 완료, 구현 대기
