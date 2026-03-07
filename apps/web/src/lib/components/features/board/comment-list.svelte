<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import type { FreeComment } from '$lib/api/types.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import AuthorLink from '$lib/components/ui/author-link/author-link.svelte';
    import Reply from '@lucide/svelte/icons/reply';
    import Lock from '@lucide/svelte/icons/lock';
    import Flag from '@lucide/svelte/icons/flag';
    import Link2 from '@lucide/svelte/icons/link-2';
    import Pencil from '@lucide/svelte/icons/pencil';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import CommentForm from './comment-form.svelte';
    import { ReportDialog } from '$lib/components/features/report/index.js';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
    import DOMPurify from 'dompurify';
    import { applyFilter } from '$lib/hooks/registry';
    import { getHookVersion } from '$lib/hooks/hook-state.svelte';
    import { tick } from 'svelte';
    import { highlightAllCodeBlocks } from '$lib/utils/code-highlight';
    import { getAvatarUrl, getMemberIconUrl } from '$lib/utils/member-icon.js';
    import { SvelteMap, SvelteSet } from 'svelte/reactivity';
    import type { Component } from 'svelte';
    import { pluginStore } from '$lib/stores/plugin.svelte';
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
    import { loadPluginComponent, loadPluginLib } from '$lib/utils/plugin-optional-loader';
    import RevisionHistory from '$lib/components/post/revision-history.svelte';
    import type { PostRevision } from '$lib/api/types.js';
    import History from '@lucide/svelte/icons/history';

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
    import { memberLevelStore } from '$lib/stores/member-levels.svelte.js';
    import { highlightMentions } from '$lib/utils/mention-parser.js';
    import { formatDate } from '$lib/utils/format-date.js';
    import { ReactionBar } from '$lib/components/features/reaction/index.js';
    import type { ReactionItem } from '$lib/types/reaction.js';
    import CommentLikersDialog from './comment-likers-dialog.svelte';
    import { AvatarStack } from '$lib/components/ui/avatar-stack/index.js';
    import { apiClient } from '$lib/api/index.js';
    import type { LikerInfo, CommentReportInfo } from '$lib/api/types.js';
    import { toast } from 'svelte-sonner';

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
        postAuthorId?: string; // 게시글 작성자 ID (비밀댓글 열람 권한 체크용)
        boardId?: string; // 신고 기능용
        postId?: number; // 신고 기능용
        useNogood?: boolean; // 비추천 기능 사용 여부 (게시판 설정)
        commentLayout?: string; // 댓글 레이아웃 (flat, bordered, divided, bubble, compact)
        reactionsMap?: Record<string, ReactionItem[]>; // 일괄 조회된 리액션 맵
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
        useNogood = false,
        commentLayout = 'flat',
        reactionsMap
    }: Props = $props();

    // 플러그인 활성화 여부
    let memoPluginActive = $derived(pluginStore.isPluginActive('member-memo'));
    let reactionPluginActive = $derived(pluginStore.isPluginActive('da-reaction'));

    // 댓글별 좋아요 상태 관리
    let likedComments = new SvelteSet<string>();
    let commentLikes = new SvelteMap<string, number>();
    let likingComment = $state<string | null>(null);

    // 댓글별 비추천 상태 관리
    let dislikedComments = new SvelteSet<string>();
    let commentDislikes = new SvelteMap<string, number>();
    let dislikingComment = $state<string | null>(null);

    // 댓글별 추천자 아바타 캐시
    let commentLikersList = new SvelteMap<string, LikerInfo[]>();
    let commentLikersTotal = new SvelteMap<string, number>();

    // 수정 상태 관리
    let editingCommentId = $state<string | null>(null);
    let editContent = $state('');
    let isUpdating = $state(false);
    let isDeleting = $state<string | null>(null);

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
    let commentReports = $state(new SvelteMap<string, CommentReportInfo[]>());

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

    // 작성자 확인
    function isCommentAuthor(comment: FreeComment): boolean {
        return (
            authStore.user?.mb_id === comment.author_id ||
            authStore.user?.mb_name === comment.author
        );
    }

    // 최고관리자 여부 (레벨 10 이상)
    function isSuperAdmin(): boolean {
        return (authStore.user?.mb_level ?? 0) >= 10;
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

    // 댓글 수정 권한 (작성자 또는 최고관리자, 대댓글이 달린 댓글은 수정 불가)
    function canEditComment(comment: FreeComment): boolean {
        if (!authStore.user) return false;
        // 대댓글이 달려있으면 수정 불가 (관리자도 불가)
        if (hasReplies(comment)) return false;
        return isCommentAuthor(comment) || isSuperAdmin();
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
        // commentTree에서 ID로 명시적 조회 (클로저 안전)
        const target = commentTree.find((c) => c.id === comment.id) ?? comment;
        editingCommentId = String(target.id);
        editContent = target.content;
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

        likingComment = commentId;
        try {
            const response = await onLike(commentId);
            if (response.user_liked) {
                likedComments.add(commentId);
            } else {
                likedComments.delete(commentId);
            }
            commentLikes.set(commentId, response.likes);
            // 아바타 스택 갱신
            loadCommentLikerAvatars(commentId);
        } catch (err) {
            const msg = err instanceof Error ? err.message : '댓글 추천에 실패했습니다.';
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
            const msg = err instanceof Error ? err.message : '댓글 비추천에 실패했습니다.';
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
        reportingCommentId = comment.id;
        showReportDialog = true;
    }

    // URL 텍스트를 자동 하이퍼링크로 변환
    // HTML 태그 내부의 URL (src="...", href="..." 등)은 건드리지 않음
    // 다모앙 내부 링크는 현재창, 외부 링크는 새창
    function autoLinkUrls(html: string): string {
        // 모든 HTML 태그를 분리하여 텍스트 노드에서만 URL 변환
        const parts = html.split(/(<[^>]+>)/g);
        return parts
            .map((part) => {
                // HTML 태그이면 건드리지 않음 (<a>, <img>, <div> 등 모든 태그)
                if (part.startsWith('<')) return part;
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

    // SSR용: 기본 이스케이프된 댓글 내용 (플러그인 필터 없이 즉시 렌더링)
    const ssrCommentHtml = $derived.by(() => {
        const map = new Map<string | number, string>();
        for (const comment of commentTree) {
            map.set(comment.id, comment.content ? escapeHtml(comment.content) : '');
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
                            'del'
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
                            'data-mention'
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

    // 회원 메모 배치 프리로드
    $effect(() => {
        if (memoPluginActive && loadMemosForAuthors && commentTree.length > 0) {
            const fn = loadMemosForAuthors;
            const ids = [...new Set(commentTree.map((c) => c.author_id).filter(Boolean))];
            if (ids.length > 0) {
                void fn(ids);
            }
        }
    });

    // 회원 레벨 배치 프리로드
    $effect(() => {
        if (commentTree.length > 0) {
            const ids = [...new Set(commentTree.map((c) => c.author_id).filter(Boolean))];
            if (ids.length > 0) {
                void memberLevelStore.fetchLevels(ids);
            }
        }
    });

    // 신고 다이얼로그 닫기
    function closeReportDialog(): void {
        showReportDialog = false;
        reportingCommentId = null;
    }

    // 댓글 추천자 아바타 로드
    async function loadCommentLikerAvatars(commentId: string): Promise<void> {
        if (!boardId || !postId) return;
        try {
            const response = await apiClient.getCommentLikers(
                boardId,
                String(postId),
                commentId,
                1,
                5
            );
            commentLikersList.set(commentId, response.likers);
            commentLikersTotal.set(commentId, response.total);
        } catch (err) {
            console.error('Failed to load comment liker avatars:', err);
        }
    }

    // 관리자: 댓글 신고 내역 배치 로드
    let reportsLoaded = $state(false);
    $effect(() => {
        if (reportsLoaded || !boardId || !postId || commentTree.length === 0) return;
        if (!authStore.user || authStore.user.mb_level < 10) return;

        reportsLoaded = true;
        apiClient.getCommentReports(boardId, postId).then((reports) => {
            const map = new SvelteMap<string, CommentReportInfo[]>();
            for (const r of reports) {
                const key = String(r.comment_id);
                const list = map.get(key) ?? [];
                list.push(r);
                map.set(key, list);
            }
            commentReports = map;
        });
    });

    // 좋아요 > 0인 댓글의 아바타 배치 로드 (최대 10개)
    let likerAvatarsLoaded = $state(false);
    $effect(() => {
        if (likerAvatarsLoaded || commentTree.length === 0 || !boardId || !postId) return;

        const commentsWithLikes = commentTree.filter((c) => (c.likes ?? 0) > 0).slice(0, 10);

        if (commentsWithLikes.length > 0) {
            likerAvatarsLoaded = true;
            for (const c of commentsWithLikes) {
                loadCommentLikerAvatars(String(c.id));
            }
        }
    });
</script>

<ul
    bind:this={commentListEl}
    class={commentLayout === 'compact'
        ? 'space-y-1'
        : commentLayout === 'bordered' || commentLayout === 'bubble' || commentLayout === 'chat'
          ? 'space-y-2'
          : 'space-y-3'}
>
    {#each commentTree as comment, commentIndex (comment.id)}
        {@const isDeleted = !!comment.deleted_at}
        {@const isAuthor = isCommentAuthor(comment)}
        {@const canEdit = !isDeleted && canEditComment(comment)}
        {@const isEditing = editingCommentId === String(comment.id)}
        {@const isReplyingTo = replyingToCommentId === String(comment.id)}
        {@const depth = comment.depth ?? 0}
        {@const isReply = depth > 0}
        {@const iconUrl = isDeleted ? null : getMemberIconUrl(comment.author_id)}

        <!-- 댓글 5개마다 GAM 인피드 광고 (루트 댓글 기준, 첫 번째 제외) -->
        {#if widgetLayoutStore.hasEnabledAds && commentIndex > 0 && commentIndex % 5 === 0 && depth === 0}
            <li class="list-none py-2">
                <AdSlot position="comment-infeed" height="90px" />
            </li>
        {/if}
        <li
            id="c_{comment.id}"
            style="margin-left: {Math.min(depth, 2) * 1}rem; scroll-margin-top: 100px"
            class="comment-item transition-colors duration-200
                {commentLayout === 'chat'
                ? 'flex items-start gap-2.5' + (isAuthor ? ' flex-row-reverse' : '')
                : commentLayout === 'bordered'
                  ? 'bg-card rounded-lg border border-black/[0.06] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:border-white/[0.08] dark:bg-white/[0.05] dark:shadow-none'
                  : commentLayout === 'divided'
                    ? 'border-border border-b py-3 last:border-b-0'
                    : commentLayout === 'bubble'
                      ? isAuthor
                          ? 'bg-primary/10 rounded-xl rounded-br-sm p-4'
                          : 'bg-muted rounded-xl rounded-bl-sm p-4'
                      : commentLayout === 'compact'
                        ? 'py-1.5'
                        : 'py-3 first:pt-0 last:pb-0'}
                {isReply &&
            commentLayout !== 'bordered' &&
            commentLayout !== 'bubble' &&
            commentLayout !== 'chat'
                ? 'border-border/60 border-l-2 pl-3'
                : isReply && commentLayout === 'bordered'
                  ? 'border-border/60 border-l-2'
                  : ''}"
        >
            <!-- Chat: 사이드 아바타 -->
            {#if commentLayout === 'chat'}
                {#if iconUrl}
                    <img src={iconUrl} alt="" class="size-8 shrink-0 rounded-full object-cover" />
                {:else}
                    <div
                        class="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs"
                    >
                        {comment.author.charAt(0).toUpperCase()}
                    </div>
                {/if}
            {/if}

            <div class={commentLayout === 'chat' ? 'min-w-0 max-w-[80%]' : ''}>
                <!-- Chat: 이름 라벨 (타인 댓글만) -->
                {#if commentLayout === 'chat' && !isAuthor && !isDeleted}
                    <p class="text-foreground mb-1 ml-1 text-xs font-semibold">
                        <AuthorLink authorId={comment.author_id} authorName={comment.author} />
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
                            : 'mb-1.5'} flex flex-wrap items-start gap-1 sm:gap-1.5"
                    >
                        <!-- 존1: 정체성 (아바타 + 이름/레벨/메모/잠금 + 날짜/IP/수정이력) -->
                        <div class="flex items-start gap-2">
                            {#if iconUrl}
                                <img
                                    src={iconUrl}
                                    alt={comment.author}
                                    class="mt-0.5 rounded-full object-cover {isReply
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
                                    class="bg-primary text-primary-foreground mt-0.5 hidden items-center justify-center rounded-full {isReply
                                        ? 'size-7 text-xs'
                                        : 'size-8 text-sm'}"
                                >
                                    {comment.author.charAt(0).toUpperCase()}
                                </div>
                            {:else}
                                <div
                                    class="bg-primary text-primary-foreground mt-0.5 flex items-center justify-center rounded-full {isReply
                                        ? 'size-7 text-xs'
                                        : 'size-8 text-sm'}"
                                >
                                    {comment.author.charAt(0).toUpperCase()}
                                </div>
                            {/if}
                            <div>
                                <p
                                    class="text-foreground flex items-center gap-1.5 text-sm font-medium"
                                >
                                    <LevelBadge
                                        level={memberLevelStore.getLevel(comment.author_id)}
                                        size="md"
                                    />
                                    {#if !isDeleted && memoPluginActive && MemoBadge}
                                        <MemoBadge
                                            memberId={comment.author_id}
                                            showIcon={true}
                                            ip={comment.author_ip}
                                        />
                                    {/if}
                                    <AuthorLink
                                        authorId={comment.author_id}
                                        authorName={comment.author}
                                    />
                                    {#if comment.is_secret}
                                        <Lock class="text-muted-foreground h-3.5 w-3.5" />
                                    {/if}
                                </p>
                                <p class="text-muted-foreground flex items-center gap-1 text-xs">
                                    {formatDate(comment.created_at)}
                                    {#if comment.author_ip}
                                        <span>· {comment.author_ip}</span>
                                    {/if}
                                    {#if comment.edit_count && comment.edit_count > 0}
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

                        <!-- 신고 배지 (관리자만) -->
                        {#if authStore.user?.mb_level && authStore.user.mb_level >= 10 && commentReports.has(String(comment.id))}
                            {@const reports = commentReports.get(String(comment.id)) ?? []}
                            <span
                                class="text-destructive bg-destructive/10 rounded px-1.5 py-0.5 text-xs"
                                title={reports
                                    .map((r) => `${r.reporter_name}: ${r.reason_label}`)
                                    .join('\n')}
                            >
                                신고 {reports.length}건
                            </span>
                        {/if}

                        <!-- 존2: 액션 (좋아요/비추천/답글/링크복사/수정/삭제/신고) -->
                        {#if isDeleted}
                            <!-- 삭제된 댓글: 버튼 없음 -->
                        {:else}
                            <!-- 리액션 (da-reaction 플러그인) — 따봉 옆 배치 -->
                            {#if reactionPluginActive && !isEditing && boardId && postId}
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
                            <!-- 댓글 좋아요 버튼 (PHP 호환: thumbup 이미지) -->
                            <div
                                class="comment-good-group {reactionPluginActive
                                    ? ''
                                    : 'ml-auto'} flex items-stretch rounded-lg border {isCommentLiked(
                                    String(comment.id)
                                )
                                    ? 'border-liked/40 bg-liked/5'
                                    : 'border-border'}"
                            >
                                {#if onLike && authStore.isAuthenticated}
                                    <button
                                        type="button"
                                        onclick={() => handleLikeComment(String(comment.id))}
                                        disabled={likingComment === String(comment.id)}
                                        class="flex items-center px-1.5 py-1 transition-opacity hover:opacity-80"
                                        title="추천"
                                    >
                                        <img
                                            src={isCommentLiked(String(comment.id))
                                                ? '/images/thumbup-choose.gif?v=2'
                                                : '/images/thumbup.png?v=2'}
                                            alt="추천"
                                            class="size-5"
                                        />
                                    </button>
                                {:else}
                                    <span class="flex items-center px-1.5 py-1">
                                        <img src="/images/thumbup.png" alt="추천" class="size-5" />
                                    </span>
                                {/if}
                                <button
                                    type="button"
                                    onclick={() => openLikersDialog(comment.id)}
                                    class="text-muted-foreground hover:text-foreground border-l {isCommentLiked(
                                        String(comment.id)
                                    )
                                        ? 'border-liked/40 text-liked'
                                        : 'border-border'} px-2 py-1 text-xs font-medium transition-colors"
                                    title="추천인 목록보기"
                                    style={getCommentLikes(comment) === 0 ? 'opacity: 0.25;' : ''}
                                >
                                    {getCommentLikes(comment).toLocaleString()}
                                </button>
                            </div>

                            <!-- 댓글 추천자 아바타 스택 -->
                            {#if getCommentLikes(comment) > 0 && commentLikersList.has(String(comment.id))}
                                <AvatarStack
                                    items={commentLikersList.get(String(comment.id)) ?? []}
                                    total={commentLikersTotal.get(String(comment.id)) ?? 0}
                                    max={5}
                                    size="sm"
                                    onclick={() => openLikersDialog(comment.id)}
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
                                                class="h-7 px-2"
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
                                            class="comment-action-secondary h-7 px-1.5 opacity-50 transition-opacity hover:opacity-90"
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
                                                class="comment-action-secondary h-7 px-2 opacity-50 transition-opacity hover:opacity-90"
                                            >
                                                <Pencil class="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onclick={() => handleDelete(String(comment.id))}
                                                disabled={isDeleting === String(comment.id)}
                                                class="comment-action-secondary text-destructive hover:text-destructive h-7 px-2 opacity-50 transition-opacity hover:opacity-90"
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
                                                class="comment-action-secondary text-muted-foreground hover:text-destructive h-7 px-2 opacity-50 transition-opacity hover:opacity-90"
                                                title="신고"
                                            >
                                                <Flag class="h-4 w-4" />
                                            </Button>
                                        {/if}
                                        {#if isSuperAdmin() && comment.edit_count && comment.edit_count > 0}
                                            <!-- 수정이력 버튼 (관리자 전용) -->
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onclick={() =>
                                                    toggleCommentRevisions(String(comment.id))}
                                                class="comment-action-secondary text-muted-foreground h-7 px-2 opacity-50 transition-opacity hover:opacity-90"
                                                title="수정이력 보기"
                                            >
                                                <History class="h-4 w-4" />
                                                <span class="ml-1 text-xs">수정이력</span>
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
                            {#if isSuperAdmin() && comment.deleted_at}
                                <span class="text-xs">
                                    ({new Date(comment.deleted_at).toLocaleString('ko-KR')})
                                </span>
                            {/if}
                        </div>
                    {:else if isEditing}
                        <!-- 댓글 수정 폼 -->
                        <div class="mt-2 space-y-3">
                            <textarea
                                bind:value={editContent}
                                class="border-border bg-background text-foreground focus:border-primary focus:ring-primary min-h-24 w-full resize-y rounded-lg border p-3 text-sm focus:outline-none focus:ring-1"
                                placeholder="댓글을 입력하세요..."
                                disabled={isUpdating}
                            ></textarea>
                            <div class="flex justify-end gap-2">
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
                    {:else if comment.is_secret && !canViewSecretComment(comment)}
                        <div class="text-muted-foreground flex items-center gap-2 text-base italic">
                            <Lock class="h-4 w-4" />
                            비밀댓글입니다.
                        </div>
                    {:else}
                        <div
                            class="comment-body text-foreground whitespace-pre-wrap text-base leading-normal"
                        >
                            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                            {@html processedComments.get(comment.id) ??
                                ssrCommentHtml.get(comment.id) ??
                                ''}
                        </div>
                    {/if}

                    <!-- 댓글 수정이력 (관리자 전용) -->
                    {#if revisionCommentId === String(comment.id)}
                        <div class="mt-3">
                            {#if loadingRevisions}
                                <p class="text-muted-foreground text-sm">수정이력 로딩 중...</p>
                            {:else if commentRevisions.length > 0}
                                <RevisionHistory
                                    revisions={commentRevisions}
                                    isAdmin={true}
                                    canRestore={false}
                                />
                            {:else}
                                <p class="text-muted-foreground text-sm">수정이력이 없습니다.</p>
                            {/if}
                        </div>
                    {/if}

                    <!-- Chat: 시간 (버블 안 우하단) -->
                    {#if commentLayout === 'chat' && !isDeleted && !isEditing}
                        <p class="mt-1.5 text-right">
                            <span class="text-muted-foreground/70 text-xs"
                                >{formatDate(comment.created_at)}</span
                            >
                        </p>
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
                        <div
                            class="flex items-center rounded-lg border text-xs {isCommentLiked(
                                String(comment.id)
                            )
                                ? 'border-liked/40 bg-liked/5'
                                : 'border-border'}"
                        >
                            {#if onLike && authStore.isAuthenticated}
                                <button
                                    type="button"
                                    onclick={() => handleLikeComment(String(comment.id))}
                                    disabled={likingComment === String(comment.id)}
                                    class="flex items-center px-1 py-0.5 transition-opacity hover:opacity-80"
                                >
                                    <img
                                        src={isCommentLiked(String(comment.id))
                                            ? '/images/thumbup-choose.gif?v=2'
                                            : '/images/thumbup.png?v=2'}
                                        alt="추천"
                                        class="size-4"
                                    />
                                </button>
                            {:else}
                                <span class="flex items-center px-1 py-0.5">
                                    <img src="/images/thumbup.png" alt="추천" class="size-4" />
                                </span>
                            {/if}
                            <button
                                type="button"
                                onclick={() => openLikersDialog(comment.id)}
                                class="text-muted-foreground hover:text-foreground border-l px-1.5 py-0.5 font-medium transition-colors {isCommentLiked(
                                    String(comment.id)
                                )
                                    ? 'border-liked/40 text-liked'
                                    : 'border-border'}"
                            >
                                {getCommentLikes(comment).toLocaleString()}
                            </button>
                        </div>

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
                        {#if reactionPluginActive && boardId && postId}
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
        width: 100%;
        height: 100%;
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
        min-height: 200px;
    }

    :global(.embed-container[data-platform='twitter'])::before {
        display: none;
    }

    :global(.embed-container[data-platform='twitter'] iframe) {
        position: relative;
        min-height: 200px;
        height: auto;
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

    /* 댓글 본문 문단 간격 축소 */
    :global(.comment-body p) {
        margin-bottom: 0.6em;
    }
    :global(.comment-body p:last-child) {
        margin-bottom: 0;
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
</style>
