<script lang="ts" module>
    import type { Snapshot } from './$types.js';

    // 뒤로가기 시 스크롤 위치 즉시 복원
    export const snapshot: Snapshot<{ scrollY: number }> = {
        capture: () => ({ scrollY: window.scrollY }),
        restore: (value) => {
            requestAnimationFrame(() => window.scrollTo(0, value.scrollY));
        }
    };
</script>

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
    import RefreshCw from '@lucide/svelte/icons/refresh-cw';
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
    import AdminCommentLayoutSwitcher from '$lib/components/features/board/admin-comment-layout-switcher.svelte';

    import RecentPosts from '$lib/components/features/board/recent-posts.svelte';
    import { ReportDialog } from '$lib/components/features/report/index.js';
    import type { FreeComment, FreePost, LikerInfo, PostRevision } from '$lib/api/types.js';
    import DeletedPostBanner from '$lib/components/post/deleted-post-banner.svelte';
    import RevisionHistory from '$lib/components/post/revision-history.svelte';
    import { sendMentionNotifications } from '$lib/utils/mention-notify.js';
    import type { ReactionItem } from '$lib/types/reaction.js';
    import { generateParentId, generateDocumentTargetId } from '$lib/types/reaction.js';
    import { onMount } from 'svelte';
    import { doAction } from '$lib/hooks/registry';
    import { page } from '$app/stores';
    import { getAvatarUrl } from '$lib/utils/member-icon.js';
    import { isEmbeddable } from '$lib/plugins/auto-embed';
    import AdminPostActions from '$lib/components/features/board/admin-post-actions.svelte';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import PluginSlot from '$lib/components/plugin/plugin-slot.svelte';
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

    $effect(() => {
        if (memoPluginActive) {
            loadPluginComponent('member-memo', 'memo-badge').then((c) => (MemoBadge = c));
            loadPluginComponent('member-memo', 'memo-inline-editor').then(
                (c) => (MemoInlineEditor = c)
            );
        }
    });

    // link1이 동영상 URL이면 본문 앞에 삽입 (그누보드 wr_link1 호환)
    const postContent = $derived(
        !data.post.deleted_at && data.post.link1 && isEmbeddable(data.post.link1)
            ? `<p>${data.post.link1}</p>\n${data.post.content}`
            : data.post.content
    );

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
        // @ts-ignore
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

    // 댓글/프로모션/리비전 — Streaming SSR (2단계 데이터)
    let comments = $state<FreeComment[]>([]);
    let promotionPosts = $state<unknown[]>([]);
    let revisions = $state<PostRevision[]>([]);
    let initialLikedCommentIds = $state<number[]>([]);
    let initialDislikedCommentIds = $state<number[]>([]);
    let commentsLoaded = $state(false);
    let commentsError = $state(false);
    let auxiliaryLoaded = $state(false);
    let isScrapped = $state(false);
    let postReportCount = $state<number | string | null>(null);

    $effect(() => {
        const promise = data.streamed?.commentsData;
        if (!promise) return;

        let cancelled = false;

        // 네비게이션 시 초기화
        comments = [];
        initialLikedCommentIds = [];
        initialDislikedCommentIds = [];
        commentsLoaded = false;
        commentsError = false;

        promise
            .then(
                (result: {
                    comments: {
                        items: FreeComment[];
                        total: number;
                        page: number;
                        limit: number;
                        total_pages: number;
                    };
                    memberLevels?: Record<string, number>;
                    commentLikeStatuses?: { likedIds: number[]; dislikedIds: number[] };
                }) => {
                    if (cancelled) return;
                    comments = result.comments.items || [];

                    // SSR 회원 레벨 적용
                    if (result.memberLevels && Object.keys(result.memberLevels).length > 0) {
                        memberLevelStore.initFromSSR(result.memberLevels);
                    }

                    // SSR 댓글 좋아요 상태 적용
                    if (result.commentLikeStatuses) {
                        initialLikedCommentIds = result.commentLikeStatuses.likedIds || [];
                        initialDislikedCommentIds = result.commentLikeStatuses.dislikedIds || [];
                    }
                    commentsLoaded = true;
                }
            )
            .catch(async () => {
                if (cancelled) return;
                // 스트리밍 실패 시 클라이언트에서 댓글만 직접 재시도 (1회)
                if (browser) {
                    try {
                        const res = await fetch(
                            `/api/boards/${boardId}/posts/${data.post.id}/comments?page=1&limit=200`
                        );
                        if (res.ok) {
                            const json = await res.json();
                            if (json.success && json.data) {
                                comments = json.data.comments || [];
                                commentsLoaded = true;
                                return;
                            }
                        }
                    } catch {
                        // 재시도도 실패
                    }
                }
                commentsError = true;
                commentsLoaded = true;
            });

        return () => {
            cancelled = true;
        };
    });

    $effect(() => {
        const promise = data.streamed?.auxiliaryData;
        if (!promise) return;

        let cancelled = false;

        promotionPosts = [];
        revisions = [];
        auxiliaryLoaded = false;

        promise
            .then(
                (result: {
                    promotionPosts: unknown[];
                    revisions: PostRevision[];
                    reactions?: Record<string, unknown>;
                    likersData?: { likers: LikerInfo[]; total: number };
                    transformedPostContent?: string | null;
                    isScrapped?: boolean;
                    postReportCount?: number | string | null;
                }) => {
                    if (cancelled) return;
                    promotionPosts = result.promotionPosts || [];
                    revisions = result.revisions || [];

                    if (result.reactions && Object.keys(result.reactions).length > 0) {
                        reactionsMap = result.reactions as Record<string, ReactionItem[]>;
                        const docTargetId = generateDocumentTargetId(boardId, data.post.id);
                        postReactions =
                            (result.reactions as Record<string, ReactionItem[]>)[docTargetId] || [];
                    }

                    if (result.likersData) {
                        likers = result.likersData.likers || [];
                        likersTotal = result.likersData.total || 0;
                    }

                    if (result.transformedPostContent) {
                        data.post.content = result.transformedPostContent;
                    }

                    if (result.isScrapped) {
                        isScrapped = result.isScrapped;
                    }

                    if (result.postReportCount != null) {
                        postReportCount = result.postReportCount;
                    }

                    auxiliaryLoaded = true;
                }
            )
            .catch(() => {
                if (cancelled) return;
                auxiliaryLoaded = true;
            });

        return () => {
            cancelled = true;
        };
    });

    let isCreatingComment = $state(false);
    let isRefreshingComments = $state(false);

    async function refreshComments() {
        if (isRefreshingComments) return;
        isRefreshingComments = true;
        try {
            const result = await apiClient.getBoardComments(boardId, String(data.post.id));
            comments = result.items;
        } catch {
            // 실패 시 조용히 무시
        } finally {
            isRefreshingComments = false;
        }
    }

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

    // 리비전 히스토리 (Streaming SSR로 로드)

    // 신고 다이얼로그 상태
    let showReportDialog = $state(false);

    // 리액션 일괄 조회 (게시글 + 모든 댓글)
    let postReactions = $state<ReactionItem[] | undefined>(undefined);
    let reactionsMap = $state<Record<string, ReactionItem[]> | undefined>(undefined);

    async function fetchBatchReactions(): Promise<void> {
        if (!reactionPluginActive) return;
        try {
            const parentId = generateParentId(boardId, data.post.id);
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

    // 초기 추천 상태 + 읽음 표시
    // 조회수: SSR에서 처리 (CDN 요청 제거)
    // 레벨/리액션/추천자 아바타: SSR 스트리밍에서 로드 (CDN 요청 제거)
    onMount(() => {
        // 읽음 표시 (localStorage)
        readPostsStore.markAsRead(boardId, data.post.id);

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

        // 추천 상태 조회 (사용자별 데이터 — 클라이언트 전용)
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

        return () => {
            window.removeEventListener('comment-refresh', handleCommentRefresh);
        };
    });

    // 글 이동 시 상태 리셋 (같은 레이아웃 내 다른 글로 이동할 때)
    $effect(() => {
        // data.post.id 변경 감지
        void data.post.id;
        // 추천자 목록 리셋
        likers = [];
        likersTotal = 0;
        showLikersDialog = false;
        likersPage = 1;
        editingMemoFor = null;
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

    // 앵커 스크롤 (#c_댓글ID, #comment_댓글ID, #likes) — 스트리밍 완료 후 실행
    $effect(() => {
        if (commentsLoaded && browser) {
            const hash = window.location.hash;
            if (!hash) return;

            // #comment_XXX → #c_XXX 호환
            const normalizedHash = hash.startsWith('#comment_')
                ? '#c_' + hash.slice('#comment_'.length)
                : hash;

            setTimeout(() => {
                if (normalizedHash.startsWith('#c_')) {
                    const el = document.getElementById(normalizedHash.slice(1));
                    if (el) scrollToAndHighlight(el);
                } else if (normalizedHash === '#likes') {
                    const el = document.getElementById('likes');
                    if (el) scrollToAndHighlight(el);
                }
            }, 100);
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

    // 직접홍보 게시판 만료 여부
    const promotionExpired = $derived(data.promotionExpired === true && !isAuthor && !isAdmin);

    // 비밀글 접근 권한 (작성자 또는 관리자만 열람 가능, 홍보 만료 글도 차단)
    const canViewSecret = $derived(
        (!data.post.is_secret || isAuthor || isAdmin) && !promotionExpired
    );

    // 댓글 레이아웃 (관리자 변경 시 즉시 반영용)
    let commentLayout = $state(data.board?.display_settings?.comment_layout || 'flat');
    $effect(() => {
        commentLayout = data.board?.display_settings?.comment_layout || 'flat';
    });

    // 공지 상태
    let noticeType = $state<'normal' | 'important' | null>(null);
    $effect(() => {
        noticeType = data.post.notice_type ?? (data.post.is_notice ? 'important' : null);
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
            // 보드 캐시 무효화 → 목록 페이지에서 공지 변경 즉시 반영
            await fetch(`/api/boards/${boardId}/invalidate-cache`, { method: 'POST' });
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
            const result = await apiClient.deletePost(boardId, String(data.post.id));
            if (result.scheduled) {
                alert(result.message || `${result.delay_minutes}분 후 삭제됩니다.`);
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

        if (!canUseCertifiedAction(authStore.user, boardId)) {
            goToCertification();
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

    // 서버에서 댓글 목록 다시 가져오기
    async function refetchComments(): Promise<void> {
        const res = await fetch(
            `/api/boards/${boardId}/posts/${data.post.id}/comments?page=1&limit=200`
        );
        const json = await res.json();
        if (json.success) {
            comments = json.data.comments;
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
            await apiClient.createComment(boardId, String(data.post.id), {
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

        await apiClient.createComment(boardId, String(data.post.id), {
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
                    commentCount: comments.length,
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

{#if data.watermark}
    <Watermark
        nickname={data.watermark.nickname}
        userId={data.watermark.userId}
        clientIp={data.watermark.clientIp}
        pageTitle={boardTitle}
    />
{/if}

<div class="mx-auto pt-2">
    <!-- 상단 배너 (슬롯 기반) -->
    {#if widgetLayoutStore.hasEnabledAds}
        <div class="mb-6">
            <PluginSlot name="board-view-banner" />
        </div>
    {/if}

    <!-- 브레드크럼 -->
    <nav
        class="text-muted-foreground -mx-5 mb-1 flex items-center gap-1 px-5 text-sm md:mx-0 md:px-0"
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
    <div class="-mx-5 mb-2 flex items-center gap-3 px-5 py-2 md:mx-0 md:px-0">
        <Button variant="outline" size="sm" onclick={goBack} class="shrink-0">← 목록으로</Button>

        <div class="flex-1"></div>

        <div class="flex shrink-0 gap-2">
            {#if authStore.isAuthenticated}
                <ScrapButton
                    boardId={data.boardId}
                    postId={data.post.id}
                    initialScrapped={isScrapped}
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

    <!-- 축하 메시지 롤링 (슬롯 기반) -->
    <div class="mb-4">
        <PluginSlot name="board-view-rolling" />
    </div>

    <!-- 네비게이션 아래 GAM 광고 (알뜰구매/중고장터 등 특정 게시판에서만 표시) -->
    {#if widgetLayoutStore.hasEnabledAds && (boardType === 'economy' || boardType === 'used-market')}
        <div class="mb-6">
            <AdSlot position="board-view-top" height="45px" slotKey="board-view-top" />
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
            />
        {:else}
            <!-- 폴백: 레이아웃을 resolve할 수 없을 때 기본 메시지 -->
            <div class="text-muted-foreground py-12 text-center">
                레이아웃을 불러올 수 없습니다.
            </div>
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
                <AdSlot
                    position="board-before-comments"
                    height="90px"
                    slotKey="board-before-comments"
                />
            </div>
        {/if}
        -->

        <!-- 수정 이력 (리비전 히스토리) - 관리자 전용 (스트리밍 완료 후) -->
        {#if isAdmin && auxiliaryLoaded && revisions.length > 0}
            <div class="mb-6">
                <RevisionHistory
                    {revisions}
                    {isAdmin}
                    canRestore={isAdmin}
                    onRestore={handleRestoreRevision}
                />
            </div>
        {/if}

        <!-- 댓글 섹션 (비밀글 열람 가능 + 스트리밍 완료 시 표시) -->
        {#if canViewSecret && !commentsLoaded}
            <Card class="bg-background">
                <CardContent class="space-y-4 py-6">
                    <!-- 댓글 스켈레톤 -->
                    {#each { length: 3 } as _}
                        <div class="flex gap-3">
                            <div class="bg-muted h-8 w-8 animate-pulse rounded-full"></div>
                            <div class="flex-1 space-y-2">
                                <div class="flex items-center gap-2">
                                    <div class="bg-muted h-3.5 w-20 animate-pulse rounded"></div>
                                    <div class="bg-muted h-3 w-16 animate-pulse rounded"></div>
                                </div>
                                <div class="bg-muted h-4 w-full animate-pulse rounded"></div>
                                <div class="bg-muted h-4 w-3/4 animate-pulse rounded"></div>
                            </div>
                        </div>
                    {/each}
                </CardContent>
            </Card>
        {:else if canViewSecret && commentsError}
            <Card class="bg-background">
                <CardContent class="py-8 text-center">
                    <p class="text-destructive text-sm">댓글을 불러오지 못했습니다.</p>
                </CardContent>
            </Card>
        {:else if canViewSecret}
            <Card id="comments" class="bg-background rounded-xl">
                <CardHeader class="flex flex-row items-center justify-between">
                    <div class="flex items-center gap-2">
                        <h3 class="text-foreground text-lg font-semibold">
                            댓글 <span class="text-muted-foreground">({comments.length})</span>
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
                    <AdminCommentLayoutSwitcher
                        {boardId}
                        currentLayout={commentLayout}
                        onLayoutChange={(layoutId) => {
                            commentLayout = layoutId;
                        }}
                    />
                </CardHeader>
                <CardContent class="space-y-6">
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
                        <CommentForm
                            onSubmit={handleCreateComment}
                            isLoading={isCreatingComment}
                            permissions={data.board?.permissions}
                            requiredCommentLevel={data.board?.comment_level ?? 3}
                            {boardId}
                            onRefresh={refreshComments}
                            isRefreshing={isRefreshingComments}
                        />
                    </div>
                </CardContent>
            </Card>
        {/if}

        <!-- 댓글 아래 네비게이션 -->
        <div class="-mx-5 mt-4 flex items-center gap-3 px-5 py-2 md:mx-0 md:px-0">
            <Button variant="outline" size="sm" onclick={goBack} class="shrink-0">← 목록으로</Button
            >
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

        <!-- 댓글~목록 사이 GAM 광고 -->
        {#if widgetLayoutStore.hasEnabledAds}
            <div class="my-3 md:my-4">
                <AdSlot
                    position="board-after-comments"
                    height="90px"
                    slotKey="board-after-comments"
                />
            </div>
        {/if}
    {/if}
    <!-- /canRead -->
</div>

<!-- 게시판 최근글 목록 -->
{#if canRead}
    <RecentPosts
        {boardId}
        {boardTitle}
        currentPostId={data.post.id}
        limit={25}
        initialPage={Number($page.url.searchParams.get('page')) || 1}
        promotionPosts={promotionPosts as any[]}
        displaySettings={data.board?.display_settings}
    />
{/if}

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
                                {#if getAvatarUrl(liker.mb_image)}
                                    <img
                                        src={getAvatarUrl(liker.mb_image)}
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
                                            href="/member/{liker.mb_id}"
                                            class="text-foreground hover:text-primary truncate text-sm font-medium"
                                        >
                                            {liker.mb_nick || liker.mb_name}
                                        </a>
                                        {#if memoPluginActive && MemoBadge && !uiSettingsStore.hideMemo}
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

<!-- 모바일 글쓰기 FAB -->
{#if authStore.isAuthenticated && checkPermission(data.board, 'can_write', authStore.user ?? null)}
    <a
        href="/{boardId}/write"
        class="bg-primary text-primary-foreground fixed bottom-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 md:hidden"
        aria-label="글쓰기"
    >
        <Pencil class="h-4 w-4" />
    </a>
{/if}
