<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import { Textarea } from '$lib/components/ui/textarea/index.js';
    import type { FreeComment } from '$lib/api/types.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import Pencil from '@lucide/svelte/icons/pencil';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import X from '@lucide/svelte/icons/x';
    import Check from '@lucide/svelte/icons/check';
    import Reply from '@lucide/svelte/icons/reply';
    import Lock from '@lucide/svelte/icons/lock';
    import Flag from '@lucide/svelte/icons/flag';
    import CommentForm from './comment-form.svelte';
    import { ReportDialog } from '$lib/components/features/report/index.js';
    import DOMPurify from 'dompurify';
    import { transformEmoticons } from '$lib/utils/content-transform.js';

    interface Props {
        comments: FreeComment[];
        onUpdate: (commentId: string, content: string) => Promise<void>;
        onDelete: (commentId: string) => Promise<void>;
        onReply?: (content: string, parentId: string | number, isSecret?: boolean) => Promise<void>;
        onLike?: (commentId: string) => Promise<{ likes: number; user_liked: boolean }>;
        onDislike?: (commentId: string) => Promise<{ dislikes: number; user_disliked: boolean }>;
        postAuthorId?: string; // 게시글 작성자 ID (비밀댓글 열람 권한 체크용)
        boardId?: string; // 신고 기능용
        postId?: number; // 신고 기능용
        useNogood?: boolean; // 비추천 기능 사용 여부 (게시판 설정)
    }

    let {
        comments,
        onUpdate,
        onDelete,
        onReply,
        onLike,
        onDislike,
        postAuthorId,
        boardId = 'free',
        postId = 0,
        useNogood = false
    }: Props = $props();

    // 댓글별 좋아요 상태 관리
    let likedComments = $state<Set<string>>(new Set());
    let commentLikes = $state<Map<string, number>>(new Map());
    let likingComment = $state<string | null>(null);

    // 댓글별 비추천 상태 관리
    let dislikedComments = $state<Set<string>>(new Set());
    let commentDislikes = $state<Map<string, number>>(new Map());
    let dislikingComment = $state<string | null>(null);

    // 수정 상태 관리
    let editingCommentId = $state<string | null>(null);
    let editContent = $state('');
    let isUpdating = $state(false);
    let isDeleting = $state<string | null>(null);

    // 답글 상태 관리
    let replyingToCommentId = $state<string | null>(null);
    let isReplying = $state(false);

    // 신고 상태 관리
    let reportingCommentId = $state<number | string | null>(null);
    let showReportDialog = $state(false);

    // 댓글 트리 구조로 변환
    const commentTree = $derived.by(() => {
        const map = new Map<string | number, FreeComment[]>();
        const roots: FreeComment[] = [];

        // 댓글이 루트인지 확인 (parent_id가 없거나, 0이거나, postId와 같으면 루트)
        const isRootComment = (parentId: string | number | null | undefined): boolean => {
            if (!parentId || parentId === 0 || parentId === '0') return true;
            // parent_id가 postId와 같으면 루트 댓글 (그누보드 호환)
            if (postId && (parentId === postId || String(parentId) === String(postId))) return true;
            return false;
        };

        // 모든 댓글을 ID로 매핑
        comments.forEach((comment) => {
            const parentId = comment.parent_id;
            if (isRootComment(parentId)) {
                roots.push(comment);
            } else {
                const children = map.get(parentId) || [];
                children.push(comment);
                map.set(parentId, children);
            }
        });

        // 재귀적으로 트리 구조 생성
        function buildTree(comment: FreeComment, depth: number): FreeComment[] {
            const children = map.get(comment.id) || [];
            const result: FreeComment[] = [{ ...comment, depth }];
            children.forEach((child) => {
                result.push(...buildTree(child, depth + 1));
            });
            return result;
        }

        const flatTree: FreeComment[] = [];
        roots.forEach((root) => {
            flatTree.push(...buildTree(root, 0));
        });

        return flatTree;
    });

    // 날짜 포맷 헬퍼
    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 작성자 확인
    function isCommentAuthor(comment: FreeComment): boolean {
        return (
            authStore.user?.mb_id === comment.author_id ||
            authStore.user?.mb_name === comment.author
        );
    }

    // 비밀댓글 열람 권한 확인 (작성자, 게시글 작성자, 관리자)
    function canViewSecretComment(comment: FreeComment): boolean {
        if (!comment.is_secret) return true;
        if (!authStore.user) return false;

        // 댓글 작성자
        if (isCommentAuthor(comment)) return true;

        // 게시글 작성자
        if (postAuthorId && authStore.user.mb_id === postAuthorId) return true;

        // 관리자 레벨 (예: 10 이상)
        if (authStore.user.mb_level >= 10) return true;

        return false;
    }

    // 수정 모드 시작
    function startEdit(comment: FreeComment): void {
        editingCommentId = String(comment.id);
        editContent = comment.content;
        replyingToCommentId = null; // 답글 모드 해제
    }

    // 수정 취소
    function cancelEdit(): void {
        editingCommentId = null;
        editContent = '';
    }

    // 수정 저장
    async function saveEdit(): Promise<void> {
        if (!editingCommentId || !editContent.trim()) return;

        isUpdating = true;
        try {
            await onUpdate(editingCommentId, editContent.trim());
            cancelEdit();
        } catch (err) {
            console.error('Failed to update comment:', err);
            alert('댓글 수정에 실패했습니다.');
        } finally {
            isUpdating = false;
        }
    }

    // 삭제 확인 및 처리
    async function handleDelete(commentId: string): Promise<void> {
        if (!confirm('댓글을 삭제하시겠습니까?')) return;

        isDeleting = commentId;
        try {
            await onDelete(commentId);
        } catch (err) {
            console.error('Failed to delete comment:', err);
            alert('댓글 삭제에 실패했습니다.');
        } finally {
            isDeleting = null;
        }
    }

    // 답글 모드 시작
    function startReply(comment: FreeComment): void {
        replyingToCommentId = String(comment.id);
        editingCommentId = null; // 수정 모드 해제
    }

    // 답글 취소
    function cancelReply(): void {
        replyingToCommentId = null;
    }

    // 답글 작성
    async function handleReply(content: string, parentId?: string | number): Promise<void> {
        if (!onReply || !parentId) return;

        isReplying = true;
        try {
            await onReply(content, parentId);
            cancelReply();
        } finally {
            isReplying = false;
        }
    }

    // 댓글 좋아요
    async function handleLikeComment(commentId: string): Promise<void> {
        if (!onLike || !authStore.isAuthenticated) return;

        likingComment = commentId;
        try {
            const response = await onLike(commentId);
            if (response.user_liked) {
                likedComments.add(commentId);
            } else {
                likedComments.delete(commentId);
            }
            likedComments = new Set(likedComments); // 반응성 트리거
            commentLikes.set(commentId, response.likes);
            commentLikes = new Map(commentLikes); // 반응성 트리거
        } catch (err) {
            console.error('Failed to like comment:', err);
        } finally {
            likingComment = null;
        }
    }

    // 댓글 좋아요 수 가져오기
    function getCommentLikes(comment: FreeComment): number {
        const customLikes = commentLikes.get(String(comment.id));
        return customLikes ?? comment.likes ?? 0;
    }

    // 댓글 좋아요 여부 확인
    function isCommentLiked(commentId: string): boolean {
        return likedComments.has(commentId);
    }

    // 댓글 비추천
    async function handleDislikeComment(commentId: string): Promise<void> {
        if (!onDislike || !authStore.isAuthenticated) return;

        dislikingComment = commentId;
        try {
            const response = await onDislike(commentId);
            if (response.user_disliked) {
                dislikedComments.add(commentId);
            } else {
                dislikedComments.delete(commentId);
            }
            dislikedComments = new Set(dislikedComments); // 반응성 트리거
            commentDislikes.set(commentId, response.dislikes);
            commentDislikes = new Map(commentDislikes); // 반응성 트리거
        } catch (err) {
            console.error('Failed to dislike comment:', err);
        } finally {
            dislikingComment = null;
        }
    }

    // 댓글 비추천 수 가져오기
    function getCommentDislikes(comment: FreeComment): number {
        const customDislikes = commentDislikes.get(String(comment.id));
        return customDislikes ?? comment.dislikes ?? 0;
    }

    // 댓글 비추천 여부 확인
    function isCommentDisliked(commentId: string): boolean {
        return dislikedComments.has(commentId);
    }

    // 댓글 신고
    function startReport(comment: FreeComment): void {
        if (!authStore.isAuthenticated) {
            authStore.redirectToLogin();
            return;
        }
        reportingCommentId = comment.id;
        showReportDialog = true;
    }

    // 댓글 내용 이모티콘 변환 + sanitize
    function renderCommentContent(content: string): string {
        const transformed = transformEmoticons(content);
        return DOMPurify.sanitize(transformed, {
            ALLOWED_TAGS: ['img'],
            ALLOWED_ATTR: ['src', 'width', 'alt', 'loading', 'class'],
            ALLOWED_URI_REGEXP: /^\/emoticons\//
        });
    }

    // 신고 다이얼로그 닫기
    function closeReportDialog(): void {
        showReportDialog = false;
        reportingCommentId = null;
    }
</script>

<ul class="space-y-4">
    {#each commentTree as comment (comment.id)}
        {@const isAuthor = isCommentAuthor(comment)}
        {@const isEditing = editingCommentId === String(comment.id)}
        {@const isReplyingTo = replyingToCommentId === String(comment.id)}
        {@const depth = comment.depth ?? 0}
        {@const isReply = depth > 0}
        <li style="margin-left: {depth * 1.25}rem" class="py-4 first:pt-0 last:pb-0">
            <div>
                <div class="mb-2 flex flex-wrap items-center gap-4">
                    <div class="flex items-center gap-2">
                        <div
                            class="bg-primary text-primary-foreground flex items-center justify-center rounded-full {isReply
                                ? 'size-8 text-sm'
                                : 'size-10'}"
                        >
                            {comment.author.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <p
                                class="text-foreground font-medium {isReply
                                    ? 'text-sm'
                                    : ''} flex items-center gap-1.5"
                            >
                                {comment.author}
                                {#if comment.is_secret}
                                    <Lock class="text-muted-foreground h-3.5 w-3.5" />
                                {/if}
                            </p>
                            <p class="text-secondary-foreground {isReply ? 'text-xs' : 'text-sm'}">
                                {formatDate(comment.created_at)}
                            </p>
                        </div>
                    </div>

                    <div class="text-secondary-foreground ml-auto flex items-center gap-4 text-sm">
                        <!-- 댓글 좋아요 버튼 -->
                        {#if onLike && authStore.isAuthenticated}
                            <button
                                type="button"
                                onclick={() => handleLikeComment(String(comment.id))}
                                disabled={likingComment === String(comment.id)}
                                class="flex items-center gap-1 transition-colors hover:text-red-500 {isCommentLiked(
                                    String(comment.id)
                                )
                                    ? 'text-red-500'
                                    : ''}"
                            >
                                <span>{isCommentLiked(String(comment.id)) ? '❤️' : '👍'}</span>
                                <span>{getCommentLikes(comment).toLocaleString()}</span>
                            </button>
                        {:else}
                            <span>👍 {getCommentLikes(comment).toLocaleString()}</span>
                        {/if}

                        <!-- 댓글 비추천 버튼 (게시판 설정에서 활성화된 경우만) -->
                        {#if useNogood}
                            {#if onDislike && authStore.isAuthenticated}
                                <button
                                    type="button"
                                    onclick={() => handleDislikeComment(String(comment.id))}
                                    disabled={dislikingComment === String(comment.id)}
                                    class="flex items-center gap-1 transition-colors hover:text-blue-500 {isCommentDisliked(
                                        String(comment.id)
                                    )
                                        ? 'text-blue-500'
                                        : ''}"
                                >
                                    <span>👎</span>
                                    <span>{getCommentDislikes(comment).toLocaleString()}</span>
                                </button>
                            {:else}
                                <span>👎 {getCommentDislikes(comment).toLocaleString()}</span>
                            {/if}
                        {/if}

                        {#if !isEditing}
                            <div class="flex gap-1">
                                <!-- 답글 버튼 -->
                                {#if onReply && authStore.isAuthenticated}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onclick={() => startReply(comment)}
                                        class="h-7 px-2"
                                        disabled={isReplyingTo}
                                    >
                                        <Reply class="h-4 w-4" />
                                        <span class="ml-1 text-xs">답글</span>
                                    </Button>
                                {/if}

                                {#if isAuthor}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onclick={() => startEdit(comment)}
                                        class="h-7 px-2"
                                    >
                                        <Pencil class="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onclick={() => handleDelete(String(comment.id))}
                                        disabled={isDeleting === String(comment.id)}
                                        class="text-destructive hover:text-destructive h-7 px-2"
                                    >
                                        <Trash2 class="h-4 w-4" />
                                    </Button>
                                {:else if authStore.isAuthenticated}
                                    <!-- 신고 버튼 (본인이 아닌 경우에만) -->
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onclick={() => startReport(comment)}
                                        class="text-muted-foreground hover:text-destructive h-7 px-2"
                                        title="신고"
                                    >
                                        <Flag class="h-4 w-4" />
                                    </Button>
                                {/if}
                            </div>
                        {/if}
                    </div>
                </div>

                {#if isEditing}
                    <!-- 수정 모드 -->
                    <div class="space-y-2">
                        <Textarea bind:value={editContent} rows={3} disabled={isUpdating} />
                        <div class="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onclick={cancelEdit}
                                disabled={isUpdating}
                            >
                                <X class="mr-1 h-4 w-4" />
                                취소
                            </Button>
                            <Button size="sm" onclick={saveEdit} disabled={isUpdating}>
                                <Check class="mr-1 h-4 w-4" />
                                {isUpdating ? '저장 중...' : '저장'}
                            </Button>
                        </div>
                    </div>
                {:else}
                    <!-- 일반 모드 -->
                    {#if comment.is_secret && !canViewSecretComment(comment)}
                        <div
                            class="text-muted-foreground flex items-center gap-2 italic {isReply
                                ? 'text-sm'
                                : ''}"
                        >
                            <Lock class="h-4 w-4" />
                            비밀댓글입니다.
                        </div>
                    {:else}
                        <div class="text-foreground whitespace-pre-wrap {isReply ? 'text-sm' : ''}">
                            {@html renderCommentContent(comment.content)}
                        </div>
                    {/if}
                {/if}

                <!-- 답글 폼 -->
                {#if isReplyingTo}
                    <div class="mt-4">
                        <CommentForm
                            onSubmit={handleReply}
                            onCancel={cancelReply}
                            parentId={comment.id}
                            parentAuthor={comment.author}
                            isReplyMode={true}
                            isLoading={isReplying}
                        />
                    </div>
                {/if}
            </div>
        </li>
    {:else}
        <li class="text-muted-foreground py-8 text-center">
            아직 댓글이 없습니다. 첫 댓글을 작성해보세요!
        </li>
    {/each}
</ul>

<!-- 댓글 신고 다이얼로그 -->
{#if reportingCommentId !== null}
    <ReportDialog
        bind:open={showReportDialog}
        targetType="comment"
        targetId={reportingCommentId}
        {boardId}
        {postId}
        onClose={closeReportDialog}
    />
{/if}
