<script lang="ts" module>
    import type { Snapshot } from './$types.js';

    // 뒤로가기 시 스크롤 위치 즉시 복원
    export const snapshot: Snapshot<{ scrollY: number }> = {
        capture: () => ({ scrollY: window.scrollY }),
        restore: (value) => {
            // Safari 타이밍 이슈 대응: rAF + setTimeout 이중 보호
            requestAnimationFrame(() => window.scrollTo(0, value.scrollY));
            setTimeout(() => {
                requestAnimationFrame(() => window.scrollTo(0, value.scrollY));
            }, 100);
        }
    };
</script>

<script lang="ts">
    import { browser } from '$app/environment';
    import { afterNavigate, goto } from '$app/navigation';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import type { PageData } from './$types.js';
    import Pencil from '@lucide/svelte/icons/pencil';
    import ListIcon from '@lucide/svelte/icons/list';
    import Lock from '@lucide/svelte/icons/lock';
    import Clock from '@lucide/svelte/icons/clock';

    import RefreshCw from '@lucide/svelte/icons/refresh-cw';
    import ArrowUpCircle from '@lucide/svelte/icons/arrow-up-circle';
    import FileText from '@lucide/svelte/icons/file-text';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import {
        canUseCertifiedAction,
        getCertificationBlockedMessage,
        goToCertification
    } from '$lib/utils/certification-gate.js';
    import { apiClient } from '$lib/api/index.js';
    import DeleteConfirmDialog from '$lib/components/features/board/delete-confirm-dialog.svelte';
    import CommentForm from '$lib/components/features/board/comment-form.svelte';
    import CommentList from '$lib/components/features/board/comment-list.svelte';
    import AuthorActivityPanel from '$lib/components/features/board/author-activity-panel.svelte';
    import RecentPosts from '$lib/components/features/board/recent-posts.svelte';
    import { ReportDialog } from '$lib/components/features/report/index.js';
    import type { FreeComment, FreePost, LikerInfo, PostRevision } from '$lib/api/types.js';
    import DeletedPostBanner from '$lib/components/post/deleted-post-banner.svelte';
    import { sendMentionNotifications } from '$lib/utils/mention-notify.js';
    import type { ReactionItem } from '$lib/types/reaction.js';
    import { generateParentId, generateDocumentTargetId } from '$lib/types/reaction.js';
    import { onMount } from 'svelte';
    import { doAction } from '$lib/hooks/registry';
    import { page } from '$app/stores';
    import { getAvatarUrl } from '$lib/utils/member-icon.js';
    import { isEmbeddable } from '$lib/plugins/auto-embed';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import AdsenseMultiplex from '$lib/components/ui/adsense-multiplex/adsense-multiplex.svelte';
    import AdfitResponsiveSlot from '$lib/components/ui/adfit-slot/adfit-responsive-slot.svelte';
    import PluginSlot from '$lib/components/plugin/plugin-slot.svelte';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
    import { pluginStore } from '$lib/stores/plugin.svelte';
    import { loadPluginLib } from '$lib/utils/plugin-optional-loader';
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
    import EconomyOpenLinks from '$lib/components/features/board/economy-open-links.svelte';
    import {
        layoutRegistry,
        initCoreLayouts
    } from '$lib/components/features/board/layouts/index.js';
    import ScrapButton from '$lib/components/post/scrap-button.svelte';
    import { Watermark } from '$lib/components/ui/watermark/index.js';

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

    postSlotRegistry.register('post.before_comments', {
        id: 'core:author-activity-panel',
        component: AuthorActivityPanel,
        priority: 20,
        propsMapper: (pageData: { post: FreePost }) => ({
            post: pageData.post
        })
    });

    import { loadPluginComponent } from '$lib/utils/plugin-optional-loader';
    import { checkPermission, getPermissionMessage } from '$lib/utils/board-permissions.js';
    import { readPostsStore } from '$lib/stores/read-posts.svelte.js';
    import { createScrollDepthObserver, trackEvent, trackPostView } from '$lib/services/ga4.js';
    import { uiSettingsStore } from '$lib/stores/ui-settings.svelte.js';
    import { commentTracker } from '$lib/stores/comment-tracker.svelte.js';
    import { onDestroy } from 'svelte';
    import { TouchGestureService } from '$lib/services/touch-gestures.svelte.js';

    interface AdjacentPost {
        id: number;
        title: string;
    }
    interface AdjacentPosts {
        prev: AdjacentPost | null;
        next: AdjacentPost | null;
    }
    interface PromotionPost {
        wrId: number;
        subject: string;
        imageUrl: string;
        linkUrl: string;
        advertiserName: string;
        memberId: string;
        pinToTop: boolean;
        createdAt: string;
    }

    let { data }: { data: PageData } = $props();

    // 코어 레이아웃 초기화
    initCoreLayouts();

    // 뷰 레이아웃 동적 resolve
    const viewLayoutId = $derived(data.board?.display_settings?.view_layout || 'basic');
    const viewEntry = $derived(layoutRegistry.resolveView(viewLayoutId));
    const ViewComponent = $derived(viewEntry?.component);

    // 글자 크기 조절 (uiSettingsStore 연동)
    const fontSize = $derived(uiSettingsStore.contentFontSize);

    function changeFontSize(direction: -1 | 0 | 1) {
        uiSettingsStore.changeContentFontSize(direction);
    }

    // 기존 damoang_font_size localStorage → uiSettingsStore 마이그레이션
    if (browser) {
        const legacy = localStorage.getItem('damoang_font_size');
        if (legacy && ['small', 'base', 'large', 'xlarge'].includes(legacy)) {
            uiSettingsStore.setContentFontSize(legacy as 'small' | 'base' | 'large' | 'xlarge');
            localStorage.removeItem('damoang_font_size');
        }
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
    let loadMemosForAuthors = $state<((memberIds: string[]) => Promise<void>) | null>(null);

    $effect(() => {
        if (memoPluginActive) {
            loadPluginComponent('member-memo', 'memo-badge').then((c) => (MemoBadge = c));
            loadPluginComponent('member-memo', 'memo-inline-editor').then(
                (c) => (MemoInlineEditor = c)
            );
            loadPluginLib<{ loadMemosForAuthors: (ids: string[]) => Promise<void> }>(
                'member-memo',
                'memo-store'
            ).then((module) => {
                loadMemosForAuthors = module?.loadMemosForAuthors ?? null;
            });
        } else {
            loadMemosForAuthors = null;
        }
    });

    // link1이 동영상 URL이면 본문 앞에 삽입 (그누보드 wr_link1 호환)
    // link1_display: 제휴 변환 전 원본 URL (변환된 경우), 없으면 link1 자체가 원본
    const link1Original = $derived(data.post.link1_display || data.post.link1);
    let renderedPostContent = $state(data.post.content);
    let renderedPostContentPostId = data.post.id;
    $effect(() => {
        if (renderedPostContentPostId === data.post.id) return;
        renderedPostContentPostId = data.post.id;
        renderedPostContent = data.post.content;
    });
    const postContent = $derived(
        data.post.deleted_at
            ? ''
            : link1Original && isEmbeddable(link1Original)
              ? `${link1Original}\n${renderedPostContent}`
              : renderedPostContent
    );

    // 소명글 ↔ 이용제한 연동: link1에서 disciplinelog ID 추출
    const linkedDisciplinelogId = $derived(() => {
        const link = data.post?.link1;
        if (!link) return null;
        const match = link.match(/^disciplinelog[:/](\d+)$/);
        return match ? match[1] : null;
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
    $effect(() => {
        if (boardType !== 'giving') return;
        const p = '../../../../../../plugins/giving/hooks/register-layouts.js';
        import(p).then((m: { default: () => void }) => m.default()).catch(() => {});
    });
    const isUsedMarket = $derived(boardType === 'used-market');

    // 플러그인 슬롯
    const beforeContentSlots = $derived(postSlotRegistry.resolve('post.before_content', boardType));
    const afterContentSlots = $derived(postSlotRegistry.resolve('post.after_content', boardType));
    const beforeCommentsSlots = $derived(
        postSlotRegistry.resolve('post.before_comments', boardType)
    );

    // 중고게시판 상태 관리
    // eslint-disable-next-line svelte/prefer-writable-derived -- board navigation resets state from streamed page data
    let marketStatus = $state<MarketStatus>('selling');
    let syncedMarketStatusPostId: number | null = null;
    $effect(() => {
        const postId = data.post.id;
        if (syncedMarketStatusPostId === postId) return;
        syncedMarketStatusPostId = postId;
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

    // 댓글/프로모션/리비전 — Streaming SSR (2단계 데이터)
    let comments = $state<FreeComment[]>(data.commentsData?.comments.items || []);
    let commentsTotal = $state<number>(data.commentsData?.comments.total || comments.length);
    let truthroomCommentMap = $state<Record<number, number>>({});
    let promotionPosts = $state<PromotionPost[]>([]);
    let revisions = $state<PostRevision[]>([]);
    let initialLikedCommentIds = $state<number[]>([]);
    let initialDislikedCommentIds = $state<number[]>([]);
    let commentsLoaded = $state(true);
    let commentsError = $state(false);
    let commentsRecoveryVisible = $state(false);
    let commentsAutoRecoveryTriggered = $state(false);
    let commentsDirectFetchAttempted = $state(false);
    let commentsDirectFetchInFlight = $state(false);
    let auxiliaryLoaded = $state(false);
    let isScrapped = $state(false);
    let postReportCount = $state<number | string | null>(null);
    let syncedCommentsPostId: number | null = null;
    let syncedReactionStatePostId: number | null = null;
    let trackedPostViewKey = '';
    let resetDetailUiPostId: number | null = null;

    $effect(() => {
        const postId = data.post.id;
        if (syncedCommentsPostId === postId) return;

        const result = data.commentsData;
        syncedCommentsPostId = postId;

        comments = result?.comments.items || [];
        commentsTotal = result?.comments.total || comments.length;
        initialLikedCommentIds = [];
        initialDislikedCommentIds = [];
        truthroomCommentMap = {};
        commentsLoaded = true;
        commentsError = false;
        commentsRecoveryVisible = false;
        commentsAutoRecoveryTriggered = false;
        commentsDirectFetchAttempted = false;
        commentsDirectFetchInFlight = false;
    });

    $effect(() => {
        const promise = data.streamed?.auxiliaryData;

        // 글 변경 시 이전 스트리밍 데이터 즉시 리셋
        postReactions = undefined;
        reactionsMap = undefined;
        lastFetchedReactionsKey = '';

        if (!promise) {
            // SPA 내비게이션: auxiliaryData 없음 → 리액션 직접 fetch
            if (browser) fetchBatchReactions();
            return;
        }

        let cancelled = false;
        promotionPosts = [];
        revisions = [];
        isScrapped = false;
        postReportCount = null;
        isLiked = false;
        isDisliked = false;
        initialLikedCommentIds = [];
        initialDislikedCommentIds = [];
        truthroomCommentMap = {};
        scheduledDelete = null;
        auxiliaryLoaded = false;

        promise
            .then((result) => {
                if (cancelled) return;
                promotionPosts = Array.isArray(result.promotionPosts)
                    ? (result.promotionPosts as PromotionPost[])
                    : [];

                if (result.reactions && Object.keys(result.reactions).length > 0) {
                    reactionsMap = result.reactions as Record<string, ReactionItem[]>;
                    const docTargetId = generateDocumentTargetId(boardId, data.post.id);
                    postReactions =
                        (result.reactions as Record<string, ReactionItem[]>)[docTargetId] || [];
                }

                if (result.transformedPostContent) {
                    renderedPostContent = result.transformedPostContent;
                }

                if (result.isScrapped) {
                    isScrapped = result.isScrapped;
                }

                if (result.postReportCount != null) {
                    postReportCount = result.postReportCount;
                }

                if (result.postLikeStatus) {
                    isLiked = result.postLikeStatus.userLiked;
                    isDisliked = result.postLikeStatus.userDisliked;
                }

                if (result.commentLikeStatuses) {
                    initialLikedCommentIds = result.commentLikeStatuses.likedIds || [];
                    initialDislikedCommentIds = result.commentLikeStatuses.dislikedIds || [];
                }

                if (result.truthroomCommentMap) {
                    truthroomCommentMap = result.truthroomCommentMap;
                }

                scheduledDelete = result.scheduledDelete ?? null;

                auxiliaryLoaded = true;
            })
            .catch(() => {
                if (cancelled) return;
                auxiliaryLoaded = true;
            });

        return () => {
            cancelled = true;
        };
    });

    $effect(() => {
        const authorId = data.post.author_id;
        if (!browser || !authorId) return;

        const loadTask = () => {
            if (document.visibilityState === 'hidden') return;
            void memberLevelStore.fetchLevels([authorId]);
        };

        if (typeof window.requestIdleCallback === 'function') {
            const idleId = window.requestIdleCallback(loadTask, { timeout: 1500 });
            return () => window.cancelIdleCallback?.(idleId);
        }

        const timer = globalThis.setTimeout(loadTask, 200);
        return () => {
            globalThis.clearTimeout(timer);
        };
    });

    let isCreatingComment = $state(false);
    let isRefreshingComments = $state(false);

    function requestStaleClientRecovery(reason: string): void {
        if (!browser) return;
        window.dispatchEvent(
            new CustomEvent('angple:stale-client-recovery', { detail: { reason } })
        );
    }

    $effect(() => {
        if (!browser || !canViewSecret) return;
        if (commentsLoaded || commentsError || commentsAutoRecoveryTriggered) return;

        const timer = window.setTimeout(() => {
            if (document.visibilityState === 'hidden' || navigator.onLine === false) {
                return;
            }
            if (!commentsDirectFetchAttempted || commentsDirectFetchInFlight) {
                return;
            }
            commentsRecoveryVisible = true;
            commentsAutoRecoveryTriggered = true;
            requestStaleClientRecovery('comments-skeleton-timeout');
        }, 12000);

        return () => {
            window.clearTimeout(timer);
        };
    });

    async function refreshComments() {
        if (isRefreshingComments) return;
        isRefreshingComments = true;
        try {
            const result = await apiClient.getBoardComments(boardId, String(data.post.id));
            const expectedComments = Number(data.post.comments_count || 0);
            if (expectedComments > 0 && result.items.length === 0) {
                commentsError = true;
                commentsRecoveryVisible = true;
                return;
            }
            comments = result.items;
            data.post.comments_count = result.total || result.items.length;
            commentsError = false;
            commentsRecoveryVisible = false;
        } catch {
            commentsError = true;
            commentsRecoveryVisible = true;
        } finally {
            isRefreshingComments = false;
        }
    }

    // 추천/비추천 상태
    // eslint-disable-next-line svelte/prefer-writable-derived -- count is later updated optimistically after user actions
    let likeCount = $state(0);
    let dislikeCount = $state(0);
    $effect(() => {
        const postId = data.post.id;
        if (syncedReactionStatePostId === postId) return;
        syncedReactionStatePostId = postId;
        likeCount = data.post.likes;
        dislikeCount = data.post.dislikes ?? 0;
    });
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

    // 삭제 예약 상태
    let scheduledDelete = $state<{
        scheduled: boolean;
        scheduled_at: string;
        requested_at: string;
        delay_minutes: number;
    } | null>(null);

    // 리비전 히스토리 (Streaming SSR로 로드)

    // 신고 다이얼로그 상태
    let showReportDialog = $state(false);

    // 리액션 일괄 조회 (게시글 + 모든 댓글)
    let postReactions = $state<ReactionItem[] | undefined>(undefined);
    let reactionsMap = $state<Record<string, ReactionItem[]> | undefined>(undefined);

    let lastFetchedReactionsKey = '';

    async function fetchBatchReactions(): Promise<void> {
        if (!reactionPluginActive) return;
        const parentId = generateParentId(boardId, data.post.id);
        // 동일 parentId 중복 호출 방지 (SPA 네비게이션 시 이중 fetch 제거)
        if (lastFetchedReactionsKey === parentId && reactionsMap) return;
        lastFetchedReactionsKey = parentId;
        try {
            const res = await fetch(`/api/reactions?parentId=${encodeURIComponent(parentId)}`);
            const json = await res.json();
            if (json.status === 'success' && json.result) {
                reactionsMap = json.result;
                const docTargetId = generateDocumentTargetId(boardId, data.post.id);
                postReactions = json.result[docTargetId] || [];
            }
        } catch (err) {
            console.error('Failed to batch-load reactions:', err);
        }
    }

    // 이전글/다음글 (스트리밍)
    let adjacentPosts = $state<AdjacentPosts>({ prev: null, next: null });

    $effect(() => {
        const streamed = data.streamed as Record<string, unknown> | undefined;
        const promise = streamed?.adjacentPosts as Promise<AdjacentPosts> | undefined;
        if (!promise) return;
        promise
            .then((result: AdjacentPosts) => {
                adjacentPosts = result;
            })
            .catch(() => {});
    });

    // `,` `.` 이전글/다음글 키보드 단축키
    function handleAdjacentKeydown(event: KeyboardEvent) {
        if (event.target instanceof HTMLElement) {
            const tag = event.target.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (event.target.contentEditable === 'true') return;
        }
        if (event.ctrlKey || event.altKey || event.metaKey) return;

        if (event.code === 'Comma' && adjacentPosts.prev) {
            event.preventDefault();
            goto(`/${boardId}/${adjacentPosts.prev.id}`);
        } else if (event.code === 'Period' && adjacentPosts.next) {
            event.preventDefault();
            goto(`/${boardId}/${adjacentPosts.next.id}`);
        }
    }

    if (browser) {
        document.addEventListener('keydown', handleAdjacentKeydown);
    }

    onDestroy(() => {
        if (browser) {
            document.removeEventListener('keydown', handleAdjacentKeydown);
        }
    });

    // 터치 제스처 (스와이프 이전/다음글, 더블탭 추천)
    const touchGestures = new TouchGestureService();

    $effect(() => {
        if (!browser) return;
        if (uiSettingsStore.enableTouchGestures) {
            touchGestures.activate(
                {
                    onSwipeLeft: () => {
                        if (adjacentPosts.next) goto(`/${boardId}/${adjacentPosts.next.id}`);
                    },
                    onSwipeRight: () => {
                        if (adjacentPosts.prev) goto(`/${boardId}/${adjacentPosts.prev.id}`);
                    },
                    onDoubleTap: () => {
                        handleLike();
                    }
                },
                {
                    swipeThreshold: uiSettingsStore.swipeThreshold,
                    doubleTapInterval: uiSettingsStore.doubleTapInterval
                }
            );
        } else {
            touchGestures.deactivate();
        }

        return () => {
            touchGestures.deactivate();
        };
    });

    // 읽음 표시 + GA4 이벤트 — SPA 네비게이션(하단 리스트 클릭)에서도 반응
    $effect(() => {
        const postViewKey = `${boardId}:${data.post.id}`;
        if (trackedPostViewKey === postViewKey) return;
        trackedPostViewKey = postViewKey;
        readPostsStore.markAsRead(boardId, data.post.id);
        trackPostView(boardId, data.post.id);
    });

    // 조회수: SSR에서 처리 (CDN 요청 제거)
    // 레벨/리액션/추천자 아바타: SSR 스트리밍에서 로드 (CDN 요청 제거)
    onMount(() => {
        // GA4: Scroll Depth 추적 (IntersectionObserver)
        const sentinels = document.querySelectorAll<HTMLElement>('[data-scroll-depth]');
        let cleanupScrollObserver: (() => void) | undefined;
        if (sentinels.length > 0) {
            cleanupScrollObserver = createScrollDepthObserver(sentinels, (depth) => {
                trackEvent('scroll_depth', {
                    board_id: boardId,
                    post_id: data.post.id,
                    depth
                });
            });
        }

        // 훅: 게시글 렌더링 후 (플러그인 확장 포인트)
        doAction('after_post_render', { post: data.post, boardId, boardType });

        // 댓글 수 추적 (새 댓글 표시용)
        commentTracker.markSeen(boardId, data.post.id, data.post.comments_count ?? 0);

        // 플로팅 바 댓글 새로고침 이벤트 수신
        const handleCommentRefresh = () => {
            refreshComments();
            // 댓글 영역으로 스크롤
            const commentSection = document.getElementById('comments');
            if (commentSection) {
                commentSection.scrollIntoView({ behavior: 'smooth' });
            }
        };
        window.addEventListener('comment-refresh', handleCommentRefresh);

        // 추천 상태 조회 (SSR 스트리밍으로 로드, fallback으로 클라이언트 호출)
        if (!auxiliaryLoaded) {
            (async () => {
                try {
                    const status = await apiClient.getPostLikeStatus(boardId, String(data.post.id));
                    isLiked = status.user_liked;
                    isDisliked = status.user_disliked ?? false;
                    likeCount = status.likes;
                    dislikeCount = status.dislikes ?? 0;
                } catch (err) {
                    console.error('Failed to load like status:', err);
                }
            })();
        }

        return () => {
            cleanupScrollObserver?.();
            window.removeEventListener('comment-refresh', handleCommentRefresh);
        };
    });

    // 글 이동 시 상태 리셋 (같은 레이아웃 내 다른 글로 이동할 때)
    $effect(() => {
        const postId = data.post.id;
        if (resetDetailUiPostId === postId) return;
        resetDetailUiPostId = postId;
        likers = [];
        likersTotal = 0;
        showLikersDialog = false;
        likersPage = 1;
        editingMemoFor = null;
        scheduledDelete = null;
    });

    // 앵커 스크롤 + 하이라이트 헬퍼
    function scrollToAndHighlight(el: HTMLElement) {
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

    function getAnchorTargetId(hash: string): string | null {
        if (!hash) return null;

        if (hash.startsWith('#comment_')) {
            return `c_${hash.slice('#comment_'.length)}`;
        }
        if (hash.startsWith('#comment-')) {
            return `c_${hash.slice('#comment-'.length)}`;
        }
        if (hash.startsWith('#c_')) {
            return hash.slice(1);
        }
        if (hash === '#likes') {
            return 'likes';
        }

        return null;
    }

    function scheduleAnchorScroll(hash = browser ? window.location.hash : ''): void {
        const targetId = getAnchorTargetId(hash);
        if (!targetId) return;

        let attempts = 0;
        const tryScroll = () => {
            const el = document.getElementById(targetId);
            if (el) {
                scrollToAndHighlight(el);
            } else if (attempts < 20) {
                attempts++;
                requestAnimationFrame(tryScroll);
            }
        };

        requestAnimationFrame(tryScroll);
    }

    // 앵커 스크롤 (#c_댓글ID, #comment_댓글ID, #likes) — 스트리밍 완료 후 실행
    $effect(() => {
        if (commentsLoaded && browser) {
            scheduleAnchorScroll();
        }
    });

    onMount(() => {
        const onHashChange = () => {
            if (commentsLoaded) {
                scheduleAnchorScroll();
            }
        };

        afterNavigate(() => {
            scheduleAnchorScroll();
        });

        window.addEventListener('hashchange', onHashChange);

        return () => {
            window.removeEventListener('hashchange', onHashChange);
        };
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

    // 시간만 표시 (같은 날이면 HH:MM, 다른 날이면 MM.DD HH:MM)
    function formatTimeShort(dateString: string, refDateString?: string): string {
        const date = new Date(dateString);
        const ref = refDateString ? new Date(refDateString) : new Date();
        const opts: Intl.DateTimeFormatOptions = {
            timeZone: 'Asia/Seoul',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        const sameDay =
            date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) ===
            ref.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
        if (sameDay) {
            return date.toLocaleTimeString('ko-KR', opts);
        }
        return date.toLocaleDateString('ko-KR', {
            timeZone: 'Asia/Seoul',
            month: '2-digit',
            day: '2-digit',
            ...opts
        });
    }

    // 파일 크기 포맷
    function formatFileSize(bytes: number): string {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    const backToListHref = $derived.by(() => {
        const pageParam = $page.url.searchParams.get('page');
        return pageParam ? `/${boardId}?page=${pageParam}` : `/${boardId}`;
    });

    // 목록으로 돌아가기
    function goBack(): void {
        if (browser) {
            window.location.assign(backToListHref);
            return;
        }
        goto(backToListHref);
    }

    // 수정 페이지로 이동
    function goToEdit(): void {
        goto(`/${boardId}/${data.post.id}/edit`);
    }

    // 직접홍보 끌어올리기
    let isBumping = $state(false);
    let showBumpDialog = $state(false);
    async function handleBump(): Promise<void> {
        if (isBumping) return;
        isBumping = true;
        try {
            await apiClient.bumpPost(boardId, String(data.post.id));
            fetch('/api/boards/promotion/invalidate-cache', { method: 'POST' }).catch(() => {});
            showBumpDialog = false;
            alert('끌어올리기 완료! 목록에서 최상단으로 이동했습니다.');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : '끌어올리기에 실패했습니다.';
            alert(message);
            console.error('[bump]', err);
        } finally {
            isBumping = false;
        }
    }

    // 직접홍보 다시 쓰기 확인
    let showRepostDialog = $state(false);

    // 작성자 확인
    const isAuthor = $derived(
        authStore.user?.mb_id === data.post.author_id ||
            authStore.user?.mb_name === data.post.author
    );

    // 수정/삭제 권한 (작성자 또는 관리자)
    const isAdmin = $derived((authStore.user?.mb_level ?? 0) >= 10);
    const canModify = $derived(isAuthor || isAdmin);

    // 직접홍보 게시판 만료 여부
    const promotionExpired = $derived(data.promotionExpired === true && !isAuthor);

    // 비밀글 접근 권한 (작성자만 열람 가능, 홍보 만료 글도 차단)
    const canViewSecret = $derived((!data.post.is_secret || isAuthor) && !promotionExpired);

    // 댓글 레이아웃 (관리자 변경 시 즉시 반영용)
    // eslint-disable-next-line svelte/prefer-writable-derived -- layout must refresh from route data while remaining locally writable
    const commentLayout = $derived(data.board?.display_settings?.comment_layout || 'flat');

    // 삭제 예약 취소
    let isCancellingDelete = $state(false);
    async function handleCancelDelete(): Promise<void> {
        if (!confirm('삭제 예약을 취소하시겠습니까?')) return;
        isCancellingDelete = true;
        try {
            await apiClient.cancelScheduledDelete(boardId, String(data.post.id));
            scheduledDelete = null;
        } catch (err) {
            console.error('Failed to cancel scheduled delete:', err);
            alert('삭제 예약 취소에 실패했습니다.');
        } finally {
            isCancellingDelete = false;
        }
    }

    // 게시글 삭제
    async function handleDelete(): Promise<void> {
        isDeleting = true;
        try {
            const result = await apiClient.deletePost(boardId, String(data.post.id));
            if (result.scheduled) {
                // 지연 삭제: 현재 페이지에서 배너 표시
                scheduledDelete = {
                    scheduled: true,
                    scheduled_at: result.scheduled_at || '',
                    requested_at: new Date().toISOString(),
                    delay_minutes: result.delay_minutes || 0
                };
                return;
            }
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

    // 삭제된 게시글 복구 (관리자 전용 — /admin에서만 접근)
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

        if (!canUseCertifiedAction(authStore.user, boardId)) {
            goToCertification();
            return;
        }

        if (isLiking) return;

        const prevLiked = isLiked;
        const prevDisliked = isDisliked;
        const prevLikeCount = likeCount;
        const prevDislikeCount = dislikeCount;
        const canOptimisticallyToggle = !isDisliked;

        isLiking = true;
        try {
            if (canOptimisticallyToggle) {
                isLiked = !prevLiked;
                likeCount = Math.max(prevLikeCount + (prevLiked ? -1 : 1), 0);
            }

            const response = await apiClient.likePost(boardId, String(data.post.id));
            const wasLiked = prevLiked;
            isLiked = response.user_liked;
            isDisliked = response.user_disliked ?? false;
            likeCount = response.likes;
            dislikeCount = response.dislikes ?? 0;

            // 추천 성공 시 애니메이션 (취소가 아닌 경우만)
            if (!wasLiked && isLiked) {
                trackEvent('like', { board_id: boardId, post_id: data.post.id });
                isLikeAnimating = true;
                setTimeout(() => {
                    isLikeAnimating = false;
                }, 1000);
            }

            // 아바타 스택 갱신
            loadLikerAvatars();
        } catch (err) {
            isLiked = prevLiked;
            isDisliked = prevDisliked;
            likeCount = prevLikeCount;
            dislikeCount = prevDislikeCount;
            console.error('Failed to like post:', err);
            if (err instanceof Error && err.message.includes('실명인증')) {
                goToCertification();
                return;
            }
            alert('공감에 실패했습니다.');
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

        if (!canUseCertifiedAction(authStore.user, boardId)) {
            goToCertification();
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

            trackEvent('dislike', { board_id: boardId, post_id: data.post.id });

            // 아바타 스택 갱신
            loadLikerAvatars();
        } catch (err) {
            console.error('Failed to dislike post:', err);
            if (err instanceof Error && err.message.includes('실명인증')) {
                goToCertification();
                return;
            }
            alert('비공감에 실패했습니다.');
        } finally {
            isDisliking = false;
        }
    }

    // 추천자 목록 로드
    async function loadLikers(): Promise<void> {
        if (!authStore.isAuthenticated) return;
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
            likers = response.likers ?? [];
            likersTotal = response.total ?? 0;
        } catch (err) {
            console.error('Failed to load likers:', err);
        } finally {
            isLoadingLikers = false;
        }
    }

    // 추천자 더보기 로드
    async function loadMoreLikers(): Promise<void> {
        if (!authStore.isAuthenticated) return;
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
            likers = [...likers, ...(response.likers ?? [])];
            likersTotal = response.total ?? 0;
            likersPage = nextPage;
        } catch (err) {
            console.error('Failed to load more likers:', err);
        } finally {
            isLoadingMoreLikers = false;
        }
    }

    // 추천자 아바타 미리 로드 (상위 5명)
    async function loadLikerAvatars(): Promise<void> {
        if (!authStore.isAuthenticated) {
            likers = [];
            likersTotal = 0;
            return;
        }
        try {
            const response = await apiClient.getPostLikers(boardId, String(data.post.id), 1, 5);
            likers = response.likers ?? [];
            likersTotal = response.total ?? 0;
        } catch (err) {
            console.error('Failed to load liker avatars:', err);
        }
    }

    // 서버에서 댓글 목록 다시 가져오기
    async function refetchComments(): Promise<void> {
        const res = await fetch(
            `/api/boards/${boardId}/posts/${data.post.id}/comments?page=1&limit=200`
        );
        const json = await res.json();
        if (json.success) {
            comments = json.data.comments;
            commentsTotal = json.data.total || json.data.comments?.length || comments.length;
            // backfill 완료 후 앵커 스크롤 재시도 (#c_댓글ID로 접근 시)
            requestAnimationFrame(() => scheduleAnchorScroll());
        }
        // 리액션도 함께 로드 (SPA 내비게이션 시 auxiliaryData가 없을 수 있음)
        fetchBatchReactions();
        // 댓글 작성자 레벨 batch fetch
        if (comments.length > 0) {
            const authorIds = [...new Set(comments.map((c: { author_id: string }) => c.author_id))];
            memberLevelStore.fetchLevels(authorIds);
        }
    }

    // 댓글 backfill: SSR에서 일부만 로드된 경우 전체 댓글 가져오기
    // onMount 대신 $effect로 SPA 네비게이션에서도 동작하도록
    $effect(() => {
        if (!browser || !canViewSecret) return;
        const total = commentsTotal;
        const loaded = comments.length;
        if (total <= loaded) return;

        if (loaded === 0) {
            void refetchComments();
            return;
        }

        const timer = window.setTimeout(() => {
            void refetchComments();
        }, 1500);

        return () => {
            window.clearTimeout(timer);
        };
    });

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

            // 서버에서 정렬된 댓글 목록 다시 가져오기
            await refetchComments();

            // @멘션 알림 전송 (fire-and-forget)
            sendMentionNotifications({
                content,
                postUrl: `/${boardId}/${data.post.id}`,
                postTitle: data.post.title,
                boardId,
                postId: data.post.id,
                commentId: newComment?.id,
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
        if (isCreatingComment) return;
        isCreatingComment = true;
        try {
            if (!authStore.user) {
                throw new Error('로그인이 필요합니다.');
            }

            const replyComment = await apiClient.createComment(boardId, String(data.post.id), {
                content,
                author: authStore.user.mb_name,
                parent_id: parentId,
                is_secret: isSecret,
                images
            });

            // 서버에서 정렬된 댓글 목록 다시 가져오기
            await refetchComments();

            // @멘션 알림 전송 (fire-and-forget)
            sendMentionNotifications({
                content,
                postUrl: `/${boardId}/${data.post.id}`,
                postTitle: data.post.title,
                boardId,
                postId: data.post.id,
                commentId: replyComment?.id,
                senderName: authStore.user.mb_name,
                senderId: authStore.user.mb_id || ''
            });
        } finally {
            isCreatingComment = false;
        }
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

        // 서버에서 댓글 목록 다시 가져오기 (삭제된 댓글 포함 정확한 상태 반영)
        await refetchComments();
    }

    async function handleRestoreComment(commentId: string): Promise<void> {
        await apiClient.restoreComment(boardId, String(data.post.id), commentId);
        await refetchComments();
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
    const postDescription = $derived(renderedPostContent.replace(/<[^>]+>/g, '').slice(0, 160));

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
                canonicalUrl: postUrl,
                noIndex: data.post.is_secret || !!data.post.deleted_at
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
                    author: data.post.deleted_at ? '' : data.post.author,
                    authorUrl: data.post.deleted_at ? undefined : authorUrl,
                    datePublished: data.post.created_at,
                    dateModified: data.post.updated_at || undefined,
                    url: postUrl,
                    commentCount: comments.length,
                    upvoteCount: data.post.likes || 0,
                    image: data.post.thumbnail || data.post.images?.[0]
                }),
                // Article - 일반 검색 결과용 (폴백)
                createArticleJsonLd({
                    headline: data.post.title,
                    author: data.post.deleted_at ? '' : data.post.author,
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

{#if data.watermark}
    <Watermark
        nickname={data.watermark.nickname}
        userId={data.watermark.userId}
        clientIp={data.watermark.clientIp}
        pageTitle={boardTitle}
    />
{/if}

<div class="mx-auto pt-2">
    <!-- 최상단 자체 배너 (없으면 GAM 폴백) -->
    {#if widgetLayoutStore.hasEnabledAds && !data.post.deleted_at}
        <div class="mb-3">
            <PluginSlot name="board-view-banner" />
        </div>
    {/if}

    <!-- 브레드크럼 -->
    <nav
        class="text-muted-foreground -mx-2 mb-1 flex items-center gap-1 px-2 text-sm md:mx-0 md:px-0"
        aria-label="breadcrumb"
    >
        <a href="/" class="hover:text-foreground transition-colors">홈</a>
        <span class="text-muted-foreground/50">/</span>
        <a href="/{data.boardId}" class="hover:text-foreground transition-colors">{boardTitle}</a>
        <span class="text-muted-foreground/50">/</span>
        <span class="text-foreground max-w-[200px] truncate sm:max-w-[400px]"
            >{data.post.title}</span
        >
    </nav>

    <!-- 상단 네비게이션 -->
    <div class="-mx-2 mb-2 flex items-center gap-3 px-2 py-2 md:mx-0 md:px-0">
        <Button variant="ghost" size="sm" onclick={() => history.back()} class="shrink-0">←</Button>
        <Button variant="outline" size="sm" onclick={goBack} class="shrink-0">목록으로</Button>

        <div class="flex-1"></div>

        <div class="flex shrink-0 gap-2">
            {#if authStore.isAuthenticated}
                <ScrapButton
                    boardId={data.boardId}
                    postId={data.post.id}
                    initialScrapped={isScrapped}
                />
            {/if}
            {#if canModify}
                <Button variant="outline" size="sm" onclick={goToEdit}>
                    <Pencil class="mr-1 h-4 w-4" />
                    수정
                </Button>
            {/if}
            {#if canModify}
                <DeleteConfirmDialog
                    title="게시글 삭제"
                    description="이 게시글을 삭제하시겠습니까? 댓글은 유지됩니다."
                    onConfirm={handleDelete}
                    isLoading={isDeleting}
                />
            {/if}
            {#if boardId === 'promotion' && isAuthor}
                <Dialog.Root bind:open={showRepostDialog}>
                    <Dialog.Trigger>
                        <Button variant="outline" size="sm">
                            <RefreshCw class="mr-1 h-4 w-4" />
                            이 글 복제
                        </Button>
                    </Dialog.Trigger>
                    <Dialog.Content>
                        <Dialog.Header>
                            <Dialog.Title>이전 글 복제</Dialog.Title>
                            <Dialog.Description>
                                이전 글의 내용을 복사하여 새 글을 작성합니다.
                            </Dialog.Description>
                        </Dialog.Header>
                        <div
                            class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                        >
                            이전 글 복제 시 <strong>1일 글쓰기 1회가 차감</strong>됩니다.
                        </div>
                        <Dialog.Footer>
                            <Button variant="outline" onclick={() => (showRepostDialog = false)}
                                >취소</Button
                            >
                            <Button
                                onclick={() => {
                                    showRepostDialog = false;
                                    goto(`/promotion/write?repost=${data.post.id}`);
                                }}
                            >
                                복제하여 새 글 쓰기
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Root>
                <Dialog.Root bind:open={showBumpDialog}>
                    <Dialog.Trigger>
                        <Button variant="outline" size="sm" disabled={isBumping}>
                            <ArrowUpCircle class="mr-1 h-4 w-4" />
                            {isBumping ? '처리 중...' : '끌어올리기'}
                        </Button>
                    </Dialog.Trigger>
                    <Dialog.Content>
                        <Dialog.Header>
                            <Dialog.Title>글 끌어올리기</Dialog.Title>
                            <Dialog.Description>
                                이 글을 목록 최상단으로 이동합니다.
                            </Dialog.Description>
                        </Dialog.Header>
                        <div
                            class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
                        >
                            끌어올리기 시 <strong>1일 글쓰기 1회가 차감</strong>됩니다.<br />
                            하루 2회, 1시간 간격으로 사용 가능합니다.
                        </div>
                        <Dialog.Footer>
                            <Button
                                variant="outline"
                                onclick={() => (showBumpDialog = false)}
                                disabled={isBumping}>취소</Button
                            >
                            <Button onclick={handleBump} disabled={isBumping}>
                                {isBumping ? '처리 중...' : '끌어올리기'}
                            </Button>
                        </Dialog.Footer>
                    </Dialog.Content>
                </Dialog.Root>
            {/if}
        </div>
    </div>

    <!-- 축하 메시지 롤링 (슬롯 기반) -->
    <div class="mb-4">
        <PluginSlot name="board-view-rolling" />
    </div>

    <!-- 축하메시지 아래 구글 광고 -->
    {#if widgetLayoutStore.hasEnabledAds && !data.post.deleted_at}
        <div class="mb-3">
            <AdSlot position="board-content" height="90px" slotKey="board-view-head-ad" />
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
        <!-- 삭제 예약 배너 -->
        {#if scheduledDelete?.scheduled}
            <div
                class="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30"
                role="status"
            >
                <div class="flex items-start gap-3">
                    <Clock class="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div class="flex-1">
                        <p class="font-medium text-amber-800 dark:text-amber-300">
                            이 게시물은 삭제가 예약되어 있습니다.
                        </p>
                        <p class="mt-1 text-sm text-amber-600 dark:text-amber-400">
                            삭제 예정: {new Date(scheduledDelete.scheduled_at).toLocaleString(
                                'ko-KR',
                                {
                                    timeZone: 'Asia/Seoul',
                                    hour12: false
                                }
                            )}
                            ({scheduledDelete.delay_minutes}분 지연)
                        </p>
                    </div>
                    {#if canModify}
                        <button
                            onclick={handleCancelDelete}
                            disabled={isCancellingDelete}
                            class="shrink-0 rounded-md border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900"
                        >
                            {isCancellingDelete ? '취소 중...' : '삭제 취소'}
                        </button>
                    {/if}
                </div>
            </div>
        {/if}

        <!-- 삭제된 게시물 배너 -->
        {#if data.post.deleted_at}
            <div class="mb-4">
                <DeletedPostBanner postId={data.post.id} deletedAt={data.post.deleted_at} />
            </div>
        {/if}

        <!-- 소명글 ↔ 이용제한 연동 배너 -->
        {#if boardId === 'claim' && linkedDisciplinelogId()}
            <div
                class="mb-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
            >
                <FileText class="h-4 w-4 shrink-0" />
                <span>이 글은 이용제한 기록과 연결되어 있습니다.</span>
                <a
                    href="/disciplinelog/{linkedDisciplinelogId()}"
                    class="font-medium underline hover:no-underline"
                >
                    이용제한 기록 보기
                </a>
            </div>
        {/if}

        <!-- 게시글 카드 (뷰 레이아웃) -->
        {#if ViewComponent}
            <ViewComponent
                post={data.post}
                board={data.board}
                {boardId}
                {isAuthor}
                isAdmin={authStore.user?.mb_id === 'admin'}
                {canViewSecret}
                {promotionExpired}
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
                fontSizeLabel={fontSize}
                onLike={handleLike}
                onDislike={handleDislike}
                onLoadLikers={loadLikers}
                onReport={() => {
                    if (data.isRestricted) return;
                    showReportDialog = true;
                }}
                onChangeFontSize={changeFontSize}
                {memoPluginActive}
                {reactionPluginActive}
                {MemoBadge}
                {beforeContentSlots}
                {afterContentSlots}
                {formatDate}
                {formatTimeShort}
                editCount={revisions.filter((r) => r.change_type === 'update').length}
                {formatFileSize}
                {postContent}
                pageData={data}
                {postReactions}
                {postReportCount}
                truthroomPostId={data.truthroomPostId}
                originalPostLink={data.originalPostLink}
            />
        {:else}
            <!-- 폴백: 레이아웃을 resolve할 수 없을 때 기본 메시지 -->
            <div class="text-muted-foreground py-12 text-center">
                레이아웃을 불러올 수 없습니다.
            </div>
        {/if}

        <!-- GA4 Scroll Depth 센티넬 (25%, 50%) -->
        <div data-scroll-depth="25" aria-hidden="true"></div>
        <div data-scroll-depth="50" aria-hidden="true"></div>

        <!-- 중고게시판 상태 변경 (작성자/관리자만) -->
        {#if isUsedMarket && isAuthor}
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
        <!-- 본문 직후, 댓글 직전 광고 (삭제된 글에서는 비표시) -->
        {#if widgetLayoutStore.hasEnabledAds && !data.post.deleted_at}
            <div class="my-6">
                <AdSlot
                    position="board-before-comments"
                    height="90px"
                    slotKey="board-before-comments"
                />
            </div>
        {/if}

        <!-- GA4 Scroll Depth 센티넬 (75%) -->
        <div data-scroll-depth="75" aria-hidden="true"></div>

        <!-- 댓글 섹션 -->
        {#if canViewSecret && commentsError}
            <Card class="bg-background px-3 md:px-3">
                <CardContent class="space-y-4 py-8 text-center">
                    <p class="text-destructive text-sm">댓글을 불러오지 못했습니다.</p>
                    {#if commentsRecoveryVisible}
                        <p class="text-muted-foreground text-sm">
                            오래된 캐시나 이전 배포 자산이 남아 있으면 댓글과 공감이 비정상 동작할
                            수 있습니다.
                        </p>
                        <p class="text-muted-foreground text-xs">
                            다른 사이트 로그인을 풀지 않으려면 브라우저 전체 쿠키 삭제보다 이
                            사이트만 새로고침 복구하는 편이 안전합니다.
                        </p>
                        <div class="flex justify-center gap-2">
                            <Button
                                variant="outline"
                                onclick={refreshComments}
                                disabled={isRefreshingComments}
                            >
                                다시 시도
                            </Button>
                            <Button
                                onclick={() => requestStaleClientRecovery('comments-error-cta')}
                            >
                                강력 새로고침
                            </Button>
                        </div>
                    {/if}
                </CardContent>
            </Card>
        {:else if canViewSecret}
            <Card id="comments" class="bg-background rounded-xl px-3 md:px-3">
                <CardHeader class="flex flex-row items-center justify-between">
                    <div class="flex items-center gap-2">
                        <h3 class="text-foreground text-lg font-semibold">
                            댓글 <span class="text-muted-foreground">({commentsTotal})</span>
                        </h3>
                        <button
                            type="button"
                            onclick={refreshComments}
                            disabled={isRefreshingComments}
                            class="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors disabled:opacity-50"
                            title="댓글 새로고침"
                        >
                            <RefreshCw
                                class="size-4 {isRefreshingComments ? 'animate-spin' : ''}"
                            />
                        </button>
                    </div>
                </CardHeader>
                {#if commentsRecoveryVisible}
                    <div class="border-b px-6 pb-4">
                        <div
                            class="bg-muted/40 text-muted-foreground flex flex-col gap-2 rounded-lg p-3 text-sm"
                        >
                            <p>
                                댓글 로딩이 오래 걸리면 오래된 브라우저 상태를 자동 복구 중일 수
                                있습니다.
                            </p>
                            <div class="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onclick={refreshComments}
                                    disabled={isRefreshingComments}
                                >
                                    댓글 다시 시도
                                </Button>
                                <Button
                                    size="sm"
                                    onclick={() =>
                                        requestStaleClientRecovery(
                                            'comments-loaded-recovery-banner'
                                        )}
                                >
                                    강력 새로고침
                                </Button>
                            </div>
                        </div>
                    </div>
                {/if}
                <CardContent class="space-y-6">
                    {#if !commentsLoaded}
                        <p class="text-muted-foreground text-sm">댓글을 불러오는 중입니다.</p>
                    {/if}
                    <CommentList
                        {comments}
                        onUpdate={handleUpdateComment}
                        onDelete={handleDeleteComment}
                        onRestore={handleRestoreComment}
                        onReply={handleReplyComment}
                        onLike={handleLikeComment}
                        onDislike={handleDislikeComment}
                        postAuthorId={data.post.author_id}
                        {boardId}
                        postId={data.post.id}
                        useNogood={!!data.board?.use_nogood}
                        {commentLayout}
                        {reactionsMap}
                        {initialLikedCommentIds}
                        {initialDislikedCommentIds}
                        {truthroomCommentMap}
                        isRestricted={data.isRestricted}
                    />

                    <div class="border-border border-t pt-6">
                        <div class="mb-3 flex justify-end">
                            <button
                                type="button"
                                onclick={refreshComments}
                                disabled={isRefreshingComments}
                                class="text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-50"
                                title="댓글 새로고침"
                            >
                                <RefreshCw
                                    class="size-3.5 {isRefreshingComments ? 'animate-spin' : ''}"
                                />
                                새로고침
                            </button>
                        </div>
                        {#if data.post.is_comments_disabled}
                            <p class="text-muted-foreground py-6 text-center text-sm">
                                본 게시물은 공지 읽기 전용으로 설정되어 공감과 이모지로 많이 응원해
                                주세요.
                            </p>
                        {:else if boardId === 'claim' && authStore.user?.mb_id !== data.post.author_id && (authStore.user?.mb_level ?? 0) < 10}
                            <p class="text-muted-foreground py-4 text-center text-sm">
                                소명 게시판에서는 관리자와 글 작성자만 댓글을 작성할 수 있습니다.
                            </p>
                        {:else}
                            {#key data.post.id}
                                <CommentForm
                                    onSubmit={handleCreateComment}
                                    isLoading={isCreatingComment}
                                    permissions={data.board?.permissions}
                                    requiredCommentLevel={data.board?.comment_level ?? 3}
                                    isRestricted={data.isRestricted}
                                    {boardId}
                                    onRefresh={refreshComments}
                                    isRefreshing={isRefreshingComments}
                                />
                            {/key}
                        {/if}
                    </div>
                </CardContent>
            </Card>
        {/if}

        <!-- 댓글 아래 광고: 모바일 300x250 GAM+Adfit / 데스크톱 멀티플렉스 -->
        {#if widgetLayoutStore.hasEnabledAds && !data.post.deleted_at}
            <div class="mt-2 block md:hidden">
                <AdSlot
                    position="board-after-comments"
                    height="250px"
                    slotKey="board-after-comments"
                />
            </div>
            <div class="mt-2 hidden md:block">
                <AdsenseMultiplex />
            </div>
            <!-- AdFit 전용 슬롯 (모바일+PC) -->
            <div class="mt-2">
                <AdfitResponsiveSlot
                    desktop={{ unitId: 'DAN-9qdD2GVgW3AXbClR', width: 728, height: 90 }}
                    mobile={{ unitId: 'DAN-ry6MhSvNcdUCMwtP', width: 320, height: 100 }}
                    id="post-after-comments-adfit"
                />
            </div>
        {/if}

        <!-- 댓글 아래 네비게이션 -->
        <div class="-mx-2 mt-4 flex items-center gap-3 px-2 py-2 md:mx-0 md:px-0">
            <Button variant="ghost" size="sm" onclick={() => history.back()} class="shrink-0"
                >←</Button
            >
            <Button variant="outline" size="sm" onclick={goBack} class="shrink-0">목록으로</Button>
            <div class="flex-1"></div>
            {#if authStore.isAuthenticated && checkPermission(data.board, 'can_write', authStore.user ?? null)}
                <Button
                    variant="default"
                    size="sm"
                    href={canUseCertifiedAction(authStore.user, boardId)
                        ? `/${boardId}/write`
                        : undefined}
                    onclick={(e) => {
                        if (!canUseCertifiedAction(authStore.user, boardId)) {
                            e.preventDefault();
                            goToCertification();
                        }
                    }}
                    title={!canUseCertifiedAction(authStore.user, boardId)
                        ? getCertificationBlockedMessage(boardId)
                        : undefined}
                    class="shrink-0"
                >
                    {#if !canUseCertifiedAction(authStore.user, boardId)}실명인증{:else}글쓰기{/if}
                </Button>
            {/if}
        </div>

        <!-- GA4 Scroll Depth 센티넬 (100%) -->
        <div data-scroll-depth="100" aria-hidden="true"></div>
    {/if}
    <!-- /canRead -->
</div>

<!-- 게시판 최근글 목록 -->
{#if canRead}
    <RecentPosts
        {boardId}
        {boardTitle}
        currentPostId={data.post.id}
        limit={20}
        initialPage={data.recentPosts?.page || Number($page.url.searchParams.get('page')) || 1}
        {promotionPosts}
        displaySettings={data.board?.display_settings}
    />
{/if}

{#if authStore.isAuthenticated}
    <!-- 추천자 목록 다이얼로그 -->
    <Dialog.Root
        bind:open={showLikersDialog}
        onOpenChange={(open) => {
            if (!open) editingMemoFor = null;
        }}
    >
        <Dialog.Content class="max-w-md">
            <Dialog.Header>
                <Dialog.Title>공감한 사람들</Dialog.Title>
                <Dialog.Description>
                    이 게시글에 공감한 {likersTotal}명
                </Dialog.Description>
            </Dialog.Header>
            <div class="max-h-96 overflow-y-auto">
                {#if isLoadingLikers}
                    <div class="text-muted-foreground py-8 text-center">불러오는 중...</div>
                {:else if likers.length === 0}
                    <div class="text-muted-foreground py-8 text-center">
                        아직 공감한 사람이 없습니다.
                    </div>
                {:else}
                    <ul class="divide-border divide-y">
                        {#each likers as liker (liker.mb_id)}
                            <li class="py-3">
                                <div class="flex items-center gap-3">
                                    <!-- 프로필 이미지 -->
                                    {#if getAvatarUrl(liker.mb_image, liker.mb_image_updated_at)}
                                        <img
                                            src={getAvatarUrl(
                                                liker.mb_image,
                                                liker.mb_image_updated_at
                                            )}
                                            alt={liker.mb_nick || liker.mb_name}
                                            class="size-8 rounded-full object-cover"
                                            onerror={(e) => {
                                                const img = e.currentTarget as HTMLImageElement;
                                                img.style.display = 'none';
                                                const fallback =
                                                    img.nextElementSibling as HTMLElement;
                                                if (fallback) fallback.style.display = 'flex';
                                            }}
                                        />
                                        <div
                                            class="bg-primary text-primary-foreground hidden size-8 items-center justify-center rounded-full text-sm"
                                        >
                                            {(liker.mb_nick || liker.mb_name)
                                                .charAt(0)
                                                .toUpperCase()}
                                        </div>
                                    {:else}
                                        <div
                                            class="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full text-sm"
                                        >
                                            {(liker.mb_nick || liker.mb_name)
                                                .charAt(0)
                                                .toUpperCase()}
                                        </div>
                                    {/if}

                                    <!-- 닉네임 + 메모배지 + IP + 날짜 -->
                                    <div class="min-w-0 flex-1">
                                        <div class="flex items-center gap-1">
                                            <a
                                                href="/member/{liker.mb_id}"
                                                class="text-foreground hover:text-primary truncate text-sm font-medium"
                                            >
                                                {liker.mb_nick || liker.mb_name}
                                            </a>
                                            {#if authStore.isAuthenticated && memoPluginActive && MemoBadge && !uiSettingsStore.hideMemo}
                                                <MemoBadge
                                                    memberId={liker.mb_id}
                                                    showIcon={true}
                                                    blur={uiSettingsStore.blurMemo}
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
                                {#if authStore.isAuthenticated && memoPluginActive && MemoInlineEditor && editingMemoFor === liker.mb_id}
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
{/if}

<!-- 게시글 신고 다이얼로그 -->
<ReportDialog
    bind:open={showReportDialog}
    targetType="post"
    targetId={data.post.id}
    {boardId}
    postId={data.post.id}
    onClose={() => (showReportDialog = false)}
/>

<!-- 모바일 FAB 그룹 (목록 + 글쓰기) -->
<div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 md:hidden">
    <a
        href="/{boardId}"
        class="bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
        aria-label="목록으로"
    >
        <ListIcon class="h-4 w-4" />
    </a>
    {#if authStore.isAuthenticated && checkPermission(data.board, 'can_write', authStore.user ?? null)}
        <a
            href="/{boardId}/write"
            class="bg-primary text-primary-foreground flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
            aria-label="글쓰기"
        >
            <Pencil class="h-4 w-4" />
        </a>
    {/if}
</div>
