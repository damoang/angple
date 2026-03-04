<script lang="ts">
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import type { PageData } from './$types.js';
    import Pencil from '@lucide/svelte/icons/pencil';
    import Lock from '@lucide/svelte/icons/lock';
    import Pin from '@lucide/svelte/icons/pin';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { apiClient } from '$lib/api/index.js';
    import DeleteConfirmDialog from '$lib/components/features/board/delete-confirm-dialog.svelte';
    import CommentForm from '$lib/components/features/board/comment-form.svelte';
    import CommentList from '$lib/components/features/board/comment-list.svelte';
    import AdminCommentLayoutSwitcher from '$lib/components/features/board/admin-comment-layout-switcher.svelte';

    import RecentPosts from '$lib/components/features/board/recent-posts.svelte';
    import { ReportDialog } from '$lib/components/features/report/index.js';
    import type { FreeComment, FreePost, LikerInfo, PostRevision } from '$lib/api/types.js';
    import DeletedPostBanner from '$lib/components/post/deleted-post-banner.svelte';
    import RevisionHistory from '$lib/components/post/revision-history.svelte';
    import { sendMentionNotifications } from '$lib/utils/mention-notify.js';
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { getMemberIconUrl } from '$lib/utils/member-icon.js';
    import { isEmbeddable } from '$lib/plugins/auto-embed';
    import AdminPostActions from '$lib/components/features/board/admin-post-actions.svelte';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import { DamoangBanner } from '$lib/components/ui/damoang-banner';
    import { CelebrationRolling } from '$lib/components/ui/celebration-rolling';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
    import { pluginStore } from '$lib/stores/plugin.svelte';
    import {
        SeoHead,
        createArticleJsonLd,
        createBreadcrumbJsonLd,
        createDiscussionForumPostingJsonLd,
        getSiteUrl
    } from '$lib/seo/index.js';
    import type { SeoConfig } from '$lib/seo/types.js';
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
    import { memberLevelStore } from '$lib/stores/member-levels.svelte.js';
    import { postSlotRegistry } from '$lib/components/features/board/post-slot-registry.js';
    import {
        parseMarketInfo,
        MARKET_STATUS_LABELS,
        type MarketStatus
    } from '$lib/types/used-market.js';
    import QAAnswerSection from '$lib/components/features/board/qa-answer-section.svelte';
    import AuthorActivityPanel from '$lib/components/features/board/author-activity-panel.svelte';
    import EconomyShoppingBanner from '$lib/components/features/board/economy-shopping-banner.svelte';
    import EconomyOpenLinks from '$lib/components/features/board/economy-open-links.svelte';
    import {
        layoutRegistry,
        initCoreLayouts
    } from '$lib/components/features/board/layouts/index.js';
    import ScrapButton from '$lib/components/post/scrap-button.svelte';

    // Q&A 게시판 슬롯 등록
    postSlotRegistry.register('post.before_content', {
        id: 'core:qa-answer-section',
        component: QAAnswerSection,
        condition: (boardType: string) => boardType === 'qa',
        priority: 5,
        propsMapper: (pageData: { post: FreePost; boardId: string }) => ({
            post: pageData.post,
            boardId: pageData.boardId
        })
    });

    // 알뜰구매 게시판 슬롯 등록
    postSlotRegistry.register('post.after_content', {
        id: 'core:economy-open-links',
        component: EconomyOpenLinks,
        condition: (boardType: string) => boardType === 'economy',
        priority: 10
    });

    // 작성자 활동 패널 슬롯 등록
    postSlotRegistry.register('post.before_comments', {
        id: 'core:author-activity-panel',
        component: AuthorActivityPanel,
        priority: 10,
        propsMapper: (pageData: { post: FreePost; boardId: string }) => ({
            post: pageData.post
        })
    });
    import { loadPluginComponent } from '$lib/utils/plugin-optional-loader';
    import { checkPermission, getPermissionMessage } from '$lib/utils/board-permissions.js';
    import { readPostsStore } from '$lib/stores/read-posts.svelte.js';

    let { data }: { data: PageData } = $props();

    // 코어 레이아웃 초기화
    initCoreLayouts();

    // 뷰 레이아웃 동적 resolve
    const viewLayoutId = $derived(data.board?.display_settings?.view_layout || 'basic');
    const viewEntry = $derived(layoutRegistry.resolveView(viewLayoutId));
    const ViewComponent = $derived(viewEntry?.component);

    // 글자 크기 조절
    type FontSizeKey = 'small' | 'base' | 'large' | 'xlarge';
    const FONT_SIZES: Record<FontSizeKey, string> = {
        small: '14px',
        base: '16px',
        large: '18px',
        xlarge: '20px'
    };
    const FONT_SIZE_ORDER: FontSizeKey[] = ['small', 'base', 'large', 'xlarge'];
    let fontSize = $state<FontSizeKey>(
        browser ? (localStorage.getItem('damoang_font_size') as FontSizeKey) || 'base' : 'base'
    );

    function changeFontSize(direction: -1 | 0 | 1) {
        if (direction === 0) {
            fontSize = 'base';
        } else {
            const idx = FONT_SIZE_ORDER.indexOf(fontSize);
            const next = idx + direction;
            if (next >= 0 && next < FONT_SIZE_ORDER.length) {
                fontSize = FONT_SIZE_ORDER[next];
            }
        }
        if (browser) localStorage.setItem('damoang_font_size', fontSize);
    }

    // 글 읽기 권한 체크
    const canRead = $derived(
        !authStore.isAuthenticated
            ? (data.board?.read_level ?? 1) <= 1 // 비회원 레벨=1, read_level<=1이면 공개
            : checkPermission(data.board, 'can_read', authStore.user ?? null)
    );
    const readPermissionMessage = $derived(
        getPermissionMessage(data.board, 'can_read', authStore.user ?? null)
    );

    // 플러그인 활성화 여부
    let memoPluginActive = $derived(pluginStore.isPluginActive('member-memo'));
    let reactionPluginActive = $derived(pluginStore.isPluginActive('da-reaction'));

    // 동적 import: member-memo 플러그인 컴포넌트
    import type { Component } from 'svelte';
    let MemoBadge = $state<Component | null>(null);
    let MemoInlineEditor = $state<Component | null>(null);

    $effect(() => {
        if (memoPluginActive) {
            loadPluginComponent('member-memo', 'memo-badge').then((c) => (MemoBadge = c));
            loadPluginComponent('member-memo', 'memo-inline-editor').then(
                (c) => (MemoInlineEditor = c)
            );
        }
    });

    // link1이 동영상 URL이면 본문 앞에 삽입 (그누보드 wr_link1 호환)
    const postContent = $derived(() => {
        const link1 = data.post.link1;
        if (link1 && isEmbeddable(link1)) {
            return `<p>${link1}</p>\n${data.post.content}`;
        }
        return data.post.content;
    });

    // 게시판 정보
    const boardId = $derived(data.boardId);
    const boardTitle = $derived(data.board?.subject || data.board?.name || boardId);

    // 특수 게시판 타입 감지
    const boardType = $derived(
        data.board?.board_type ||
            (boardId === 'giving'
                ? 'giving'
                : boardId === 'angtt'
                  ? 'angtt'
                  : boardId === 'angmap'
                    ? 'angmap'
                    : boardId === 'economy'
                      ? 'economy'
                      : 'standard')
    );
    const isUsedMarket = $derived(boardType === 'used-market');

    // 플러그인 슬롯
    const beforeContentSlots = $derived(postSlotRegistry.resolve('post.before_content', boardType));
    const afterContentSlots = $derived(postSlotRegistry.resolve('post.after_content', boardType));
    const beforeCommentsSlots = $derived(
        postSlotRegistry.resolve('post.before_comments', boardType)
    );

    // 중고게시판 상태 관리
    let marketStatus = $state<MarketStatus>('selling');
    $effect(() => {
        marketStatus = (data.post.extra_2 as MarketStatus) || 'selling';
    });
    let isChangingMarketStatus = $state(false);

    async function changeMarketStatus(newStatus: MarketStatus) {
        isChangingMarketStatus = true;
        try {
            const res = await fetch(`/api/boards/${boardId}/posts/${data.post.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            const result = await res.json();
            if (result.success) {
                marketStatus = newStatus;
            } else {
                alert(result.error || '상태 변경에 실패했습니다.');
            }
        } catch (err) {
            console.error('Market status change error:', err);
            alert('상태 변경에 실패했습니다.');
        } finally {
            isChangingMarketStatus = false;
        }
    }

    // 댓글 목록 상태 (SSR 데이터로 즉시 초기화하여 깜박임 방지 + 페이지 전환 시 갱신)
    let comments = $state<FreeComment[]>(data.comments.items);
    $effect(() => {
        comments = data.comments.items;
    });
    let isCreatingComment = $state(false);

    // 추천/비추천 상태
    let likeCount = $state(0);
    $effect(() => {
        likeCount = data.post.likes;
    });
    let dislikeCount = $state(0);
    let isLiked = $state(false);
    let isDisliked = $state(false);
    let isLiking = $state(false);
    let isDisliking = $state(false);
    let isLikeAnimating = $state(false); // 좋아요 애니메이션

    // 추천자 목록 다이얼로그 상태
    let showLikersDialog = $state(false);
    let likers = $state<LikerInfo[]>([]);
    let likersTotal = $state(0);
    let isLoadingLikers = $state(false);
    let likersPage = $state(1);
    let isLoadingMoreLikers = $state(false);
    const LIKERS_PER_PAGE = 20;

    // 인라인 메모 편집 대상 (추천인 목록 내)
    let editingMemoFor = $state<string | null>(null);

    // 게시글 삭제 상태
    let isDeleting = $state(false);

    // 리비전 히스토리 (SSR에서 관리자일 때 미리 로드됨)
    let revisions = $state<PostRevision[]>(data.revisions ?? []);

    // 신고 다이얼로그 상태
    let showReportDialog = $state(false);

    // 초기 추천 상태 + 레벨 로드 + 조회수 증가 + 읽음 표시
    onMount(async () => {
        // 읽음 표시 (localStorage)
        readPostsStore.markAsRead(boardId, data.post.id);

        // 조회수 증가 (fire-and-forget)
        fetch('/api/viewcount', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ boardId, postId: data.post.id })
        }).catch(() => {});

        // 게시글 작성자 레벨 배치 로드
        if (data.post.author_id) {
            memberLevelStore.fetchLevels([data.post.author_id]);
        }

        // 추천 상태 조회 (비로그인도 추천 수 정확하게 가져옴)
        try {
            const status = await apiClient.getPostLikeStatus(boardId, String(data.post.id));
            isLiked = status.user_liked;
            isDisliked = status.user_disliked ?? false;
            likeCount = status.likes;
            dislikeCount = status.dislikes ?? 0;
        } catch (err) {
            console.error('Failed to load like status:', err);
        }

        // 추천 수 > 0이면 아바타 미리 로드
        if (likeCount > 0) {
            loadLikerAvatars();
        }

        // 댓글 앵커 스크롤 (#c_댓글ID)
        const hash = window.location.hash;
        if (hash && hash.startsWith('#c_')) {
            setTimeout(() => {
                const el = document.getElementById(hash.slice(1));
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    el.style.transition = 'background-color 0.3s ease';
                    el.style.backgroundColor = 'hsl(var(--primary) / 0.1)';
                    el.style.borderRadius = '0.5rem';
                    setTimeout(() => {
                        el.style.backgroundColor = '';
                        setTimeout(() => {
                            el.style.transition = '';
                            el.style.borderRadius = '';
                        }, 300);
                    }, 2000);
                }
            }, 800);
        }
    });

    // 날짜 포맷 헬퍼
    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 파일 크기 포맷
    function formatFileSize(bytes: number): string {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    // 목록으로 돌아가기
    function goBack(): void {
        goto(`/${boardId}`);
    }

    // 수정 페이지로 이동
    function goToEdit(): void {
        goto(`/${boardId}/${data.post.id}/edit`);
    }

    // 작성자 확인
    const isAuthor = $derived(
        authStore.user?.mb_id === data.post.author_id ||
            authStore.user?.mb_name === data.post.author
    );

    // 관리자 여부 (레벨 10 이상)
    const isAdmin = $derived((authStore.user?.mb_level ?? 0) >= 10);

    // 비밀글 접근 권한 (작성자 또는 관리자만 열람 가능)
    const canViewSecret = $derived(!data.post.is_secret || isAuthor || isAdmin);

    // 공지 상태
    let noticeType = $state<'normal' | 'important' | null>(null);
    $effect(() => {
        noticeType = data.post.notice_type ?? null;
    });
    let isTogglingNotice = $state(false);

    async function toggleNotice(type: 'normal' | 'important' | null): Promise<void> {
        isTogglingNotice = true;
        try {
            const res = await fetch(`/api/boards/${boardId}/posts/${data.post.id}/notice`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notice_type: type })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => null);
                throw new Error(err?.error || '공지 설정에 실패했습니다.');
            }
            noticeType = type;
        } catch (err) {
            console.error('Failed to toggle notice:', err);
            alert(err instanceof Error ? err.message : '공지 설정에 실패했습니다.');
        } finally {
            isTogglingNotice = false;
        }
    }

    // 게시글 삭제
    async function handleDelete(): Promise<void> {
        isDeleting = true;
        try {
            await apiClient.deletePost(boardId, String(data.post.id));
            goto(`/${boardId}`);
        } catch (err) {
            console.error('Failed to delete post:', err);
            alert('게시글 삭제에 실패했습니다.');
        } finally {
            isDeleting = false;
        }
    }

    // 리비전 히스토리 로드
    async function loadRevisions(): Promise<void> {
        try {
            revisions = await apiClient.getPostRevisions(boardId, String(data.post.id));
        } catch {
            // 리비전이 없거나 권한이 없으면 무시
            revisions = [];
        }
    }

    // 리비전 복원 (관리자)
    async function handleRestoreRevision(version: number): Promise<void> {
        try {
            await apiClient.restoreRevision(boardId, String(data.post.id), version);
            window.location.reload();
        } catch (err) {
            console.error('Failed to restore revision:', err);
            alert('버전 복원에 실패했습니다.');
        }
    }

    // 삭제된 게시글 복구 (관리자)
    async function handleRestorePost(): Promise<void> {
        try {
            await apiClient.restorePost(boardId, String(data.post.id));
            window.location.reload();
        } catch (err) {
            console.error('Failed to restore post:', err);
            alert('게시글 복구에 실패했습니다.');
        }
    }

    // 게시글 추천
    async function handleLike(): Promise<void> {
        if (!authStore.isAuthenticated) {
            authStore.redirectToLogin();
            return;
        }

        if (isLiking) return;

        isLiking = true;
        try {
            const response = await apiClient.likePost(boardId, String(data.post.id));
            const wasLiked = isLiked;
            isLiked = response.user_liked;
            isDisliked = response.user_disliked ?? false;
            likeCount = response.likes;
            dislikeCount = response.dislikes ?? 0;

            // 추천 성공 시 애니메이션 (취소가 아닌 경우만)
            if (!wasLiked && isLiked) {
                isLikeAnimating = true;
                setTimeout(() => {
                    isLikeAnimating = false;
                }, 1000);
            }

            // 아바타 스택 갱신
            loadLikerAvatars();
        } catch (err) {
            console.error('Failed to like post:', err);
            alert('추천에 실패했습니다.');
        } finally {
            isLiking = false;
        }
    }

    // 게시글 비추천
    async function handleDislike(): Promise<void> {
        if (!authStore.isAuthenticated) {
            authStore.redirectToLogin();
            return;
        }

        if (isDisliking) return;

        isDisliking = true;
        try {
            const response = await apiClient.dislikePost(boardId, String(data.post.id));
            isLiked = response.user_liked;
            isDisliked = response.user_disliked ?? false;
            likeCount = response.likes;
            dislikeCount = response.dislikes ?? 0;

            // 아바타 스택 갱신
            loadLikerAvatars();
        } catch (err) {
            console.error('Failed to dislike post:', err);
            alert('비추천에 실패했습니다.');
        } finally {
            isDisliking = false;
        }
    }

    // 추천자 목록 로드
    async function loadLikers(): Promise<void> {
        showLikersDialog = true;
        isLoadingLikers = true;
        likersPage = 1;
        try {
            const response = await apiClient.getPostLikers(
                boardId,
                String(data.post.id),
                1,
                LIKERS_PER_PAGE
            );
            likers = response.likers;
            likersTotal = response.total;
            // 추천자 레벨 배치 로드
            const likerIds = response.likers.map((l: LikerInfo) => l.mb_id).filter(Boolean);
            if (likerIds.length > 0) {
                memberLevelStore.fetchLevels(likerIds);
            }
        } catch (err) {
            console.error('Failed to load likers:', err);
        } finally {
            isLoadingLikers = false;
        }
    }

    // 추천자 더보기 로드
    async function loadMoreLikers(): Promise<void> {
        if (isLoadingMoreLikers) return;
        isLoadingMoreLikers = true;
        const nextPage = likersPage + 1;
        try {
            const response = await apiClient.getPostLikers(
                boardId,
                String(data.post.id),
                nextPage,
                LIKERS_PER_PAGE
            );
            likers = [...likers, ...response.likers];
            likersTotal = response.total;
            likersPage = nextPage;
            // 추가된 추천자 레벨 배치 로드
            const likerIds = response.likers.map((l: LikerInfo) => l.mb_id).filter(Boolean);
            if (likerIds.length > 0) {
                memberLevelStore.fetchLevels(likerIds);
            }
        } catch (err) {
            console.error('Failed to load more likers:', err);
        } finally {
            isLoadingMoreLikers = false;
        }
    }

    // 추천자 아바타 미리 로드 (상위 5명)
    async function loadLikerAvatars(): Promise<void> {
        try {
            const response = await apiClient.getPostLikers(boardId, String(data.post.id), 1, 5);
            likers = response.likers;
            likersTotal = response.total;
        } catch (err) {
            console.error('Failed to load liker avatars:', err);
        }
    }

    // 댓글 작성
    async function handleCreateComment(
        content: string,
        parentId?: string | number,
        isSecret?: boolean,
        images?: string[]
    ): Promise<void> {
        if (!authStore.user) {
            throw new Error('로그인이 필요합니다.');
        }

        isCreatingComment = true;
        try {
            const newComment = await apiClient.createComment(boardId, String(data.post.id), {
                content,
                author: authStore.user.mb_name,
                parent_id: parentId,
                is_secret: isSecret,
                images
            });

            // 댓글 목록에 추가
            comments = [...comments, newComment];

            // @멘션 알림 전송 (fire-and-forget)
            sendMentionNotifications({
                content,
                postUrl: `/${boardId}/${data.post.id}`,
                postTitle: data.post.title,
                boardId,
                postId: data.post.id,
                senderName: authStore.user.mb_name,
                senderId: authStore.user.mb_id || ''
            });
        } finally {
            isCreatingComment = false;
        }
    }

    // 답글 작성
    async function handleReplyComment(
        content: string,
        parentId: string | number,
        isSecret?: boolean,
        images?: string[]
    ): Promise<void> {
        if (!authStore.user) {
            throw new Error('로그인이 필요합니다.');
        }

        const newComment = await apiClient.createComment(boardId, String(data.post.id), {
            content,
            author: authStore.user.mb_name,
            parent_id: parentId,
            is_secret: isSecret,
            images
        });

        // 댓글 목록에 추가
        comments = [...comments, newComment];

        // @멘션 알림 전송 (fire-and-forget)
        sendMentionNotifications({
            content,
            postUrl: `/${boardId}/${data.post.id}`,
            postTitle: data.post.title,
            boardId,
            postId: data.post.id,
            senderName: authStore.user.mb_name,
            senderId: authStore.user.mb_id || ''
        });
    }

    // 댓글 수정
    async function handleUpdateComment(commentId: string, content: string): Promise<void> {
        await apiClient.updateComment(boardId, String(data.post.id), commentId, { content });

        // 로컬 상태 업데이트
        comments = comments.map((c) =>
            String(c.id) === commentId ? { ...c, content, updated_at: new Date().toISOString() } : c
        );
    }

    // 댓글 삭제
    async function handleDeleteComment(commentId: string): Promise<void> {
        await apiClient.deleteComment(boardId, String(data.post.id), commentId);

        // 로컬 상태에서 제거
        comments = comments.filter((c) => String(c.id) !== commentId);
    }

    // 댓글 추천
    async function handleLikeComment(
        commentId: string
    ): Promise<{ likes: number; user_liked: boolean }> {
        const response = await apiClient.likeComment(boardId, String(data.post.id), commentId);
        return {
            likes: response.likes,
            user_liked: response.user_liked
        };
    }

    // SEO 설정
    const postDescription = $derived(data.post.content.replace(/<[^>]+>/g, '').slice(0, 160));

    const seoConfig: SeoConfig = $derived.by(() => {
        const siteUrl = getSiteUrl();
        const postUrl = `${siteUrl}/${boardId}/${data.post.id}`;
        const authorUrl = data.post.author_id
            ? `${siteUrl}/member/${data.post.author_id}`
            : undefined;

        return {
            meta: {
                title: `${data.post.title} - ${boardTitle}`,
                description: postDescription,
                canonicalUrl: postUrl
            },
            og: {
                title: data.post.title,
                description: postDescription,
                type: 'article',
                url: postUrl,
                image: data.post.thumbnail || data.post.images?.[0]
            },
            twitter: {
                card:
                    data.post.thumbnail || data.post.images?.[0]
                        ? 'summary_large_image'
                        : 'summary',
                title: data.post.title,
                description: postDescription,
                image: data.post.thumbnail || data.post.images?.[0]
            },
            jsonLd: [
                // DiscussionForumPosting - 커뮤니티 게시글에 최적화된 구조화 데이터
                createDiscussionForumPostingJsonLd({
                    headline: data.post.title,
                    text: postDescription,
                    author: data.post.author,
                    authorUrl,
                    datePublished: data.post.created_at,
                    dateModified: data.post.updated_at || undefined,
                    url: postUrl,
                    commentCount: data.comments?.total || 0,
                    upvoteCount: data.post.likes || 0,
                    image: data.post.thumbnail || data.post.images?.[0]
                }),
                // Article - 일반 검색 결과용 (폴백)
                createArticleJsonLd({
                    headline: data.post.title,
                    author: data.post.author,
                    datePublished: data.post.created_at,
                    dateModified: data.post.updated_at || data.post.created_at,
                    image: data.post.thumbnail || data.post.images?.[0],
                    description: postDescription
                }),
                // Breadcrumb
                createBreadcrumbJsonLd([
                    { name: '홈', url: siteUrl },
                    { name: boardTitle, url: `${siteUrl}/${boardId}` },
                    { name: data.post.title }
                ])
            ]
        };
    });

    // 댓글 비추천
    async function handleDislikeComment(
        commentId: string
    ): Promise<{ dislikes: number; user_disliked: boolean }> {
        const response = await apiClient.dislikeComment(boardId, String(data.post.id), commentId);
        return {
            dislikes: response.dislikes ?? 0,
            user_disliked: response.user_disliked ?? false
        };
    }
</script>

<SeoHead config={seoConfig} />

<div class="mx-auto pt-2">
    <!-- 상단 배너 -->
    {#if widgetLayoutStore.hasEnabledAds}
        <div class="mb-6">
            <DamoangBanner position="board-view" showCelebration={false} height="90px" />
        </div>
    {/if}

    <!-- 상단 네비게이션 -->
    <div class="bg-background sticky top-12 z-40 -mx-1 mb-6 flex items-center gap-3 py-2 md:top-16">
        <Button variant="outline" size="sm" onclick={goBack} class="shrink-0">← 목록으로</Button>

        <!-- 축하 메시지 롤링 (인라인) -->
        <div class="min-w-0 flex-1">
            <CelebrationRolling />
        </div>

        <div class="flex shrink-0 gap-2">
            {#if authStore.isAuthenticated}
                <ScrapButton
                    boardId={data.boardId}
                    postId={data.post.id}
                    initialScrapped={data.isScrapped}
                />
            {/if}
            {#if isAdmin}
                {#if noticeType}
                    <Button
                        variant="outline"
                        size="sm"
                        onclick={() => toggleNotice(null)}
                        disabled={isTogglingNotice}
                    >
                        <Pin class="mr-1 h-4 w-4" />
                        공지 해제
                    </Button>
                {:else}
                    <Button
                        variant="outline"
                        size="sm"
                        onclick={() => toggleNotice('important')}
                        disabled={isTogglingNotice}
                    >
                        <Pin class="mr-1 h-4 w-4" />
                        공지 고정
                    </Button>
                {/if}
                <!-- 관리자 게시글 관리 (카테고리 변경, 이동) -->
                <AdminPostActions
                    {boardId}
                    postId={data.post.id}
                    currentCategory={data.post.category}
                    categoryList={data.board?.category_list}
                />
            {/if}
            {#if isAuthor || isAdmin}
                <Button variant="outline" size="sm" onclick={goToEdit}>
                    <Pencil class="mr-1 h-4 w-4" />
                    수정
                </Button>
            {/if}
            {#if isAuthor || isAdmin}
                <DeleteConfirmDialog
                    title="게시글 삭제"
                    description="이 게시글을 삭제하시겠습니까? 댓글은 유지됩니다."
                    onConfirm={handleDelete}
                    isLoading={isDeleting}
                />
            {/if}
        </div>
    </div>

    <!-- 네비게이션 아래 GAM 광고 -->
    {#if widgetLayoutStore.hasEnabledAds}
        <div class="mb-6">
            <AdSlot position="board-view-top" height="90px" />
        </div>
    {/if}

    <!-- 알뜰구매 쇼핑 바로가기 (목록으로 버튼 → GAM → 여기 → 본문 카드) -->
    {#if boardType === 'economy'}
        <div class="mb-6">
            <EconomyShoppingBanner />
        </div>
    {/if}

    <!-- 읽기 권한 체크 -->
    {#if !canRead}
        <div class="bg-muted/50 mx-auto mt-12 max-w-md rounded-lg p-8 text-center">
            <Lock class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            <p class="text-muted-foreground text-lg font-medium">글 읽기 권한이 없습니다</p>
            <p class="text-muted-foreground mt-2 text-sm">{readPermissionMessage}</p>
        </div>
    {:else}
        <!-- 삭제된 게시물 배너 -->
        {#if data.post.deleted_at}
            <div class="mb-4">
                <DeletedPostBanner
                    postId={data.post.id}
                    deletedAt={data.post.deleted_at}
                    {isAdmin}
                    onRestore={handleRestorePost}
                />
            </div>
        {/if}

        <!-- 게시글 카드 (뷰 레이아웃) -->
        {#if ViewComponent}
            <ViewComponent
                post={data.post}
                board={data.board}
                {boardId}
                {isAuthor}
                {isAdmin}
                {canViewSecret}
                {likeCount}
                {dislikeCount}
                {isLiked}
                {isDisliked}
                {isLiking}
                {isDisliking}
                {isLikeAnimating}
                {likers}
                {likersTotal}
                {fontSize}
                fontSizeLabel={FONT_SIZE_ORDER[FONT_SIZE_ORDER.indexOf(fontSize)]}
                onLike={handleLike}
                onDislike={handleDislike}
                onLoadLikers={loadLikers}
                onReport={() => {
                    showReportDialog = true;
                }}
                onChangeFontSize={changeFontSize}
                {memoPluginActive}
                {reactionPluginActive}
                {MemoBadge}
                {beforeContentSlots}
                {afterContentSlots}
                {formatDate}
                {formatFileSize}
                postContent={postContent()}
                pageData={data}
            />
        {:else}
            <!-- 폴백: 레이아웃을 resolve할 수 없을 때 기본 메시지 -->
            <div class="text-muted-foreground py-12 text-center">
                레이아웃을 불러올 수 없습니다.
            </div>
        {/if}

        <!-- 수정/삭제 시간 표시 -->
        {#if data.post.updated_at && data.post.updated_at !== data.post.created_at}
            <p class="text-muted-foreground mt-4 text-center text-[15px]">
                마지막 수정: {formatDate(data.post.updated_at)}
                {#if revisions.length > 0}
                    <span class="text-muted-foreground/70">· 수정됨 ({revisions.length}회)</span>
                {/if}
            </p>
        {/if}

        <!-- 중고게시판 상태 변경 (작성자/관리자만) -->
        {#if isUsedMarket && (isAuthor || isAdmin)}
            <div class="mb-6 flex items-center gap-3 rounded-lg border p-4">
                <span class="text-[15px] font-medium">판매 상태:</span>
                <div class="flex gap-2">
                    {#each ['selling', 'reserved', 'sold'] as const as status (status)}
                        <Button
                            variant={marketStatus === status ? 'default' : 'outline'}
                            size="sm"
                            onclick={() => changeMarketStatus(status)}
                            disabled={isChangingMarketStatus || marketStatus === status}
                        >
                            {MARKET_STATUS_LABELS[status]}
                        </Button>
                    {/each}
                </div>
            </div>
        {/if}

        {#each beforeCommentsSlots as slot (slot.component)}
            {@const SlotComponent = slot.component}
            <SlotComponent
                {...slot.propsMapper ? slot.propsMapper({ post: data.post, boardId }) : {}}
            />
        {/each}

        <!-- 작성자 활동 패널 아래 GAM 광고 (비활성화: 본문 영역 광고 과다 방지)
        {#if widgetLayoutStore.hasEnabledAds}
            <div class="my-6">
                <AdSlot position="board-before-comments" height="90px" />
            </div>
        {/if}
        -->

        <!-- 수정 이력 (리비전 히스토리) - 관리자 전용 -->
        {#if isAdmin && revisions.length > 0}
            <div class="mb-6">
                <RevisionHistory
                    {revisions}
                    {isAdmin}
                    canRestore={isAdmin}
                    onRestore={handleRestoreRevision}
                />
            </div>
        {/if}

        <!-- 댓글 섹션 (비밀글 열람 가능 시에만 표시) -->
        {#if canViewSecret}
            <Card class="bg-background">
                <CardHeader class="flex flex-row items-center justify-between">
                    <h3 class="text-foreground text-lg font-semibold">
                        댓글 <span class="text-muted-foreground">({comments.length})</span>
                    </h3>
                    <AdminCommentLayoutSwitcher
                        {boardId}
                        currentLayout={data.board?.display_settings?.comment_layout || 'flat'}
                    />
                </CardHeader>
                <CardContent class="space-y-6">
                    <CommentList
                        {comments}
                        onUpdate={handleUpdateComment}
                        onDelete={handleDeleteComment}
                        onReply={handleReplyComment}
                        onLike={handleLikeComment}
                        onDislike={handleDislikeComment}
                        postAuthorId={data.post.author_id}
                        {boardId}
                        postId={data.post.id}
                        useNogood={data.board?.use_nogood === 1}
                        commentLayout={data.board?.display_settings?.comment_layout || 'flat'}
                    />

                    <div class="border-border border-t pt-6">
                        <CommentForm
                            onSubmit={handleCreateComment}
                            isLoading={isCreatingComment}
                            permissions={data.board?.permissions}
                            requiredCommentLevel={data.board?.comment_level ?? 3}
                            {boardId}
                        />
                    </div>
                </CardContent>
            </Card>
        {/if}

        <!-- 1시간 추천글 리스트 (임시 비활성화)
        <div class="mt-6">
            <RecommendedPosts />
        </div>
        -->

        <!-- 댓글~목록 사이 GAM 광고 -->
        {#if widgetLayoutStore.hasEnabledAds}
            <div class="my-6">
                <AdSlot position="board-after-comments" height="90px" />
            </div>
        {/if}

        <!-- 게시판 최근글 목록 (체류시간 증가) -->
        <div class="mt-6">
            <RecentPosts
                {boardId}
                {boardTitle}
                currentPostId={data.post.id}
                limit={25}
                promotionPosts={data.promotionPosts || []}
                displaySettings={data.board?.display_settings}
            />
        </div>

        <!-- 댓글 섹션 하단 광고 (푸터 위) -->
        {#if widgetLayoutStore.hasEnabledAds}
            <div class="mt-6">
                <AdSlot position="board-footer" height="90px" />
            </div>
        {/if}
    {/if}
    <!-- /canRead -->
</div>

<!-- 추천자 목록 다이얼로그 -->
<Dialog.Root
    bind:open={showLikersDialog}
    onOpenChange={(open) => {
        if (!open) editingMemoFor = null;
    }}
>
    <Dialog.Content class="max-w-md">
        <Dialog.Header>
            <Dialog.Title>추천한 사람들</Dialog.Title>
            <Dialog.Description>
                이 게시글을 추천한 {likersTotal}명
            </Dialog.Description>
        </Dialog.Header>
        <div class="max-h-96 overflow-y-auto">
            {#if isLoadingLikers}
                <div class="text-muted-foreground py-8 text-center">불러오는 중...</div>
            {:else if likers.length === 0}
                <div class="text-muted-foreground py-8 text-center">
                    아직 추천한 사람이 없습니다.
                </div>
            {:else}
                <ul class="divide-border divide-y">
                    {#each likers as liker (liker.mb_id)}
                        <li class="py-3">
                            <div class="flex items-center gap-3">
                                <!-- 프로필 이미지 -->
                                {#if getMemberIconUrl(liker.mb_id)}
                                    <img
                                        src={getMemberIconUrl(liker.mb_id)}
                                        alt={liker.mb_nick || liker.mb_name}
                                        class="size-8 rounded-full object-cover"
                                        onerror={(e) => {
                                            const img = e.currentTarget as HTMLImageElement;
                                            img.style.display = 'none';
                                            const fallback = img.nextElementSibling as HTMLElement;
                                            if (fallback) fallback.style.display = 'flex';
                                        }}
                                    />
                                    <div
                                        class="bg-primary text-primary-foreground hidden size-8 items-center justify-center rounded-full text-sm"
                                    >
                                        {(liker.mb_nick || liker.mb_name).charAt(0).toUpperCase()}
                                    </div>
                                {:else}
                                    <div
                                        class="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full text-sm"
                                    >
                                        {(liker.mb_nick || liker.mb_name).charAt(0).toUpperCase()}
                                    </div>
                                {/if}

                                <!-- 닉네임 + 메모배지 + IP + 날짜 -->
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-1">
                                        <LevelBadge
                                            level={memberLevelStore.getLevel(liker.mb_id)}
                                            size="sm"
                                        />
                                        <a
                                            href="/profile/{liker.mb_id}"
                                            class="text-foreground hover:text-primary truncate text-sm font-medium"
                                        >
                                            {liker.mb_nick || liker.mb_name}
                                        </a>
                                        {#if memoPluginActive && MemoBadge}
                                            <MemoBadge
                                                memberId={liker.mb_id}
                                                showIcon={true}
                                                onclick={() => {
                                                    editingMemoFor =
                                                        editingMemoFor === liker.mb_id
                                                            ? null
                                                            : liker.mb_id;
                                                }}
                                            />
                                        {/if}
                                    </div>
                                    <div class="text-muted-foreground text-xs">
                                        {#if authStore.isAuthenticated && liker.bg_ip}
                                            <span>({liker.bg_ip})</span>
                                            <span class="mx-1">·</span>
                                        {/if}
                                        <span>{formatDate(liker.liked_at)}</span>
                                    </div>
                                </div>

                                <!-- 작성글 링크 -->
                                <a
                                    href="/search?author_id={liker.mb_id}"
                                    class="text-muted-foreground hover:text-foreground whitespace-nowrap text-xs"
                                >
                                    작성글
                                </a>
                            </div>

                            <!-- 인라인 메모 편집기 -->
                            {#if memoPluginActive && MemoInlineEditor && editingMemoFor === liker.mb_id}
                                <div class="ml-11 mt-2">
                                    <MemoInlineEditor
                                        memberId={liker.mb_id}
                                        onClose={() => {
                                            editingMemoFor = null;
                                        }}
                                    />
                                </div>
                            {/if}
                        </li>
                    {/each}
                </ul>
                <!-- 더보기 버튼 -->
                {#if likers.length < likersTotal}
                    <div class="flex justify-center pt-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onclick={loadMoreLikers}
                            disabled={isLoadingMoreLikers}
                            class="w-full"
                        >
                            {#if isLoadingMoreLikers}
                                불러오는 중...
                            {:else}
                                더보기 ({likers.length}/{likersTotal})
                            {/if}
                        </Button>
                    </div>
                {/if}
            {/if}
        </div>
    </Dialog.Content>
</Dialog.Root>

<!-- 게시글 신고 다이얼로그 -->
<ReportDialog
    bind:open={showReportDialog}
    targetType="post"
    targetId={data.post.id}
    {boardId}
    postId={data.post.id}
    onClose={() => (showReportDialog = false)}
/>
