<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import type { FreeComment } from '$lib/api/types.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import AuthorLink from '$lib/components/ui/author-link/author-link.svelte';
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
    import { memberLevelStore } from '$lib/stores/member-levels.svelte.js';
    import Reply from '@lucide/svelte/icons/reply';
    import Lock from '@lucide/svelte/icons/lock';
    import Flag from '@lucide/svelte/icons/flag';
    import Link2 from '@lucide/svelte/icons/link-2';
    import ExternalLink from '@lucide/svelte/icons/external-link';
    import Pencil from '@lucide/svelte/icons/pencil';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
    import CommentForm from './comment-form.svelte';
    import CommentToolbar from './comment-toolbar.svelte';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import { ReportDialog } from '$lib/components/features/report/index.js';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
    import { dompurify as DOMPurify } from '$lib/utils/dompurify.js';
    import { applyFilter } from '$lib/hooks/registry';
    import { getHookVersion } from '$lib/hooks/hook-state.svelte';
    import { onMount, tick } from 'svelte';
    import { highlightAllCodeBlocks } from '$lib/utils/code-highlight';
    import { attachLightbox } from '$lib/components/ui/image-lightbox/index.js';
    import { getAvatarUrl } from '$lib/utils/member-icon.js';
    import { SvelteMap, SvelteSet } from 'svelte/reactivity';
    import type { Component } from 'svelte';
    import { pluginStore } from '$lib/stores/plugin.svelte';
    import { loadPluginComponent, loadPluginLib } from '$lib/utils/plugin-optional-loader';
    import RevisionHistory from '$lib/components/post/revision-history.svelte';
    import type { PostRevision } from '$lib/api/types.js';
    import History from '@lucide/svelte/icons/history';
    import Heart from '@lucide/svelte/icons/heart';
    import { uiSettingsStore } from '$lib/stores/ui-settings.svelte.js';

    // 동적 플러그인 임포트: member-memo
    let MemoBadge = $state<Component | null>(null);
    let loadMemosForAuthors: ((authors: string[]) => void) | null = null;

    $effect(() => {
        if (pluginStore.isPluginActive('member-memo')) {
            loadPluginComponent('member-memo', 'memo-badge').then((c) => (MemoBadge = c));
            loadPluginLib<{ loadMemosForAuthors: (ids: string[]) => void }>(
                'member-memo',
                'memo-store'
            ).then((m) => {
                if (m) loadMemosForAuthors = m.loadMemosForAuthors;
            });
        }
    });
    import { highlightMentions } from '$lib/utils/mention-parser.js';
    import { formatDate } from '$lib/utils/format-date.js';
    import { ReactionBar } from '$lib/components/features/reaction/index.js';
    import type { ReactionItem } from '$lib/types/reaction.js';
    import CommentLikersDialog from './comment-likers-dialog.svelte';
    import { AvatarStack } from '$lib/components/ui/avatar-stack/index.js';
    import { apiClient } from '$lib/api/index.js';
    import type { LikerInfo } from '$lib/api/types.js';
    import { toast } from 'svelte-sonner';
    import { blockedUsersStore } from '$lib/stores/blocked-users.svelte';
    import EyeOff from '@lucide/svelte/icons/eye-off';

    interface Props {
        comments: FreeComment[];
        onUpdate: (commentId: string, content: string) => Promise<void>;
        onDelete: (commentId: string) => Promise<void>;
        onReply?: (
            content: string,
            parentId: string | number,
            isSecret?: boolean,
            images?: string[]
        ) => Promise<void>;
        onLike?: (commentId: string) => Promise<{ likes: number; user_liked: boolean }>;
        onDislike?: (commentId: string) => Promise<{ dislikes: number; user_disliked: boolean }>;
        onRestore?: (commentId: string) => Promise<void>;
        postAuthorId?: string; // 게시글 작성자 ID (비밀댓글 열람 권한 체크용)
        boardId?: string; // 신고 기능용
        postId?: number; // 신고 기능용
        useNogood?: boolean; // 비추천 기능 사용 여부 (게시판 설정)
        commentLayout?: string; // 댓글 레이아웃 (flat, bordered, divided, bubble, compact, muzia)
        reactionsMap?: Record<string, ReactionItem[]>; // 일괄 조회된 리액션 맵
        initialLikedCommentIds?: number[]; // SSR에서 전달된 좋아요한 댓글 ID 목록
        initialDislikedCommentIds?: number[]; // SSR에서 전달된 비추천한 댓글 ID 목록
        truthroomCommentMap?: Record<number, number>; // 잠긴 댓글 → 진실의방 글 ID 매핑
        isRestricted?: boolean; // 제한된 유저 (영구정지 등)
    }

    let {
        comments,
        onUpdate,
        onDelete,
        onReply,
        onLike,
        onDislike,
        onRestore,
        postAuthorId,
        boardId = 'free',
        postId = 0,
        useNogood = false,
        commentLayout = 'flat',
        reactionsMap,
        initialLikedCommentIds = [],
        initialDislikedCommentIds = [],
        truthroomCommentMap = {},
        isRestricted = false
    }: Props = $props();

    function findCommentById(commentId: string): FreeComment | null {
        return comments.find((item) => String(item.id) === commentId) ?? null;
    }

    // 플러그인 활성화 여부
    let memoPluginActive = $derived(pluginStore.isPluginActive('member-memo'));
    let reactionPluginActive = $derived(pluginStore.isPluginActive('da-reaction'));

    // 댓글별 좋아요 상태 관리 (SSR 스트리밍 데이터 반영)
    let likedComments = new SvelteSet<string>();
    let commentLikes = new SvelteMap<string, number>();
    let likingComment = $state<string | null>(null);
    let animatingComments = new SvelteSet<string>();

    // 댓글별 비추천 상태 관리 (SSR 스트리밍 데이터 반영)
    let dislikedComments = new SvelteSet<string>();
    let commentDislikes = new SvelteMap<string, number>();
    let dislikingComment = $state<string | null>(null);
    let likedSignature = '';
    let dislikedSignature = '';

    // SSR 스트리밍으로 좋아요/비추천 상태가 나중에 도착할 때 SvelteSet 업데이트
    $effect(() => {
        const signature = initialLikedCommentIds.join(',');
        if (likedSignature === signature) return;
        likedSignature = signature;
        likedComments = new SvelteSet(initialLikedCommentIds.map((id) => String(id)));
    });
    $effect(() => {
        const signature = initialDislikedCommentIds.join(',');
        if (dislikedSignature === signature) return;
        dislikedSignature = signature;
        dislikedComments = new SvelteSet(initialDislikedCommentIds.map((id) => String(id)));
    });

    // 댓글별 추천자 아바타 캐시
    let commentLikersList = new SvelteMap<string, LikerInfo[]>();
    let commentLikersTotal = new SvelteMap<string, number>();

    // 수정 상태 관리
    let editingCommentId = $state<string | null>(null);
    let editContent = $state('');
    let isUpdating = $state(false);
    let LazyCommentEditor = $state<Component | null>(null);
    let isDeleting = $state<string | null>(null);
    let isRestoring = $state<string | null>(null);

    // 수정 폼 이미지 업로드
    let editEditorRef = $state<any>(null);
    let editFileInputRef = $state<HTMLInputElement | null>(null);
    let editIsUploading = $state(false);
    let editUploadError = $state<string | null>(null);

    const EDIT_MAX_IMAGES = 3;
    const EDIT_MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

    async function editTriggerFileSelect(): Promise<void> {
        if (!LazyCommentEditor) {
            await ensureEditEditorLoaded();
        }
        if (editFileInputRef) editFileInputRef.value = '';
        editFileInputRef?.click();
    }

    function editInsertText(text: string): void {
        editEditorRef?.insertContent(text);
    }

    async function editHandleFiles(files: FileList | File[]): Promise<void> {
        if (!editEditorRef) {
            await ensureEditEditorLoaded();
            await tick();
        }
        const fileArray = Array.from(files);
        const insertedImageCount = editEditorRef?.getImageCount() ?? 0;
        const remaining = EDIT_MAX_IMAGES - insertedImageCount;
        if (remaining <= 0) {
            editUploadError = `이미지는 최대 ${EDIT_MAX_IMAGES}개까지 첨부할 수 있습니다.`;
            return;
        }

        const toUpload = fileArray.slice(0, remaining);

        for (const file of toUpload) {
            if (!file.type.startsWith('image/')) {
                editUploadError = '이미지 파일만 업로드할 수 있습니다.';
                continue;
            }
            if (file.size > EDIT_MAX_IMAGE_SIZE) {
                editUploadError = '이미지 크기는 10MB를 초과할 수 없습니다.';
                continue;
            }

            editIsUploading = true;
            editUploadError = null;
            try {
                const result = await apiClient.uploadImage(boardId, file);
                if (!result?.url) {
                    editUploadError = '이미지 URL을 받지 못했습니다.';
                    continue;
                }
                editEditorRef?.insertImage(result.url, '첨부 이미지');
            } catch (err) {
                editUploadError =
                    err instanceof Error ? err.message : '이미지 업로드에 실패했습니다.';
            } finally {
                editIsUploading = false;
            }
        }
    }

    function editHandleFileChange(e: Event): void {
        const input = e.currentTarget as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            editHandleFiles(input.files);
        }
    }

    function getCommentLinkRel(
        isAffiliate?: boolean
    ): 'nofollow noopener sponsored' | 'noopener noreferrer' {
        return isAffiliate ? 'nofollow noopener sponsored' : 'noopener noreferrer';
    }

    // 댓글 리비전 이력 상태 (관리자 전용)
    let revisionCommentId = $state<string | null>(null);
    let commentRevisions = $state<PostRevision[]>([]);
    let loadingRevisions = $state(false);

    async function toggleCommentRevisions(commentId: string): Promise<void> {
        if (revisionCommentId === commentId) {
            revisionCommentId = null;
            commentRevisions = [];
            return;
        }
        revisionCommentId = commentId;
        loadingRevisions = true;
        try {
            commentRevisions = await apiClient.getCommentRevisions(
                boardId,
                String(postId),
                commentId
            );
        } catch {
            commentRevisions = [];
        } finally {
            loadingRevisions = false;
        }
    }

    // 답글 상태 관리
    let replyingToCommentId = $state<string | null>(null);
    let isReplying = $state(false);

    // 신고 상태 관리
    let reportingCommentId = $state<number | string | null>(null);
    let showReportDialog = $state(false);

    // 신고자 정보 (관리자만)

    // 댓글 주소 복사
    async function copyCommentLink(commentId: number | string): Promise<void> {
        const url = `${window.location.origin}${window.location.pathname}#c_${commentId}`;
        try {
            await navigator.clipboard.writeText(url);
            toast.success('댓글 주소가 복사되었습니다.');
        } catch {
            toast.error('주소 복사에 실패했습니다.');
        }
    }

    // 추천자 목록 다이얼로그 상태
    let showLikersDialog = $state(false);
    let likersCommentId = $state<number | string | null>(null);

    function openLikersDialog(commentId: number | string): void {
        likersCommentId = commentId;
        showLikersDialog = true;
    }

    function closeLikersDialog(): void {
        showLikersDialog = false;
        likersCommentId = null;
    }

    // 댓글 트리 구조로 변환
    const commentTree = $derived.by(() => {
        // 그누보드 호환: API에서 이미 depth 값을 제공하면 그대로 사용
        // (depth 0 = 루트, 1 = 첫 번째 대댓글, 2 = 대대댓글 ...)
        const hasApiDepth = comments.some((c) => typeof c.depth === 'number' && c.depth > 0);
        if (hasApiDepth) {
            return comments.map((c) => ({
                ...c,
                depth: c.depth ?? 0
            }));
        }

        // parent_id 기반 트리 구조 (새 API용)
        const map = new SvelteMap<string | number, FreeComment[]>();
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

    // 차단 유저 댓글 펼침 상태
    let expandedBlockedComments = new SvelteSet<string>();

    function isBlockedComment(comment: FreeComment): boolean {
        return blockedUsersStore.isBlocked(comment.author_id);
    }

    function toggleBlockedComment(commentId: string): void {
        if (expandedBlockedComments.has(commentId)) {
            expandedBlockedComments.delete(commentId);
        } else {
            expandedBlockedComments.add(commentId);
        }
    }

    // 작성자 확인
    function isCommentAuthor(comment: FreeComment): boolean {
        return (
            authStore.user?.mb_id === comment.author_id ||
            authStore.user?.mb_name === comment.author
        );
    }

    // 댓글에 대댓글(답글)이 달려있는지 확인
    function hasReplies(comment: FreeComment): boolean {
        const commentId = String(comment.id);
        // parent_id 기반: 다른 댓글이 이 댓글을 부모로 갖는지 확인
        const hasChildByParent = comments.some(
            (c) => String(c.parent_id) === commentId && String(c.id) !== commentId
        );
        if (hasChildByParent) return true;

        // depth 기반 (그누보드 호환): commentTree에서 바로 다음 댓글의 depth가 더 크면 답글 있음
        const idx = commentTree.findIndex((c) => String(c.id) === commentId);
        if (idx >= 0 && idx + 1 < commentTree.length) {
            const currentDepth = commentTree[idx].depth ?? 0;
            const nextDepth = commentTree[idx + 1].depth ?? 0;
            if (nextDepth > currentDepth) return true;
        }
        return false;
    }

    // 관리자 여부
    function isAdmin(): boolean {
        return (authStore.user?.mb_level ?? 0) >= 10;
    }

    // 댓글 수정/삭제 권한 (작성자 또는 관리자, 대댓글이 달린 댓글은 작성자도 수정 불가)
    function canEditComment(comment: FreeComment): boolean {
        if (!authStore.user) return false;
        if (isAdmin()) return true;
        if (hasReplies(comment)) return false;
        return isCommentAuthor(comment);
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

    let editEditorLoadPromise: Promise<void> | null = null;

    function ensureEditEditorLoaded(): Promise<void> {
        if (LazyCommentEditor) return Promise.resolve();
        if (editEditorLoadPromise) return editEditorLoadPromise;
        editEditorLoadPromise = import('./comment-editor.svelte').then((m) => {
            LazyCommentEditor = m.default;
        });
        return editEditorLoadPromise;
    }

    // 수정 모드 시작
    function startEdit(comment: FreeComment): void {
        const target = commentTree.find((c) => c.id === comment.id) ?? comment;
        editingCommentId = String(target.id);
        editContent = target.content;
        replyingToCommentId = null;
        ensureEditEditorLoaded();
    }

    // 수정 취소
    function cancelEdit(): void {
        editingCommentId = null;
        editContent = '';
        editUploadError = null;
        editEditorRef = null;
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

    async function handleRestore(commentId: string): Promise<void> {
        if (!onRestore) return;
        if (!confirm('이 댓글을 복구하시겠습니까?')) return;

        isRestoring = commentId;
        try {
            await onRestore(commentId);
            toast.success('댓글이 복구되었습니다.');
        } catch (err) {
            console.error('Failed to restore comment:', err);
            toast.error('댓글 복구에 실패했습니다.');
        } finally {
            isRestoring = null;
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
    async function handleReply(
        content: string,
        parentId?: string | number,
        isSecret?: boolean,
        images?: string[]
    ): Promise<void> {
        if (!onReply || !parentId) return;

        isReplying = true;
        try {
            await onReply(content, parentId, isSecret, images);
            cancelReply();
        } finally {
            isReplying = false;
        }
    }

    // 댓글 좋아요
    async function handleLikeComment(commentId: string): Promise<void> {
        if (!onLike || !authStore.isAuthenticated) {
            toast.error('로그인이 필요합니다.');
            return;
        }

        const wasLiked = likedComments.has(commentId);
        const previousLikes = commentLikes.get(commentId) ?? findCommentById(commentId)?.likes ?? 0;

        likingComment = commentId;
        try {
            likedComments[wasLiked ? 'delete' : 'add'](commentId);
            commentLikes.set(commentId, Math.max(previousLikes + (wasLiked ? -1 : 1), 0));

            const response = await onLike(commentId);
            if (response.user_liked) {
                likedComments.add(commentId);
                // 좋아요 애니메이션 트리거
                animatingComments.add(commentId);
                setTimeout(() => animatingComments.delete(commentId), 1000);
            } else {
                likedComments.delete(commentId);
            }
            commentLikes.set(commentId, response.likes);
            // 아바타 스택 갱신
            loadCommentLikerAvatarsBatch([commentId]);
        } catch (err) {
            if (wasLiked) {
                likedComments.add(commentId);
            } else {
                likedComments.delete(commentId);
            }
            commentLikes.set(commentId, previousLikes);
            const msg = err instanceof Error ? err.message : '댓글 공감에 실패했습니다.';
            toast.error(msg);
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
        if (!onDislike || !authStore.isAuthenticated) {
            toast.error('로그인이 필요합니다.');
            return;
        }

        dislikingComment = commentId;
        try {
            const response = await onDislike(commentId);
            if (response.user_disliked) {
                dislikedComments.add(commentId);
            } else {
                dislikedComments.delete(commentId);
            }
            commentDislikes.set(commentId, response.dislikes);
        } catch (err) {
            const msg = err instanceof Error ? err.message : '댓글 비공감에 실패했습니다.';
            toast.error(msg);
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
        if (isRestricted) return;
        reportingCommentId = comment.id;
        showReportDialog = true;
    }

    // URL 텍스트를 자동 하이퍼링크로 변환
    // HTML 태그 내부의 URL (src="...", href="..." 등)은 건드리지 않음
    // 다모앙 내부 링크는 현재창, 외부 링크는 새창
    function autoLinkUrls(html: string): string {
        // 모든 HTML 태그를 분리하여 텍스트 노드에서만 URL 변환
        const parts = html.split(/(<[^>]+>)/g);
        let insideAnchor = false;
        return parts
            .map((part) => {
                if (part.startsWith('<')) {
                    // <a> 태그 진입/탈출 추적 (서버에서 이미 변환된 어필리에이트 링크 보존)
                    if (/^<a[\s>]/i.test(part)) insideAnchor = true;
                    if (/^<\/a>/i.test(part)) insideAnchor = false;
                    return part;
                }
                // <a> 태그 내부 텍스트는 건너뜀 (중첩 <a> 방지)
                if (insideAnchor) return part;
                // 텍스트 노드에서만 URL 패턴 매칭 (http/https)
                return part.replace(/(https?:\/\/[^\s<>"']+)/gi, (url) => {
                    const isDamoang = /damoang\.net/i.test(url);
                    if (isDamoang) {
                        return `<a href="${url}" class="text-primary hover:underline">${url}</a>`;
                    }
                    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">${url}</a>`;
                });
            })
            .join('');
    }

    // SSR 안전 HTML 이스케이프 (플러그인 필터 적용 전 기본 텍스트 표시용)
    function escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/\n/g, '<br>');
    }

    // 처리된 댓글 HTML 저장
    let processedComments = new SvelteMap<string | number, string>();

    // SSR용: 산화된 댓글 내용 (플러그인 필터 없이 즉시 렌더링)
    // TipTap 에디터로 작성된 댓글은 <p>, <strong> 등 HTML 태그를 포함하므로
    // escapeHtml 대신 DOMPurify로 산화하여 안전한 태그는 보존
    const ssrCommentHtml = $derived.by(() => {
        const map = new Map<string | number, string>();
        for (const comment of commentTree) {
            if (!comment.content) {
                map.set(comment.id, '');
                continue;
            }
            const withBr = comment.content.replace(/\n/g, '<br>');
            map.set(
                comment.id,
                DOMPurify.sanitize(withBr, {
                    ALLOWED_TAGS: [
                        'p',
                        'img',
                        'br',
                        'div',
                        'blockquote',
                        'a',
                        'span',
                        'pre',
                        'code',
                        'strong',
                        'em',
                        'del',
                        'details',
                        'summary'
                    ],
                    ALLOWED_ATTR: [
                        'src',
                        'width',
                        'alt',
                        'loading',
                        'class',
                        'height',
                        'href',
                        'target',
                        'rel',
                        'data-affiliate',
                        'data-original'
                    ]
                })
            );
        }
        return map;
    });

    // 댓글 내용 비동기 처리 (플러그인 필터 적용)
    $effect(() => {
        // hookVersion을 읽어서 hook 등록 시 $effect 재실행
        const _hv = getHookVersion();

        for (const comment of commentTree) {
            const raw = comment.content;
            if (!raw) {
                processedComments.set(comment.id, '');
                continue;
            }
            void (async () => {
                const withBr = raw.replace(/\n/g, '<br>');
                const filtered = await applyFilter<string>('comment_content', withBr);
                // @멘션을 클릭 가능한 링크로 변환
                const withMentions = highlightMentions(filtered);
                // URL 텍스트를 자동 하이퍼링크로 변환
                const withLinks = autoLinkUrls(withMentions);
                processedComments.set(
                    comment.id,
                    DOMPurify.sanitize(withLinks, {
                        ALLOWED_TAGS: [
                            'p',
                            'img',
                            'br',
                            'div',
                            'iframe',
                            'video',
                            'audio',
                            'source',
                            'blockquote',
                            'a',
                            'span',
                            'pre',
                            'code',
                            'strong',
                            'em',
                            'del',
                            'details',
                            'summary'
                        ],
                        ALLOWED_ATTR: [
                            'src',
                            'width',
                            'alt',
                            'loading',
                            'class',
                            'height',
                            'style',
                            'data-platform',
                            'data-bluesky-uri',
                            'data-bluesky-cid',
                            'data-embed-height',
                            'frameborder',
                            'allow',
                            'allowfullscreen',
                            'allowtransparency',
                            'scrolling',
                            'referrerpolicy',
                            'type',
                            'controls',
                            'title',
                            'href',
                            'target',
                            'rel',
                            'data-mention',
                            'data-affiliate',
                            'data-original'
                        ]
                    })
                );
            })();
        }
    });

    // 코드 블록 구문 하이라이팅 (댓글 렌더링 완료 후 적용)
    let commentListEl: HTMLElement;
    $effect(() => {
        // processedComments 변경 감지
        void processedComments.size;
        if (commentListEl) {
            tick().then(() => highlightAllCodeBlocks(commentListEl));
        }
    });

    // 댓글 이미지 라이트박스 연결 (이모티콘 제외)
    $effect(() => {
        if (commentListEl) {
            return attachLightbox(commentListEl);
        }
    });

    // 댓글 본문 이미지 data-original 폴백 (최적화된 이미지 로드 실패 시 원본으로 대체)
    $effect(() => {
        void processedComments.size;
        if (commentListEl) {
            tick().then(() => {
                const imgs = commentListEl.querySelectorAll<HTMLImageElement>('img[data-original]');
                imgs.forEach((img) => {
                    const fallback = () => {
                        const original = img.getAttribute('data-original');
                        if (original && img.src !== original) {
                            img.src = original;
                        }
                    };
                    img.onerror = fallback;
                    // SSR 이미지가 hydration 전에 이미 에러난 경우 처리
                    if (img.complete && img.naturalWidth === 0) {
                        fallback();
                    }
                });
            });
        }
    });

    // 회원 메모 배치 프리로드
    $effect(() => {
        if (
            authStore.isAuthenticated &&
            memoPluginActive &&
            loadMemosForAuthors &&
            commentTree.length > 0
        ) {
            const fn = loadMemosForAuthors;
            const ids = [...new Set(commentTree.map((c) => c.author_id).filter(Boolean))];
            if (ids.length > 0) {
                void fn(ids);
            }
        }
    });

    // 신고 다이얼로그 닫기
    function closeReportDialog(): void {
        showReportDialog = false;
        reportingCommentId = null;
    }

    // 댓글 추천자 아바타 배치 로드
    async function loadCommentLikerAvatarsBatch(commentIds: string[]): Promise<void> {
        if (!boardId || !postId || commentIds.length === 0) return;
        try {
            const result = await apiClient.getCommentLikersBatch(
                boardId,
                String(postId),
                commentIds,
                5
            );
            for (const [commentId, data] of Object.entries(result)) {
                commentLikersList.set(commentId, data.likers);
                commentLikersTotal.set(commentId, data.total);
            }
        } catch (err) {
            console.error('Failed to load comment liker avatars:', err);
        }
    }

    // 좋아요 > 0인 댓글의 아바타 배치 로드 (댓글 추가 시 미로드 분만 재요청)
    let likerAvatarsLoadedIds = new SvelteSet<string>();
    $effect(() => {
        if (commentTree.length === 0 || !boardId || !postId) return;

        const commentsWithLikes = commentTree.filter(
            (c) => (c.likes ?? 0) > 0 && !likerAvatarsLoadedIds.has(String(c.id))
        );

        if (commentsWithLikes.length > 0) {
            const ids = commentsWithLikes.map((c) => String(c.id));
            for (const id of ids) likerAvatarsLoadedIds.add(id);
            loadCommentLikerAvatarsBatch(ids);
        }
    });
</script>

<ul
    bind:this={commentListEl}
    class={commentLayout === 'chat'
        ? 'space-y-0.5'
        : commentLayout === 'discussion'
          ? 'space-y-0'
          : commentLayout === 'compact'
            ? 'space-y-1'
            : commentLayout === 'feed'
              ? 'space-y-0.5'
              : commentLayout === 'card'
                ? 'bg-card divide-y overflow-hidden rounded-lg border shadow-sm'
                : commentLayout === 'muzia'
                  ? ''
                  : commentLayout === 'bordered' || commentLayout === 'bubble'
                    ? 'space-y-2'
                    : 'space-y-3'}
>
    {#each commentTree as comment, commentIndex (comment.id)}
        {@const isDeleted = !!comment.deleted_at}
        {@const isBlocked = isBlockedComment(comment)}
        {@const isAuthor = isCommentAuthor(comment)}
        {@const canEdit = !isDeleted && canEditComment(comment)}
        {@const isEditing = editingCommentId === String(comment.id)}
        {@const isReplyingTo = replyingToCommentId === String(comment.id)}
        {@const depth = comment.depth ?? 0}
        {@const isReply = depth > 0}
        {@const replyToAuthor = isReply
            ? (() => {
                  for (let i = commentIndex - 1; i >= 0; i--) {
                      const prev = commentTree[i];
                      if ((prev.depth ?? 0) < depth) return prev.author;
                  }
                  return null;
              })()
            : null}
        {@const isDiscussion = commentLayout === 'discussion'}
        {@const isFeed = commentLayout === 'feed'}
        {@const iconUrl = isDeleted
            ? null
            : getAvatarUrl(
                  (comment as FreeComment & { author_image?: string }).author_image,
                  (comment as FreeComment & { author_image_updated_at?: string })
                      .author_image_updated_at
              )}

        <!-- 차단된 사용자 댓글 (접힌 상태) -->
        {#if isBlocked && !expandedBlockedComments.has(String(comment.id))}
            <li
                id="c_{comment.id}"
                style="margin-left: {Math.min(depth, 2) * 1}rem"
                class="py-2 {isReply &&
                commentLayout !== 'bordered' &&
                commentLayout !== 'bubble' &&
                commentLayout !== 'chat'
                    ? isDiscussion
                        ? 'border-border/50 border-l-2 pl-4'
                        : isFeed
                          ? 'border-border/40 border-l pl-3'
                          : 'border-border/60 border-l-2 pl-3'
                    : ''}"
            >
                <button
                    onclick={() => toggleBlockedComment(String(comment.id))}
                    class="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs transition-colors"
                >
                    <EyeOff class="h-3.5 w-3.5" />
                    차단된 사용자의 댓글입니다
                </button>
            </li>
        {:else}
            <!-- 댓글 5개마다 GAM 인피드 광고 (루트 댓글 기준, 첫 번째 제외) -->
            {#if widgetLayoutStore.hasEnabledAds && commentIndex > 0 && commentIndex % 5 === 0 && depth === 0}
                <li class="list-none py-2">
                    <AdSlot
                        position="comment-infeed"
                        height="90px"
                        slotKey={`comment-infeed-${comment.id}`}
                    />
                </li>
            {/if}
            <li
                id="c_{comment.id}"
                style="margin-left: {Math.min(depth, 2) * 1}rem; scroll-margin-top: 100px"
                class="comment-item {commentLayout === 'muzia'
                    ? ''
                    : 'overflow-hidden'} transition-colors duration-200
                {commentLayout === 'chat'
                    ? 'flex items-start gap-2.5' + (isAuthor ? ' flex-row-reverse' : '')
                    : isDiscussion
                      ? 'border-border/70 border-b py-4 last:border-b-0'
                      : isFeed
                        ? 'py-2.5'
                        : commentLayout === 'bordered'
                          ? 'bg-card/80 border-border/70 rounded-lg border p-3 dark:bg-white/[0.03]'
                          : commentLayout === 'divided'
                            ? 'border-border border-b py-3 last:border-b-0'
                            : commentLayout === 'bubble'
                              ? isAuthor
                                  ? 'bg-primary/10 rounded-xl rounded-br-sm p-4'
                                  : 'bg-muted rounded-xl rounded-bl-sm p-4'
                              : commentLayout === 'card'
                                ? 'p-4'
                                : commentLayout === 'muzia'
                                  ? 'muzia-comment border-border px-1 py-3'
                                  : commentLayout === 'compact'
                                    ? 'py-1.5'
                                    : 'py-3 first:pt-0 last:pb-0'}
                {isReply &&
                commentLayout !== 'bordered' &&
                commentLayout !== 'bubble' &&
                commentLayout !== 'chat'
                    ? isDiscussion
                        ? 'border-border/50 border-l-2 pl-4'
                        : isFeed
                          ? 'border-border/40 border-l pl-3'
                          : 'border-border/60 border-l-2 pl-3'
                    : isReply && commentLayout === 'bordered'
                      ? 'border-border/60 border-l-2'
                      : ''}"
            >
                <!-- 차단된 사용자 댓글 (펼쳐진 상태) — 접기 버튼 -->
                {#if isBlocked}
                    <button
                        onclick={() => toggleBlockedComment(String(comment.id))}
                        class="text-muted-foreground hover:text-foreground mb-1 flex items-center gap-1.5 text-xs transition-colors"
                    >
                        <EyeOff class="h-3.5 w-3.5" />
                        차단된 사용자의 댓글 — 접기
                    </button>
                {/if}

                <!-- Chat: 사이드 아바타 -->
                {#if commentLayout === 'chat'}
                    {#if iconUrl}
                        <img
                            src={iconUrl}
                            alt=""
                            class="size-8 shrink-0 rounded-full object-cover"
                            onerror={(e) => {
                                const img = e.currentTarget as HTMLImageElement;
                                img.style.display = 'none';
                            }}
                        />
                    {:else}
                        <div
                            class="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs"
                        >
                            {comment.author.charAt(0).toUpperCase()}
                        </div>
                    {/if}
                {/if}

                <div class={commentLayout === 'chat' ? 'min-w-0 max-w-[80%]' : 'min-w-0'}>
                    <!-- Chat: 이름 라벨 + 메모 + IP (타인 댓글만) -->
                    {#if commentLayout === 'chat' && !isAuthor && !isDeleted}
                        <p
                            class="text-foreground mb-1 ml-1 flex items-center gap-1 text-xs font-semibold"
                        >
                            <AuthorLink authorId={comment.author_id} authorName={comment.author} />
                            <LevelBadge level={memberLevelStore.getLevel(comment.author_id)} />
                            {#if postAuthorId && comment.author_id === postAuthorId}
                                <span
                                    class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                                    >작성자</span
                                >
                            {/if}
                            {#if authStore.isAuthenticated && memoPluginActive && MemoBadge && !uiSettingsStore.hideMemo}
                                <MemoBadge
                                    memberId={comment.author_id}
                                    showIcon={true}
                                    blur={uiSettingsStore.blurMemo}
                                />
                            {/if}
                            {#if comment.author_ip}
                                <span class="text-muted-foreground font-normal"
                                    >· {comment.author_ip}</span
                                >
                            {/if}
                        </p>
                    {/if}

                    <!-- Chat: 버블 래퍼 (비채팅은 투명) -->
                    <div
                        class={commentLayout === 'chat'
                            ? isDeleted
                                ? 'bg-muted/50 rounded-xl px-3.5 py-2.5'
                                : isAuthor
                                  ? 'bg-primary/10 rounded-xl rounded-br-sm px-3.5 py-2.5'
                                  : 'bg-muted rounded-xl rounded-bl-sm px-3.5 py-2.5'
                            : ''}
                    >
                        <div
                            class="{commentLayout === 'chat'
                                ? 'hidden'
                                : isFeed || commentLayout === 'bordered'
                                  ? 'mb-1'
                                  : 'mb-1.5'} flex flex-wrap items-start gap-1 sm:gap-1.5"
                        >
                            <!-- 존1: 정체성 (아바타 + 이름/레벨/메모/잠금 + 날짜/IP/수정이력) -->
                            <div class="flex items-start gap-2">
                                {#if iconUrl}
                                    <img
                                        src={iconUrl}
                                        alt={comment.author}
                                        class="mt-0.5 rounded-full object-cover {isFeed
                                            ? isReply
                                                ? 'size-6'
                                                : 'size-7'
                                            : isReply
                                              ? 'size-7'
                                              : 'size-8'}"
                                        onerror={(e) => {
                                            const img = e.currentTarget as HTMLImageElement;
                                            img.style.display = 'none';
                                            const fallback = img.nextElementSibling as HTMLElement;
                                            if (fallback) fallback.style.display = 'flex';
                                        }}
                                    />
                                    <div
                                        class="bg-primary text-primary-foreground mt-0.5 hidden items-center justify-center rounded-full {isFeed
                                            ? isReply
                                                ? 'size-6 text-[10px]'
                                                : 'size-7 text-xs'
                                            : isReply
                                              ? 'size-7 text-xs'
                                              : 'size-8 text-sm'}"
                                    >
                                        {comment.author.charAt(0).toUpperCase()}
                                    </div>
                                {:else}
                                    <div
                                        class="bg-primary text-primary-foreground mt-0.5 flex items-center justify-center rounded-full {isFeed
                                            ? isReply
                                                ? 'size-6 text-[10px]'
                                                : 'size-7 text-xs'
                                            : isReply
                                              ? 'size-7 text-xs'
                                              : 'size-8 text-sm'}"
                                    >
                                        {comment.author.charAt(0).toUpperCase()}
                                    </div>
                                {/if}
                                <div>
                                    <p
                                        class="text-foreground flex items-center gap-1.5 {isFeed
                                            ? 'text-[13px]'
                                            : 'text-sm'} font-medium"
                                    >
                                        <AuthorLink
                                            authorId={comment.author_id}
                                            authorName={comment.author}
                                        />
                                        <LevelBadge
                                            level={memberLevelStore.getLevel(comment.author_id)}
                                        />
                                        {#if replyToAuthor}
                                            <span class="text-muted-foreground text-xs font-normal"
                                                >→ {replyToAuthor}</span
                                            >
                                        {/if}
                                        {#if postAuthorId && comment.author_id === postAuthorId}
                                            <span
                                                class="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                                                >작성자</span
                                            >
                                        {/if}
                                        {#if authStore.isAuthenticated && !isDeleted && memoPluginActive && MemoBadge && !uiSettingsStore.hideMemo}
                                            <MemoBadge
                                                memberId={comment.author_id}
                                                showIcon={true}
                                                blur={uiSettingsStore.blurMemo}
                                            />
                                        {/if}
                                        {#if comment.is_secret}
                                            <Lock class="text-muted-foreground h-3.5 w-3.5" />
                                        {/if}
                                    </p>
                                    <p
                                        class="text-muted-foreground flex items-center gap-1 {isFeed
                                            ? 'text-[11px]'
                                            : 'text-xs'}"
                                    >
                                        {formatDate(comment.created_at)}
                                        {#if comment.author_ip}
                                            <span>· {comment.author_ip}</span>
                                        {/if}
                                        {#if comment.edit_count && comment.edit_count > 0 && comment.updated_at && new Date(comment.updated_at).getTime() - new Date(comment.created_at).getTime() > 5 * 60 * 1000}
                                            <span
                                                class="text-muted-foreground/70"
                                                title={comment.updated_at
                                                    ? `최종 수정: ${formatDate(comment.updated_at)}`
                                                    : ''}
                                            >
                                                · 수정됨 ({comment.edit_count}회)
                                            </span>
                                        {/if}
                                    </p>
                                </div>
                            </div>

                            <!-- 신고 배지 -->
                            {#if comment.report_count === 'lock'}
                                <span
                                    class="text-destructive bg-destructive/10 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
                                >
                                    <Lock class="h-3 w-3" />
                                    신고잠금
                                </span>
                                {#if truthroomCommentMap[Number(comment.id)]}
                                    <a
                                        href="/truthroom/{truthroomCommentMap[Number(comment.id)]}"
                                        class="bg-muted text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors"
                                    >
                                        진실의방 보기
                                    </a>
                                {/if}
                            {/if}

                            <!-- 존2: 액션 (좋아요/비추천/답글/링크복사/수정/삭제/신고) -->
                            {#if isDeleted}
                                <!-- 삭제된 댓글: 버튼 없음 -->
                            {:else}
                                <!-- 리액션 (da-reaction 플러그인) — 따봉 옆 배치 -->
                                {#if reactionPluginActive && !isEditing && boardId && postId && boardId !== 'claim'}
                                    <div class="ml-auto">
                                        <ReactionBar
                                            {boardId}
                                            {postId}
                                            commentId={comment.id}
                                            target="comment"
                                            initialReactions={reactionsMap?.[
                                                `comment:${boardId}:${comment.id}`
                                            ]}
                                        />
                                    </div>
                                {/if}
                                <!-- 댓글 좋아요 버튼 -->
                                <div
                                    class="comment-good-group {reactionPluginActive
                                        ? ''
                                        : 'ml-auto'} flex items-center {isFeed ? 'gap-1' : 'gap-2'}"
                                >
                                    {#if onLike && authStore.isAuthenticated && boardId !== 'claim'}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onclick={() => handleLikeComment(String(comment.id))}
                                            disabled={likingComment === String(comment.id)}
                                            class={isFeed
                                                ? 'h-7 gap-1.5 px-2'
                                                : commentLayout === 'bordered'
                                                  ? 'h-7 gap-1.5 px-2.5'
                                                  : 'h-8 gap-2 px-3'}
                                        >
                                            <Heart
                                                class="{isFeed
                                                    ? 'h-4 w-4'
                                                    : 'h-5 w-5'} {isCommentLiked(String(comment.id))
                                                    ? 'fill-liked text-liked'
                                                    : ''} {animatingComments.has(String(comment.id))
                                                    ? 'like-animation'
                                                    : ''}"
                                            />
                                            <span class="font-semibold"
                                                >{getCommentLikes(comment).toLocaleString()}</span
                                            >
                                        </Button>
                                    {:else}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onclick={() => {
                                                if (onLike) {
                                                    authStore.redirectToLogin();
                                                } else {
                                                    openLikersDialog(comment.id);
                                                }
                                            }}
                                            class={isFeed
                                                ? 'h-7 gap-1.5 px-2'
                                                : commentLayout === 'bordered'
                                                  ? 'h-7 gap-1.5 px-2.5'
                                                  : 'h-8 gap-2 px-3'}
                                        >
                                            <Heart class={isFeed ? 'h-4 w-4' : 'h-5 w-5'} />
                                            <span class="font-semibold"
                                                >{getCommentLikes(comment).toLocaleString()}</span
                                            >
                                        </Button>
                                    {/if}
                                </div>

                                <!-- 댓글 추천자 아바타 스택 -->
                                {#if getCommentLikes(comment) > 0 && commentLikersList.has(String(comment.id))}
                                    <AvatarStack
                                        items={commentLikersList.get(String(comment.id)) ?? []}
                                        total={commentLikersTotal.get(String(comment.id)) ?? 0}
                                        max={5}
                                        size="sm"
                                        onclick={() => {
                                            openLikersDialog(comment.id);
                                        }}
                                    />
                                {/if}

                                <!-- 액션 버튼 -->
                                <div class="text-muted-foreground flex items-center gap-1 text-sm">
                                    {#if !isDeleted && !isEditing}
                                        <div class="flex gap-1">
                                            <!-- 답글 버튼 -->
                                            {#if onReply && authStore.isAuthenticated}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onclick={() => startReply(comment)}
                                                    class={isFeed
                                                        ? 'h-6 px-1.5'
                                                        : commentLayout === 'bordered'
                                                          ? 'h-6 px-1.5'
                                                          : 'h-7 px-2'}
                                                    disabled={isReplyingTo}
                                                >
                                                    <Reply class="h-3.5 w-3.5" />
                                                    <span class="ml-1 hidden text-xs sm:inline"
                                                        >답글</span
                                                    >
                                                </Button>
                                            {/if}

                                            <!-- 링크 복사 버튼 -->
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onclick={() => copyCommentLink(comment.id)}
                                                class="comment-action-secondary {isFeed
                                                    ? 'h-6 px-1.5'
                                                    : commentLayout === 'bordered'
                                                      ? 'h-6 px-1.5'
                                                      : 'h-7 px-1.5'} opacity-50 transition-opacity hover:opacity-90"
                                                title="이 댓글의 링크를 복사합니다"
                                            >
                                                <Link2 class="h-3.5 w-3.5" />
                                                <span class="ml-1 hidden text-xs sm:inline"
                                                    >링크복사</span
                                                >
                                            </Button>

                                            {#if canEdit}
                                                <!-- 수정/삭제 버튼 (작성자 또는 최고관리자) -->
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onclick={() => startEdit(comment)}
                                                    class="comment-action-secondary {isFeed
                                                        ? 'h-6 px-1.5'
                                                        : commentLayout === 'bordered'
                                                          ? 'h-6 px-1.5'
                                                          : 'h-7 px-2'} opacity-50 transition-opacity hover:opacity-90"
                                                >
                                                    <Pencil class="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onclick={() => handleDelete(String(comment.id))}
                                                    disabled={isDeleting === String(comment.id)}
                                                    class="comment-action-secondary text-destructive hover:text-destructive {isFeed
                                                        ? 'h-6 px-1.5'
                                                        : commentLayout === 'bordered'
                                                          ? 'h-6 px-1.5'
                                                          : 'h-7 px-2'} opacity-50 transition-opacity hover:opacity-90"
                                                >
                                                    <Trash2 class="h-4 w-4" />
                                                </Button>
                                            {/if}
                                            {#if !isAuthor && authStore.isAuthenticated}
                                                <!-- 신고 버튼 (본인이 아닌 경우에만) -->
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onclick={() => startReport(comment)}
                                                    class="comment-action-secondary text-muted-foreground hover:text-destructive {isFeed
                                                        ? 'h-6 px-1.5'
                                                        : commentLayout === 'bordered'
                                                          ? 'h-6 px-1.5'
                                                          : 'h-7 px-2'} opacity-50 transition-opacity hover:opacity-90"
                                                    title="신고"
                                                >
                                                    <Flag class="h-4 w-4" />
                                                    <span class="ml-1 text-xs">신고</span>
                                                </Button>
                                            {/if}
                                        </div>
                                    {/if}
                                </div>
                            {/if}
                        </div>

                        <!-- 댓글 본문 또는 수정 폼 -->
                        {#if comment.deleted_at}
                            <!-- 삭제된 댓글 표시 -->
                            <div
                                class="text-muted-foreground flex items-center gap-2 text-base italic opacity-60"
                            >
                                <Trash2 class="h-4 w-4" />
                                삭제된 댓글입니다.
                            </div>
                        {:else if isEditing}
                            <!-- 댓글 수정 폼 -->
                            <div class="mt-2 space-y-3">
                                {#if LazyCommentEditor}
                                    <LazyCommentEditor
                                        bind:this={editEditorRef}
                                        content={editContent}
                                        onUpdate={(html: string) => {
                                            editContent = html;
                                        }}
                                        onImagePaste={(file: File) => editHandleFiles([file])}
                                        placeholder="댓글을 입력하세요..."
                                        disabled={isUpdating}
                                    />
                                {:else}
                                    <div
                                        class="border-border bg-background min-h-24 animate-pulse rounded-lg border p-3"
                                    ></div>
                                {/if}

                                {#if editIsUploading}
                                    <div
                                        class="text-muted-foreground flex items-center gap-2 text-sm"
                                    >
                                        <Loader2 class="h-4 w-4 animate-spin" />
                                        <span>이미지 업로드 중...</span>
                                    </div>
                                {/if}

                                <div class="flex flex-wrap items-center gap-1">
                                    <CommentToolbar
                                        onInsertText={editInsertText}
                                        onSelectImage={editTriggerFileSelect}
                                        onInsertEmoticon={(filename) => {
                                            editEditorRef?.insertImage(
                                                `/emoticons/${filename}`,
                                                filename
                                            );
                                        }}
                                        disabled={isUpdating}
                                        {boardId}
                                    />

                                    <div class="ml-auto flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onclick={cancelEdit}
                                            disabled={isUpdating}
                                        >
                                            취소
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            onclick={saveEdit}
                                            disabled={isUpdating || !editContent.trim()}
                                        >
                                            {isUpdating ? '저장 중...' : '저장'}
                                        </Button>
                                    </div>
                                </div>

                                {#if editUploadError}
                                    <p class="text-destructive text-sm">{editUploadError}</p>
                                {/if}

                                <input
                                    bind:this={editFileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,.heic,.heif"
                                    multiple
                                    class="hidden"
                                    onchange={editHandleFileChange}
                                />
                            </div>
                        {:else if comment.is_secret && !canViewSecretComment(comment)}
                            <div
                                class="text-muted-foreground flex items-center gap-2 text-base italic"
                            >
                                <Lock class="h-4 w-4" />
                                비밀댓글입니다.
                            </div>
                        {:else}
                            <div
                                class="comment-body text-foreground overflow-hidden whitespace-pre-wrap break-words {isFeed
                                    ? 'leading-snug'
                                    : commentLayout === 'bordered'
                                      ? 'leading-snug'
                                      : 'leading-normal'}"
                                style="font-size: var(--comment-font-size, 1rem);"
                            >
                                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                                {@html processedComments.get(comment.id) ??
                                    ssrCommentHtml.get(comment.id) ??
                                    ''}
                            </div>
                            {#if comment.link1 || comment.link2}
                                <div class="mt-3 space-y-1.5">
                                    {#if comment.link1}
                                        <div class="flex items-center gap-1.5 text-sm">
                                            <ExternalLink
                                                class="text-muted-foreground h-3.5 w-3.5 shrink-0"
                                            />
                                            <a
                                                href={comment.link1}
                                                target="_blank"
                                                rel={getCommentLinkRel(comment.link1_affiliate)}
                                                class="text-primary truncate hover:underline"
                                                >{comment.link1_display || comment.link1}</a
                                            >
                                        </div>
                                    {/if}
                                    {#if comment.link2}
                                        <div class="flex items-center gap-1.5 text-sm">
                                            <ExternalLink
                                                class="text-muted-foreground h-3.5 w-3.5 shrink-0"
                                            />
                                            <a
                                                href={comment.link2}
                                                target="_blank"
                                                rel={getCommentLinkRel(comment.link2_affiliate)}
                                                class="text-primary truncate hover:underline"
                                                >{comment.link2_display || comment.link2}</a
                                            >
                                        </div>
                                    {/if}
                                </div>
                            {/if}
                        {/if}

                        <!-- 댓글 수정이력 (관리자 전용) -->
                        {#if revisionCommentId === String(comment.id)}
                            <div class="mt-3">
                                {#if loadingRevisions}
                                    <p class="text-muted-foreground text-sm">수정이력 로딩 중...</p>
                                {:else if commentRevisions.length > 0}
                                    <RevisionHistory
                                        revisions={commentRevisions}
                                        isAdmin={false}
                                        canRestore={false}
                                    />
                                {:else}
                                    <p class="text-muted-foreground text-sm">
                                        수정이력이 없습니다.
                                    </p>
                                {/if}
                            </div>
                        {/if}

                        <!-- Chat: 시간 + IP (버블 안 우하단) -->
                        {#if commentLayout === 'chat' && !isDeleted && !isEditing}
                            <p class="mt-1.5 text-right">
                                <span class="text-muted-foreground/70 text-xs">
                                    {formatDate(comment.created_at)}
                                    {#if comment.author_ip}
                                        · {comment.author_ip}
                                    {/if}
                                </span>
                            </p>
                        {/if}

                        <!-- Chat: 신고 배지 (버블 안) -->
                        {#if commentLayout === 'chat' && !isDeleted}
                            {#if comment.report_count === 'lock'}
                                <span
                                    class="bg-destructive/10 text-destructive mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium"
                                >
                                    <Lock class="h-3 w-3" />
                                    신고잠금
                                </span>
                                {#if truthroomCommentMap[Number(comment.id)]}
                                    <a
                                        href="/truthroom/{truthroomCommentMap[Number(comment.id)]}"
                                        class="bg-muted text-muted-foreground hover:text-foreground mt-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors"
                                    >
                                        진실의방 보기
                                    </a>
                                {/if}
                            {/if}
                        {/if}
                    </div>
                    <!-- 버블 래퍼 닫기 -->

                    <!-- Chat: 컴팩트 액션 (버블 아래) -->
                    {#if commentLayout === 'chat' && !isDeleted && !isEditing}
                        <div
                            class="mt-1 flex items-center gap-0.5 px-0.5 {isAuthor
                                ? 'flex-row-reverse'
                                : ''}"
                        >
                            <!-- 추천 -->
                            {#if onLike && authStore.isAuthenticated && boardId !== 'claim'}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onclick={() => handleLikeComment(String(comment.id))}
                                    disabled={likingComment === String(comment.id)}
                                    class="h-6 gap-1 px-1.5 text-xs"
                                >
                                    <Heart
                                        class="h-3.5 w-3.5 {isCommentLiked(String(comment.id))
                                            ? 'fill-liked text-liked'
                                            : ''} {animatingComments.has(String(comment.id))
                                            ? 'like-animation'
                                            : ''}"
                                    />
                                    <span class="font-semibold"
                                        >{getCommentLikes(comment).toLocaleString()}</span
                                    >
                                </Button>
                            {:else}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onclick={() => {
                                        if (onLike) {
                                            authStore.redirectToLogin();
                                        } else {
                                            openLikersDialog(comment.id);
                                        }
                                    }}
                                    class="h-6 gap-1 px-1.5 text-xs"
                                >
                                    <Heart class="h-3.5 w-3.5" />
                                    <span class="font-semibold"
                                        >{getCommentLikes(comment).toLocaleString()}</span
                                    >
                                </Button>
                            {/if}

                            <!-- 댓글 추천자 아바타 스택 -->
                            {#if getCommentLikes(comment) > 0 && commentLikersList.has(String(comment.id))}
                                <AvatarStack
                                    items={commentLikersList.get(String(comment.id)) ?? []}
                                    total={commentLikersTotal.get(String(comment.id)) ?? 0}
                                    max={5}
                                    size="sm"
                                    onclick={() => {
                                        openLikersDialog(comment.id);
                                    }}
                                />
                            {/if}

                            <!-- 답글 -->
                            {#if onReply && authStore.isAuthenticated}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onclick={() => startReply(comment)}
                                    class="h-6 px-1.5"
                                    disabled={isReplyingTo}
                                >
                                    <Reply class="h-3.5 w-3.5" />
                                </Button>
                            {/if}

                            <!-- 링크 복사 -->
                            <Button
                                variant="ghost"
                                size="sm"
                                onclick={() => copyCommentLink(comment.id)}
                                class="h-6 px-1.5"
                                title="이 댓글의 링크를 복사합니다"
                            >
                                <Link2 class="h-3.5 w-3.5" />
                            </Button>

                            <!-- 리액션 (da-reaction 플러그인) -->
                            {#if reactionPluginActive && boardId && postId && boardId !== 'claim'}
                                <ReactionBar
                                    {boardId}
                                    {postId}
                                    commentId={comment.id}
                                    target="comment"
                                    initialReactions={reactionsMap?.[
                                        `comment:${boardId}:${comment.id}`
                                    ]}
                                />
                            {/if}

                            {#if canEdit}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onclick={() => startEdit(comment)}
                                    class="h-6 px-1.5"
                                >
                                    <Pencil class="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onclick={() => handleDelete(String(comment.id))}
                                    disabled={isDeleting === String(comment.id)}
                                    class="text-destructive hover:text-destructive h-6 px-1.5"
                                >
                                    <Trash2 class="h-3.5 w-3.5" />
                                </Button>
                            {/if}

                            <!-- 신고 버튼 (본인이 아닌 경우) -->
                            {#if !isAuthor && authStore.isAuthenticated}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onclick={() => startReport(comment)}
                                    class="text-muted-foreground hover:text-destructive h-6 px-1.5"
                                    title="신고"
                                >
                                    <Flag class="h-3.5 w-3.5" />
                                </Button>
                            {/if}
                        </div>
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
                                {boardId}
                            />
                        </div>
                    {/if}
                </div>
            </li>
        {/if}
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

<!-- 댓글 추천자 목록 다이얼로그 -->
{#if likersCommentId !== null && boardId && postId}
    <CommentLikersDialog
        bind:open={showLikersDialog}
        {boardId}
        {postId}
        commentId={likersCommentId}
        onClose={closeLikersDialog}
    />
{/if}

<style>
    /* 댓글 내 임베드 컨테이너 스타일 */
    :global(.embed-container) {
        position: relative;
        width: 100%;
        max-width: var(--max-width, 100%);
        margin: 0.75rem 0;
        overflow: hidden;
    }

    :global(.embed-container)::before {
        content: '';
        display: block;
        padding-bottom: var(--aspect-ratio, 56.25%);
    }

    :global(.embed-container iframe),
    :global(.embed-container video),
    :global(.embed-container audio) {
        position: absolute;
        top: 0;
        left: 0;
        display: block;
        width: 100% !important;
        height: 100% !important;
        max-width: 100% !important;
        border: 0;
        border-radius: 0.375rem;
    }

    /* 세로 영상 */
    :global(.embed-container[data-platform='youtube-shorts']),
    :global(.embed-container[data-platform='instagram-reel']),
    :global(.embed-container[data-platform='tiktok']) {
        margin-left: auto;
        margin-right: auto;
    }

    /* Twitter 가변 높이 */
    :global(.embed-container[data-platform='twitter']) {
        height: var(--twitter-embed-height, auto);
        padding-bottom: 0 !important;
        min-height: 200px;
        overflow: visible;
    }

    :global(.embed-container[data-platform='twitter'])::before {
        display: none !important;
        padding-bottom: 0 !important;
    }

    :global(.embed-container[data-platform='twitter'] iframe) {
        position: relative !important;
        display: block !important;
        width: 100% !important;
        max-width: 100% !important;
        min-height: var(--twitter-embed-height, 200px);
        height: var(--twitter-embed-height, auto) !important;
    }

    /* Instagram 가변 높이 */
    :global(.embed-container[data-platform='instagram']),
    :global(.embed-container[data-platform='instagram-reel']) {
        min-height: 400px;
        overflow: visible;
    }

    :global(.embed-container[data-platform='instagram'])::before,
    :global(.embed-container[data-platform='instagram-reel'])::before {
        display: none !important;
        padding-bottom: 0 !important;
    }

    :global(.embed-container[data-platform='instagram'] iframe),
    :global(.embed-container[data-platform='instagram-reel'] iframe) {
        position: relative;
        display: block;
        min-height: 400px;
        height: auto !important;
    }

    /* Bluesky 가변 높이 */
    :global(.embed-container[data-platform='bluesky']) {
        min-height: 200px;
        overflow: visible;
    }

    :global(.embed-container[data-platform='bluesky'])::before {
        display: none !important;
        padding-bottom: 0 !important;
    }

    :global(.embed-container[data-platform='bluesky'] iframe) {
        position: relative;
        display: block;
        min-height: 200px;
        height: auto !important;
    }

    /* Reddit 가변 높이 */
    :global(.embed-container[data-platform='reddit']) {
        min-height: 300px;
        overflow: visible;
    }

    :global(.embed-container[data-platform='reddit'])::before {
        display: none !important;
        padding-bottom: 0 !important;
    }

    :global(.embed-container[data-platform='reddit'] iframe) {
        position: relative;
        display: block;
        min-height: 300px;
        height: auto !important;
    }

    /* 댓글 밀도 설정 (--comment-pad-extra CSS 변수로 제어) */
    .comment-item {
        padding-top: calc(var(--comment-pad-extra, 3px) + 0.75rem);
        padding-bottom: calc(var(--comment-pad-extra, 3px) + 0.75rem);
    }
    .comment-item:first-child {
        padding-top: calc(var(--comment-pad-extra, 3px));
    }
    .comment-item:last-child {
        padding-bottom: calc(var(--comment-pad-extra, 3px) + 0.75rem);
    }

    /* 긴 URL 레이아웃 깨짐 방지 */
    :global(.comment-body) {
        overflow-wrap: anywhere;
        word-break: break-word;
    }
    :global(.comment-body a) {
        overflow-wrap: anywhere;
        word-break: break-all;
    }

    /* 댓글 본문 문단 간격 */
    :global(.comment-body p) {
        margin-bottom: 0.6em;
    }
    :global(.comment-body p:last-child) {
        margin-bottom: 0;
    }
    :global(.comment-body p + p) {
        margin-top: 0.75em;
    }

    /* 댓글 코드 블록 스타일 (게시글 본문 .prose와 동일) */
    :global(.comment-body pre) {
        background-color: var(--muted);
        padding: 1rem;
        border-radius: 0.5rem;
        overflow-x: auto;
        margin: 0.5em 0;
        white-space: pre;
    }
    :global(.comment-body pre code) {
        font-size: 0.875rem;
        line-height: 1.6;
        background-color: transparent;
    }
    :global(.comment-body > code) {
        background-color: var(--muted);
        padding: 0.15em 0.4em;
        border-radius: 0.25rem;
        font-size: 0.875em;
    }

    /* 댓글 이탤릭/인용문 */
    :global(.comment-body em) {
        font-style: italic;
        font-synthesis: style;
    }
    :global(.comment-body blockquote) {
        border-left: 4px solid var(--border);
        padding-left: 1rem;
        margin: 0.5em 0;
        color: var(--muted-foreground);
        font-style: italic;
        font-synthesis: style;
    }

    /* 연속 줄바꿈 간격 축소 */
    :global(.comment-body br + br) {
        display: block;
        content: '';
        margin-top: 0.3em;
    }

    /* 모바일에서 secondary 액션 버튼 더 dim */
    @media (max-width: 767px) {
        :global(.comment-action-secondary) {
            opacity: 0.3 !important;
        }
        :global(.comment-action-secondary:hover),
        :global(.comment-action-secondary:active) {
            opacity: 0.8 !important;
        }
    }

    /* 액션 버튼 그룹 간격 */
    .comment-item :global(.comment-good-group) {
        gap: 0;
    }

    /* 대괄호 이미지 스타일 */
    :global(.bracket-image) {
        max-width: 100%;
        height: auto;
        border-radius: 0.375rem;
        margin: 0.5rem 0;
        display: block;
    }

    /* 이미지 로딩 실패 시 숨김 처리 */
    :global(.bracket-image[src='']) {
        display: none;
    }

    /* 댓글 스포일러 블록 */
    :global(.comment-body .spoiler-block) {
        border: 1px solid var(--border);
        border-radius: 0.375rem;
        margin: 0.5em 0;
        overflow: hidden;
    }
    :global(.comment-body .spoiler-block summary) {
        cursor: pointer;
        padding: 0.375rem 0.625rem;
        background-color: var(--muted);
        font-weight: 500;
        font-size: 0.8125rem;
        color: var(--muted-foreground);
        user-select: none;
        list-style: none;
        display: flex;
        align-items: center;
        gap: 0.375rem;
    }
    :global(.comment-body .spoiler-block summary::-webkit-details-marker) {
        display: none;
    }
    :global(.comment-body .spoiler-block summary::before) {
        content: '▶';
        font-size: 0.5625rem;
        transition: transform 0.2s;
    }
    :global(.comment-body .spoiler-block[open] summary::before) {
        transform: rotate(90deg);
    }
    :global(.comment-body .spoiler-content) {
        padding: 0.5rem 0.625rem;
    }

    /* 좋아요 버튼 애니메이션 */
    @keyframes da-thumbs-up {
        0% {
            transform: scale(1) translateX(0) rotate(0deg) translateY(0);
        }
        40% {
            transform: scale(1.2) translateX(-1px) rotate(-19deg) translateY(-4px);
        }
        85% {
            transform: scale(1) translateX(0) rotate(3deg) translateY(1px);
        }
        100% {
            transform: scale(1) translateX(0) rotate(0deg) translateY(0);
        }
    }

    :global(.like-animation) {
        animation: da-thumbs-up 1s ease-in-out;
    }

    :global(.muzia-comment) {
        border-bottom: 1px solid var(--border) !important;
    }
    :global(.muzia-comment:last-child) {
        border-bottom: none !important;
    }
</style>
