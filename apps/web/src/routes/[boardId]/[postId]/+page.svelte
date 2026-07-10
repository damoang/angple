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
    import { env as publicEnv } from '$env/dynamic/public';
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
    import { BOARD_LIST_PAGE_SIZE } from '$lib/constants/board';
    import { ReportDialog } from '$lib/components/features/report/index.js';
    import type { FreeComment, FreePost, LikerInfo, PostRevision } from '$lib/api/types.js';
    import DeletedPostBanner from '$lib/components/post/deleted-post-banner.svelte';
    import { sendMentionNotifications } from '$lib/utils/mention-notify.js';
    import { insertReplyAfterParent, type CommentLike } from '$lib/utils/comment-insert.js';
    import type { ReactionItem } from '$lib/types/reaction.js';
    import { generateParentId, generateDocumentTargetId } from '$lib/types/reaction.js';
    import { onMount, untrack } from 'svelte';
    import { doAction } from '$lib/hooks/registry';
    import { page } from '$app/stores';
    import { getAvatarUrl } from '$lib/utils/member-icon.js';
    import { isEmbeddable } from '$lib/plugins/auto-embed';
    import { embedAsTiptapYoutube } from '$lib/utils/link1-embed';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import AdsenseMultiplex from '$lib/components/ui/adsense-multiplex/adsense-multiplex.svelte';
    import PluginSlot from '$lib/components/plugin/plugin-slot.svelte';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
    import { pluginStore } from '$lib/stores/plugin.svelte';
    import { loadPluginLib } from '$lib/utils/plugin-optional-loader';
    import {
        SeoHead,
        createArticleJsonLd,
        createBreadcrumbJsonLd,
        createDiscussionForumPostingJsonLd,
        createVideoObjectJsonLd,
        extractVideosFromContent,
        getSiteUrl,
        truncateText
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
        propsMapper: (pageData: {
            post: FreePost;
            memberActivity?: { recentPosts: unknown[]; recentComments: unknown[] } | null;
        }) => ({
            post: pageData.post,
            initialActivity: pageData.memberActivity ?? null
        })
    });

    import { loadPluginComponent } from '$lib/utils/plugin-optional-loader';
    import { checkPermission, getPermissionMessage } from '$lib/utils/board-permissions.js';
    import { readPostsStore } from '$lib/stores/read-posts.svelte.js';
    import { postLikeStore } from '$lib/stores/post-like-store.svelte.js';
    import { createScrollDepthObserver, trackEvent, trackPostView } from '$lib/services/ga4.js';
    import { uiSettingsStore } from '$lib/stores/ui-settings.svelte.js';
    import { commentTracker } from '$lib/stores/comment-tracker.svelte.js';
    import { disciplineRevealStore } from '$lib/stores/discipline-reveal.svelte.js';
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

    import TagNav from '$lib/components/ui/tag-nav/tag-nav.svelte';

    // 동적 import: member-memo 플러그인 컴포넌트
    import type { Component } from 'svelte';
    let MemoBadge = $state<Component | null>(null);
    let MemoInlineEditor = $state<Component | null>(null);
    let loadMemosForAuthors = $state<((memberIds: string[]) => Promise<void>) | null>(null);
    // W4-X3: backend inline author_memo cache 채우기 → memo-badge mount 시 fetch 0
    let preloadMemos = $state<
        ((items: Array<{ author_id?: string; author_memo?: unknown }>) => void) | null
    >(null);

    $effect(() => {
        if (memoPluginActive) {
            loadPluginComponent('member-memo', 'memo-badge').then((c) => (MemoBadge = c));
            loadPluginComponent('member-memo', 'memo-inline-editor').then(
                (c) => (MemoInlineEditor = c)
            );
            loadPluginLib<{
                loadMemosForAuthors: (ids: string[]) => Promise<void>;
                preloadMemos?: (
                    items: Array<{ author_id?: string; author_memo?: unknown }>
                ) => void;
            }>('member-memo', 'memo-store').then((module) => {
                loadMemosForAuthors = module?.loadMemosForAuthors ?? null;
                preloadMemos = module?.preloadMemos ?? null;
            });
        } else {
            loadMemosForAuthors = null;
            preloadMemos = null;
        }
    });

    // 글 상세 post의 author_memo로 cache 채우기 (backend PR #438 inline embed 활용)
    $effect(() => {
        if (preloadMemos && data.post) {
            preloadMemos([data.post]);
        }
    });

    // 제휴 변환된 link1/link2 필드 (auxiliaryDataPromise 에서 스트리밍으로 도착)
    let linkAffiliate = $state<{
        link1?: string;
        link2?: string;
        link1_display?: string;
        link2_display?: string;
        link1_affiliate?: boolean;
        link2_affiliate?: boolean;
    }>({});

    // 제휴 변환 결과를 data.post 위에 덮은 derived — streamed linkAffiliate 가 도착하면 반영.
    // ViewComponent 와 link1Original 모두 이 값을 사용해 제휴 변환 후 링크 버튼 href 가 올바르게 갱신됨.
    const displayPost = $derived({ ...data.post, ...linkAffiliate });

    // link1이 동영상 URL이면 본문 앞에 삽입 (그누보드 wr_link1 호환)
    // link1_display: 제휴 변환 전 원본 URL (변환된 경우), 없으면 link1 자체가 원본
    const link1Original = $derived(displayPost.link1_display || displayPost.link1);
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
              ? // YouTube 는 TipTap 형식으로 통일해 에디터 직접 삽입과 레이아웃 일치 (#12111).
                // 그 외 플랫폼 (vimeo 등) 은 기존 auto-embed 경로 (plain URL → embed-container) 유지.
                `${embedAsTiptapYoutube(link1Original) ?? link1Original}\n${renderedPostContent}`
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

    // #12920: 이용제한 근거 콘텐츠 공개 워터마크용 열람자 정보를 스토어에 동기화.
    // 스토어가 모듈 싱글톤이라 teardown 에서 반드시 정리해 페이지 이탈 후 잔존을 방지.
    $effect(() => {
        disciplineRevealStore.setViewer(data.disciplineViewer ?? null);
        return () => {
            disciplineRevealStore.clearViewer();
        };
    });

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
    // total 은 SSR 가 권위값(post.comments_count)을 보존하므로 그대로 신뢰. 구버전/누락 방어로 post.comments_count 폴백.
    let commentsTotal = $state<number>(
        data.commentsData?.comments.total ?? data.post.comments_count ?? comments.length
    );
    // SSR 댓글 로드 상태: complete(전량/정상 0개) | partial(일부) | failed(SSR fetch 실패).
    // backfill 게이트가 total<=loaded 산술(0/0 함정) 대신 이 신호에 기반 (#12663·#12668).
    let commentsLoadState = $state<'complete' | 'partial' | 'failed'>(
        data.commentsData?.comments.loadState ??
            (commentsTotal > comments.length ? 'partial' : 'complete')
    );
    // 댓글 수정 정책 — backend 단일 출처. proxy 응답의 meta.comment_edit_policy 에서 전달.
    let commentEditPolicy = $state<{ cost: number; grace_seconds: number } | undefined>(
        data.commentsData?.comments.edit_policy
    );
    let truthroomCommentMap = $state<Record<number, number>>({});
    let promotionPosts = $state<PromotionPost[]>([]);
    // 작성자 최근 활동 (auxiliaryData 스트리밍으로 SSR 직접 로딩 — 작성자활동 패널에 주입)
    let memberActivity = $state<{ recentPosts: unknown[]; recentComments: unknown[] } | null>(null);
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
        commentsTotal = result?.comments.total ?? data.post.comments_count ?? comments.length;
        commentsLoadState =
            result?.comments.loadState ??
            (commentsTotal > comments.length ? 'partial' : 'complete');
        initialLikedCommentIds = [];
        initialDislikedCommentIds = [];
        truthroomCommentMap = {};
        commentsLoaded = true;
        commentsError = false;
        commentsRecoveryVisible = false;
        commentsAutoRecoveryTriggered = false;
        commentsDirectFetchAttempted = false;
        commentsDirectFetchInFlight = false;
        // #12937: 이전 글의 backfill 진행 가드가 남아 있으면 새 글의 backfill 이
        // 조용히 스킵되어 "댓글을 불러오는 중" 에 고착된다 — 글 전환 시 반드시 해제.
        backfillInProgress = false;
    });

    $effect(() => {
        const promise = data.streamed?.auxiliaryData;
        // SPA 네비게이션 시 비동기 result 가 새 글에 잘못 적용되지 않도록 effect 시작 시점의 postId 캡처
        const effectPostId = data.post.id;

        // 글 변경 시 이전 스트리밍 데이터 즉시 리셋 + 본문 stale 차단 (#12484)
        // renderedPostContent 가 이전 정상 글의 transformed content 를 그대로 유지하면
        // 새 글(특히 삭제글) 진입 시 메타/일부 컴포넌트에 stale 본문이 노출될 수 있음.
        renderedPostContent = data.post.content;
        renderedPostContentPostId = data.post.id;
        postReactions = undefined;
        reactionsMap = undefined;
        lastFetchedReactionsKey = '';
        linkAffiliate = {};

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
        memberActivity = null;
        auxiliaryLoaded = false;

        promise
            .then((result) => {
                // SPA 네비게이션으로 다른 글로 이동했다면 적용하지 않음 (#12484 race condition)
                if (data.post.id !== effectPostId) return;
                if (cancelled) return;
                promotionPosts = Array.isArray(result.promotionPosts)
                    ? (result.promotionPosts as PromotionPost[])
                    : [];

                memberActivity =
                    (result.memberActivity as {
                        recentPosts: unknown[];
                        recentComments: unknown[];
                    }) ?? null;

                if (result.reactions && Object.keys(result.reactions).length > 0) {
                    reactionsMap = result.reactions as Record<string, ReactionItem[]>;
                    const docTargetId = generateDocumentTargetId(boardId, data.post.id);
                    postReactions =
                        (result.reactions as Record<string, ReactionItem[]>)[docTargetId] || [];
                }

                if (result.transformedPostContent) {
                    renderedPostContent = result.transformedPostContent;
                }

                if (result.linkAffiliate && typeof result.linkAffiliate === 'object') {
                    linkAffiliate = result.linkAffiliate as typeof linkAffiliate;
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

                // 낙관적 오버레이: 이 세션에서 직접 누른 공감/비공감이 있으면
                // (SPA 재진입 시) 아직 반영 안 된 SSR 값보다 우선.
                const myLike = postLikeStore.get(boardId, data.post.id);
                if (myLike) {
                    isLiked = myLike.liked;
                    isDisliked = myLike.disliked;
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
        // SPA 내비게이션 레이스 가드: 상세→목록 전환 중 이 effect 가 재실행되면
        // data.post 가 일시적으로 undefined 라 data.post.id 접근 시 throw → unhandledrejection
        // (/free·/ 위치로 보고되던 "Cannot read properties of undefined (reading 'id')")
        if (!data.post?.id) return;
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

    // 읽음 표시 + GA4 이벤트 — SPA 네비게이션(하단 리스트 클릭)에서도 반응.
    // markAsRead 는 내부에서 read-store 의 posts 를 읽고(스프레드) 다시 쓴다. 그 읽기가
    // 이 $effect 의 반응 의존성으로 잡히면 자기참조가 되어(쓰기→재실행) Svelte 가 effect 를
    // 반복 실행하다 effect_update_depth_exceeded 로 상태를 롤백 → 방금 읽은 글이 유실된다.
    // 부수효과(읽음 저장/GA4)는 반응 의존성을 만들 필요가 없으므로 untrack 으로 격리한다.
    // effect 는 boardId/postId(untrack 밖)에만 의존해 네비게이션마다 1회만 실행된다.
    $effect(() => {
        const postViewKey = `${boardId}:${data.post.id}`;
        if (trackedPostViewKey === postViewKey) return;
        trackedPostViewKey = postViewKey;
        untrack(() => {
            readPostsStore.markAsRead(boardId, data.post.id);
            trackPostView(boardId, data.post.id);
        });
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

                    // 낙관적 오버레이 (fallback 경로에서도 내 방금 액션 우선)
                    const myLike = postLikeStore.get(boardId, data.post.id);
                    if (myLike) {
                        isLiked = myLike.liked;
                        isDisliked = myLike.disliked;
                    }
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

        // 공감자 아바타 eager 미리보기 로드.
        // 댓글은 getCommentLikersBatch로 초기 로드 시 아바타가 뜨지만, 게시글은 기존에
        // loadLikerAvatars가 공감 토글에서만 호출돼 "공감/공감자 목록 보기"를 누르기 전엔
        // 아바타가 안 떴음. 좋아요가 있는 글에서만 1회 요청(상위 5명).
        // 비로그인은 loadLikerAvatars 내부에서 early-return하므로 요청 발생 안 함.
        if (data.post.likes > 0) {
            loadLikerAvatars();
        }
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

        // 댓글이 비동기로 로드/렌더되므로(특히 모바일·긴 스레드, 초기 limit 초과 댓글은
        // backfill 후 렌더) 짧은 재시도(20프레임 ≈0.3s)로는 대상 댓글이 아직 DOM 에 없어
        // 글 상단에만 머무는 사례(#12688: '내 댓글 클릭 시 글로만 이동')가 있었다.
        // 대상이 나타날 때까지 최대 ~5초간 rAF 재시도(발견 즉시 중단, 비용 저렴).
        const deadline = Date.now() + 5000;
        const tryScroll = () => {
            const el = document.getElementById(targetId);
            if (el) {
                scrollToAndHighlight(el);
            } else if (Date.now() < deadline) {
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

    // afterNavigate는 컴포넌트 초기화 시점에 등록해야 destroy 시 자동 정리됨.
    // onMount 안에서 등록하면 재마운트마다 콜백이 누적돼 추가 history 조작(replaceState)을
    // 유발할 수 있음 (issue #989).
    afterNavigate(() => {
        scheduleAnchorScroll();
    });

    onMount(() => {
        const onHashChange = () => {
            if (commentsLoaded) {
                scheduleAnchorScroll();
            }
        };

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
    // #12420: 신고 누적으로 잠긴 글은 작성자 수정 차단. admin 만 운영 도구로 수정 가능.
    const isAdmin = $derived((authStore.user?.mb_level ?? 0) >= 10);
    const isLockedPost = $derived(data.post.extra_7 === 'lock' || postReportCount === 'lock');
    const canModify = $derived((isAuthor && !isLockedPost) || isAdmin);

    // 직접홍보 게시판 만료 여부
    const promotionExpired = $derived(data.promotionExpired === true && !isAuthor);

    // 비밀글 접근 권한 (작성자 또는 관리자 열람 가능, 홍보 만료 글도 차단)
    // 백엔드 비밀글 strip 은 작성자+관리자에게 내용을 내려주는데 프론트 판정에
    // isAdmin 이 빠져 관리자가 "비밀글입니다"만 보던 불일치 수정.
    const canViewSecret = $derived(
        (!data.post.is_secret || isAuthor || isAdmin) && !promotionExpired
    );

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
            // #12098: 백엔드의 구체 사유(예: '질문게시판은 답변이 있으면 삭제가 불가능합니다',
            // '소명글은 삭제할 수 없습니다' 등) 가 사용자에게 안내되도록 err.message 우선 노출.
            // err.message 가 비어있을 때만 generic fallback.
            const msg =
                err instanceof Error && err.message ? err.message : '게시글 삭제에 실패했습니다.';
            alert(msg);
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
            postLikeStore.set(boardId, data.post.id, { liked: isLiked, disliked: isDisliked });

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
            console.error('Failed to like post:', err);
            if (err instanceof Error && err.message.includes('실명인증')) {
                // 실명인증 미완 → 원래대로 롤백 후 인증 페이지로 이동
                isLiked = prevLiked;
                isDisliked = prevDisliked;
                likeCount = prevLikeCount;
                dislikeCount = prevDislikeCount;
                goToCertification();
                return;
            }
            // #12004: 모바일 네트워크 등에서 서버는 처리됐으나 응답 수신이 실패한 경우
            // 서버 실제 상태를 재조회해서 사용자 의도와 일치하면 silent success 로 처리.
            // 그렇지 않은 경우에만 롤백 + 알림.
            try {
                const status = await apiClient.getPostLikeStatus(boardId, String(data.post.id));
                const intendedLiked = !prevLiked;
                if (status.user_liked === intendedLiked) {
                    isLiked = status.user_liked;
                    isDisliked = status.user_disliked ?? false;
                    likeCount = status.likes;
                    dislikeCount = status.dislikes ?? 0;
                    postLikeStore.set(boardId, data.post.id, {
                        liked: isLiked,
                        disliked: isDisliked
                    });
                    if (!prevLiked && isLiked) {
                        trackEvent('like', { board_id: boardId, post_id: data.post.id });
                    }
                    loadLikerAvatars();
                    return;
                }
            } catch {
                // 재조회도 실패 → 기본 실패 경로로 폴백
            }
            isLiked = prevLiked;
            isDisliked = prevDisliked;
            likeCount = prevLikeCount;
            dislikeCount = prevDislikeCount;
            const msg = err instanceof Error && err.message ? err.message : '공감에 실패했습니다.';
            alert(msg);
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

        const prevDislikedForReconcile = isDisliked;
        isDisliking = true;
        try {
            const response = await apiClient.dislikePost(boardId, String(data.post.id));
            isLiked = response.user_liked;
            isDisliked = response.user_disliked ?? false;
            likeCount = response.likes;
            dislikeCount = response.dislikes ?? 0;
            postLikeStore.set(boardId, data.post.id, { liked: isLiked, disliked: isDisliked });

            trackEvent('dislike', { board_id: boardId, post_id: data.post.id });

            // 아바타 스택 갱신
            loadLikerAvatars();
        } catch (err) {
            console.error('Failed to dislike post:', err);
            if (err instanceof Error && err.message.includes('실명인증')) {
                goToCertification();
                return;
            }
            // #12004: 서버는 처리됐으나 응답 수신이 실패한 경우 상태 재조회로 확인
            try {
                const status = await apiClient.getPostLikeStatus(boardId, String(data.post.id));
                const intendedDisliked = !prevDislikedForReconcile;
                if ((status.user_disliked ?? false) === intendedDisliked) {
                    isLiked = status.user_liked;
                    isDisliked = status.user_disliked ?? false;
                    likeCount = status.likes;
                    dislikeCount = status.dislikes ?? 0;
                    postLikeStore.set(boardId, data.post.id, {
                        liked: isLiked,
                        disliked: isDisliked
                    });
                    return;
                }
            } catch {
                // 재조회도 실패 → fallback
            }
            const msg =
                err instanceof Error && err.message ? err.message : '비공감에 실패했습니다.';
            alert(msg);
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
        // 댓글 작성 / 수정 / 삭제 직후 호출되는 경로라 항상 fresh 응답이 필요.
        // 브라우저 HTTP 캐시 / SvelteKit data 캐시가 옛 응답을 반환하면 optimistic
        // update 로 추가된 새 댓글이 덮어써져 "댓글이 바로 안 보인다" (#12294) 가
        // 재현되므로 no-store 로 캐시를 우회한다.
        //
        // 추가 보강 (#12548): 카카오톡 등 모바일 in-app webview 는 cache 헤더를
        // 무시하는 사례가 있어 URL cache buster (`_t=${Date.now()}`) 로 강제 우회.
        // SW (service worker) 가 가로채는 케이스도 동일하게 URL 변화로 회피.
        const cacheBuster = Date.now();
        // #12937: SPA 로 다른 글로 이동한 뒤 뒤늦게 도착한 응답이 현재 글의 목록을
        // 덮어쓰지 않도록, 요청 시점의 글 ID 를 고정해 적용 직전에 대조한다.
        const targetPostId = data.post.id;
        // #12735: 댓글 API 는 페이지당 최대 200개라, 댓글이 200개를 넘는 글은
        // page=1 한 번만 받으면 나머지가 누락된다("대댓글 많은데 안 보임").
        // total_pages 만큼 순차로 모두 받아 합친다. (안전 상한 MAX_PAGES)
        const PAGE_SIZE = 200;
        const MAX_PAGES = 15;
        const fetchCommentPage = (p: number) =>
            fetch(
                `/api/boards/${boardId}/posts/${targetPostId}/comments?page=${p}&limit=${PAGE_SIZE}&_t=${cacheBuster}`,
                {
                    cache: 'no-store',
                    // #12937: 모바일 webview 에서 fetch 가 응답 없이 매달리면
                    // backfill 가드가 영구 고착된다 — 타임아웃으로 반드시 종결.
                    signal: AbortSignal.timeout(8000),
                    headers: {
                        'Cache-Control': 'no-cache, no-store, must-revalidate',
                        Pragma: 'no-cache'
                    }
                }
            ).then((r) => r.json());

        const json = await fetchCommentPage(1);
        if (json.success) {
            let all = json.data.comments ?? [];
            const total = json.data.total || all.length;
            const reportedPages = json.data.total_pages ?? 1;
            const pagesToLoad = Math.min(reportedPages, MAX_PAGES);
            // 나머지 페이지(2..N)를 병렬 로드 — 순차 await 제거로 긴 스레드/신고댓글 도달 지연 완화.
            // Promise.all 은 입력 순서를 보존하므로 page 순서대로 concat 된다.
            if (pagesToLoad > 1) {
                const rest = await Promise.all(
                    Array.from({ length: pagesToLoad - 1 }, (_, i) => fetchCommentPage(i + 2))
                );
                for (const next of rest) {
                    if (next.success && next.data.comments?.length) {
                        all = all.concat(next.data.comments);
                    }
                }
            }
            if (reportedPages > MAX_PAGES) {
                console.warn(
                    `[comments] total_pages ${reportedPages} exceeds cap ${MAX_PAGES} — 일부 댓글 미로드`
                );
            }
            // #12937: 응답 대기 중 다른 글로 이동했다면 폐기 — 이전 글 댓글로 덮어쓰기 방지.
            if (data.post.id !== targetPostId) return;
            comments = all;
            commentsTotal = total || all.length;
            // 클라가 전량 로드 완료 — backfill 게이트가 재발화하지 않도록 complete 로 확정.
            commentsLoadState = 'complete';
            commentsError = false;
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

    // 댓글 수>0 인데 목록이 0개일 때, 단발 fetch 가 전송 실패(네트워크 순단/모바일 webview)하면
    // 재시도가 없어 "불러오는 중"에 고착되는 사례(#12668: 간헐 발생, 새로고침하면 보임)가 있어
    // 짧은 백오프로 몇 번 재시도한다. 실제 0개이거나 채워지면 종료.
    let backfillInProgress = false;
    async function backfillWithRetry(): Promise<void> {
        if (backfillInProgress) return;
        backfillInProgress = true;
        try {
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    await refetchComments();
                } catch {
                    // 전송 실패 — 재시도
                }
                if (comments.length > 0 || commentsTotal === 0) return;
                await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
            }
            // 3회 모두 실패 + 여전히 빈 목록 → 에러/복구 UI 노출(무한 "불러오는 중" 고착 방지).
            if (comments.length === 0 && commentsTotal > 0) {
                commentsError = true;
            }
        } finally {
            backfillInProgress = false;
        }
    }

    // 댓글 backfill: SSR에서 일부만 로드된 경우 전체 댓글 가져오기
    // onMount 대신 $effect로 SPA 네비게이션에서도 동작하도록
    $effect(() => {
        if (!browser || !canViewSecret) return;
        // loadState 신호 기반(총<=로드 산술의 0/0 함정 제거, #12663·#12668):
        // - complete: SSR 전량 로드(정상 0개 포함) → backfill 불필요.
        // - failed 또는 목록 0개: 즉시 재시도(backfillWithRetry, 백오프 3회).
        // - partial: 1500ms 후 나머지 페이지 채움(refetchComments 다중페이지).
        if (commentsLoadState === 'complete') return;
        const loaded = comments.length;

        if (commentsLoadState === 'failed' || loaded === 0) {
            void backfillWithRetry();
            return;
        }

        // 앵커(#c_<댓글ID>)로 진입했는데 대상 댓글이 아직 로드 전이면(신고/딥링크) 1500ms 디바운스를
        // 건너뛰고 즉시 나머지 댓글을 불러온다 — 모더레이터가 신고댓글을 한참 기다리던 문제 완화.
        const hash = window.location.hash;
        if (hash.startsWith('#c_')) {
            const anchorId = hash.slice(3);
            if (anchorId && !comments.some((c) => String(c.id) === anchorId)) {
                void refetchComments();
                return;
            }
        }

        // #12939: 입력 중 backfill 이 comments 를 재대입하면 keyed each 가 댓글 노드를
        // 이동시켜, 포커스된 답글 에디터가 DOM 재배치되며 삼성 인터넷에서 소프트
        // 키보드가 내려간다 — 댓글 입력 중에는 backfill 을 입력 종료 후로 미룬다.
        let timer: number;
        const scheduleBackfill = (delay: number) => {
            timer = window.setTimeout(() => {
                const active = document.activeElement as HTMLElement | null;
                if (active?.closest('.ProseMirror, [contenteditable="true"], textarea')) {
                    scheduleBackfill(3000);
                    return;
                }
                void refetchComments();
            }, delay);
        };
        scheduleBackfill(1500);

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

            // Optimistic update: 서버 응답 즉시 목록에 추가 (#11946)
            let optimisticComment: FreeComment | null = null;
            if (newComment && newComment.id) {
                optimisticComment = {
                    ...newComment,
                    author_id: authStore.user.mb_id || '',
                    author_image_url: authStore.user.mb_image || '',
                    author_level: authStore.user.mb_level ?? 0
                } as unknown as FreeComment;
                if (!comments.some((c) => c.id === optimisticComment!.id)) {
                    comments = [...comments, optimisticComment];
                    commentsTotal = commentsTotal + 1;
                }
            }

            // 서버에서 정렬된 댓글 목록 다시 가져오기 (중복 제거 포함)
            await refetchComments();

            // #12548: 쓰기 직후 refetch 가 백엔드 쓰기→읽기 가시성 지연으로 새 댓글을 아직
            // 돌려주지 않으면, refetchComments 의 `comments = all` 이 위 optimistic 댓글을
            // 덮어써 "댓글 작성 후 새로고침해야 보임" 이 재현된다. refetch 후에도 새 댓글이
            // 목록에 없으면 다시 끼워넣어 항상 즉시 보이게 한다(다음 자연스러운 refetch 가 정렬·정정).
            if (optimisticComment && !comments.some((c) => c.id === optimisticComment!.id)) {
                comments = [...comments, optimisticComment];
                commentsTotal = commentsTotal + 1;
            }

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

            // Optimistic update: 대댓글도 즉시 목록에 추가 (#11946, #12228)
            // 백엔드 v1 createComment 응답에 parent_id / wr_comment_reply 가 없어
            // 단순 push 시 commentTree 의 hasApiDepth 분기에서 부모 다음이 아닌
            // 배열 맨 끝에 렌더되어 회귀로 안 보이는 것처럼 인지됨.
            // → 프론트에서 parent_id, depth 를 명시적으로 채우고
            //   부모 댓글의 마지막 자식 다음 위치에 삽입한다.
            if (replyComment && replyComment.id) {
                const parentComment = comments.find((c) => String(c.id) === String(parentId));
                const parentDepth = parentComment?.depth ?? 0;
                const optimistic = {
                    ...replyComment,
                    parent_id: (replyComment as Partial<FreeComment>).parent_id ?? parentId,
                    depth:
                        typeof (replyComment as Partial<FreeComment>).depth === 'number'
                            ? (replyComment as Partial<FreeComment>).depth
                            : parentDepth + 1,
                    author_id: authStore.user.mb_id || '',
                    author_image_url: authStore.user.mb_image || '',
                    author_level: authStore.user.mb_level ?? 0
                } as unknown as FreeComment;

                const before = comments as unknown as CommentLike[];
                const next = insertReplyAfterParent(
                    before,
                    parentId,
                    optimistic as unknown as CommentLike
                );
                if (next !== before) {
                    comments = next as unknown as FreeComment[];
                    commentsTotal = commentsTotal + 1;
                }
            }

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
    // truncateText: .slice() 는 이모지(서로게이트 쌍)를 반쪽 내 GSC "잘린 유니코드"(파싱 불가) 오류가 됨
    const postDescription = $derived(
        data.post.deleted_at ? '' : truncateText(renderedPostContent.replace(/<[^>]+>/g, ''), 160)
    );

    const seoConfig: SeoConfig = $derived.by(() => {
        const siteUrl = getSiteUrl();
        const postUrl = `${siteUrl}/${boardId}/${data.post.id}`;
        const authorUrl = data.post.author_id
            ? `${siteUrl}/member/${data.post.author_id}`
            : undefined;
        // OG 이미지: 캐시버스팅으로 소셜 미디어 stale preview 방지
        // 본문에 이미지가 없으면 PUBLIC_OG_FALLBACK_IMAGE (운영에서 사이트 로고 URL 설정) 로
        // 대체. fallback 미설정 시 og:image 가 누락되어 크롤러가 페이지 안의 임의 이미지
        // (작성자 프로필, 댓글자 아바타 등) 를 썸네일로 잡아가는 문제 (#12417) 발생.
        const rawOgImage = data.post.thumbnail || data.post.images?.[0];
        const fallbackOgImage = publicEnv.PUBLIC_OG_FALLBACK_IMAGE || undefined;
        // GSC "image URL 잘못됨" 방지: 상대경로는 siteUrl 기준 절대화, http(s) 외 스킴은 fallback 으로
        let safeOgImage: string | undefined;
        if (rawOgImage) {
            try {
                const parsed = new URL(rawOgImage, siteUrl);
                if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                    safeOgImage = parsed.href;
                }
            } catch {
                safeOgImage = undefined;
            }
        }
        const ogImageUrl = safeOgImage
            ? `${safeOgImage}${safeOgImage.includes('?') ? '&' : '?'}v=${new Date(data.post.updated_at || data.post.created_at).getTime()}`
            : fallbackOgImage;

        // VideoObject — GSC "제공된 썸네일 URL 없음"(동영상 색인 제외) 해소.
        // 유튜브 임베드는 i.ytimg.com 썸네일이 항상 존재. 업로드 mp4 는 자체 포스터가
        // 없으므로 글 대표이미지가 있을 때만 출력 (thumbnailUrl 없는 VideoObject 는
        // 그 자체가 오류라 생략이 정답 — 헬퍼가 null 반환, buildJsonLd 가 필터)
        const videoJsonLds =
            data.post.is_secret || data.post.deleted_at
                ? []
                : [
                      ...extractVideosFromContent(renderedPostContent),
                      ...(data.post.videos ?? []).map((v) => ({
                          type: 'file' as const,
                          url: v.url,
                          poster: undefined as string | undefined
                      }))
                  ]
                      .slice(0, 3)
                      .map((v) => {
                          const name = data.post.title?.trim() || boardTitle;
                          if (v.type === 'youtube') {
                              return createVideoObjectJsonLd({
                                  name,
                                  description: postDescription || undefined,
                                  thumbnailUrl: `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
                                  uploadDate: data.post.created_at,
                                  embedUrl: `https://www.youtube.com/embed/${v.id}`
                              });
                          }
                          const toHttpUrl = (raw?: string): string | undefined => {
                              if (!raw) return undefined;
                              try {
                                  const parsed = new URL(raw, siteUrl);
                                  return parsed.protocol === 'http:' || parsed.protocol === 'https:'
                                      ? parsed.href
                                      : undefined;
                              } catch {
                                  return undefined;
                              }
                          };
                          return createVideoObjectJsonLd({
                              name,
                              description: postDescription || undefined,
                              // 업로드 시 캡처된 포스터(본문 poster 속성) 우선, 없으면 글 대표이미지
                              thumbnailUrl: toHttpUrl(v.poster) ?? safeOgImage,
                              uploadDate: data.post.created_at,
                              contentUrl: toHttpUrl(v.url)
                          });
                      });

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
                image: ogImageUrl
            },
            twitter: {
                card: safeOgImage ? 'summary_large_image' : 'summary',
                title: data.post.title,
                description: postDescription,
                image: ogImageUrl
            },
            jsonLd: [
                // DiscussionForumPosting - 커뮤니티 게시글에 최적화된 구조화 데이터
                createDiscussionForumPostingJsonLd({
                    // 빈 제목 글에서 headline 누락(GSC) 방지 — 게시판명 폴백
                    headline: data.post.title?.trim() || boardTitle,
                    text: postDescription,
                    author: data.post.deleted_at ? '' : data.post.author,
                    authorUrl: data.post.deleted_at ? undefined : authorUrl,
                    datePublished: data.post.created_at,
                    dateModified: data.post.updated_at || undefined,
                    url: postUrl,
                    commentCount: comments.length,
                    upvoteCount: data.post.likes || 0,
                    image: ogImageUrl,
                    // 상위 원댓글 3개 (비밀·삭제·잠금·제재·차단 댓글 제외 — 마스킹 정책 준수)
                    comments: comments
                        .filter(
                            (c) =>
                                (c.depth ?? 0) === 0 &&
                                !c.is_secret &&
                                !c.deleted_at &&
                                !c.is_restricted &&
                                !c.is_discipline_related &&
                                !c.is_blocked
                        )
                        .slice(0, 3)
                        .map((c) => ({
                            text: truncateText(c.content.replace(/<[^>]+>/g, '').trim(), 200),
                            author: c.author,
                            datePublished: c.created_at
                        }))
                }),
                // Article - 일반 검색 결과용 (폴백)
                createArticleJsonLd({
                    headline: data.post.title?.trim() || boardTitle,
                    author: data.post.deleted_at ? '' : data.post.author,
                    datePublished: data.post.created_at,
                    dateModified: data.post.updated_at || data.post.created_at,
                    image: ogImageUrl,
                    description: postDescription
                }),
                // Breadcrumb
                createBreadcrumbJsonLd([
                    { name: '홈', url: siteUrl },
                    { name: boardTitle, url: `${siteUrl}/${boardId}` },
                    { name: data.post.title }
                ]),
                // VideoObject — 본문 유튜브 임베드·업로드 동영상 (최대 3개, null 은 필터됨)
                ...videoJsonLds
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

<!-- #12920: 이용제한 근거 글·댓글 [보기] 공개 시 전체화면 워터마크.
     truthroom 워터마크와의 이중 렌더 방지를 위해 !data.watermark 가드. -->
{#if !data.watermark && disciplineRevealStore.revealCount > 0 && data.disciplineViewer}
    <Watermark
        nickname={data.disciplineViewer.nickname}
        userId={data.disciplineViewer.userId}
        clientIp={data.disciplineViewer.clientIp}
        pageTitle={boardTitle}
        redirectUrl={`/${boardId}`}
    />
{/if}

<!-- overflow-x: clip — 모바일 Safari/Firefox 에서 일부 비-/free 경로에 미세한 좌우 스크롤이
     발생하던 문제 방어 (#11970). clip 은 scroll container 를 만들지 않아 position:sticky 가
     깨지지 않고, overflow: hidden 과 달리 자식의 transform 등 영향도 최소.
     #12096: Samsung Internet / 다뷰 등 일부 모바일 환경에서 overflow-x: clip 만으로
     클리핑이 안 되어 -mx-2 액션바 등이 viewport 를 넘어 가로 스크롤이 그대로 발생.
     동일 선언에 hidden 폴백을 먼저 두고 clip 으로 덮는 방식으로 cascade 처리:
     - clip 미지원 브라우저: hidden 적용 (이 wrapper 내부에는 position:sticky 가 없어 안전)
     - clip 지원 브라우저: clip 이 hidden 을 덮어 기존 동작 유지 -->
<div class="mx-auto pt-2" style="overflow-x: hidden; overflow-x: clip;">
    <!-- 플러그인 슬롯: 글 상세 페이지 시작 — Slot Catalog Sprint 2c -->
    <PluginSlot name="post-detail-before" {boardId} postId={data.post.id} />

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
        <span class="text-foreground min-w-0 break-words" title={data.post.title}
            >{data.post.title}</span
        >
    </nav>

    <!-- 빠른 이동(tag-nav) — 목록 페이지와 동일. 메뉴는 admin 설정/DEFAULT_MENUS 공유 -->
    <div class="mb-3">
        <TagNav />
    </div>

    <!-- 상단 네비게이션 — 모바일 터치 타겟 44px(#12016) -->
    <div
        class="-mx-2 mb-2 flex flex-wrap items-center gap-2 px-2 py-2 md:mx-0 md:flex-nowrap md:gap-3 md:px-0 [&_a]:min-h-11 md:[&_a]:min-h-0 [&_button]:min-h-11 md:[&_button]:min-h-0"
    >
        <Button variant="ghost" size="sm" onclick={() => history.back()} class="shrink-0">←</Button>
        <Button variant="outline" size="sm" onclick={goBack} class="shrink-0">목록으로</Button>

        <!-- 상단에도 글쓰기 버튼 (하단 네비와 동일 권한/실명인증 로직) -->
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

        <!-- 데스크톱: 우측 그룹을 오른쪽으로 미는 스페이서. 모바일은 줄바꿈되므로 숨김(좌측 정렬) -->
        <div class="hidden flex-1 md:block"></div>

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

    <!-- 마음메시지 아래 구글 광고 -->
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
                post={displayPost}
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
                {...slot.propsMapper
                    ? slot.propsMapper({ post: data.post, boardId, memberActivity })
                    : {}}
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
                    <!-- 플러그인 슬롯: 댓글 영역 직전 — Slot Catalog Sprint 2c -->
                    <PluginSlot
                        name="post-detail-comments-before"
                        {boardId}
                        postId={data.post.id}
                    />
                    {#if !data.post.is_comments_disabled}
                        <CommentList
                            {comments}
                            onUpdate={handleUpdateComment}
                            onDelete={handleDeleteComment}
                            onRestore={handleRestoreComment}
                            onReply={handleReplyComment}
                            onLike={handleLikeComment}
                            onDislike={handleDislikeComment}
                            postAuthorId={data.post.author_id}
                            postDeleted={!!data.post.deleted_at}
                            {boardId}
                            postId={data.post.id}
                            useNogood={!!data.board?.use_nogood}
                            {commentLayout}
                            {reactionsMap}
                            {initialLikedCommentIds}
                            {initialDislikedCommentIds}
                            {truthroomCommentMap}
                            isRestricted={data.isRestricted}
                            expectedTotal={commentsTotal}
                            editPolicy={commentEditPolicy}
                        />
                    {/if}
                    <!-- 플러그인 슬롯: 댓글 영역 직후 — Slot Catalog Sprint 2c -->
                    <PluginSlot name="post-detail-comments-after" {boardId} postId={data.post.id} />

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
        {/if}

        <!-- 댓글 아래 네비게이션 — 모바일 터치 타겟 44px(#12016) -->
        <div
            class="-mx-2 mt-4 flex flex-wrap items-center gap-2 px-2 py-2 md:mx-0 md:flex-nowrap md:gap-3 md:px-0 [&_a]:min-h-11 md:[&_a]:min-h-0 [&_button]:min-h-11 md:[&_button]:min-h-0"
        >
            <Button variant="ghost" size="sm" onclick={() => history.back()} class="shrink-0"
                >←</Button
            >
            <Button variant="outline" size="sm" onclick={goBack} class="shrink-0">목록으로</Button>
            <!-- 데스크톱: 우측 그룹을 오른쪽으로 미는 스페이서. 모바일은 줄바꿈되므로 숨김(좌측 정렬) -->
            <div class="hidden flex-1 md:block"></div>
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

        <!-- 플러그인 슬롯: 글 상세 페이지 끝 — Slot Catalog Sprint 2c -->
        <PluginSlot
            name="post-detail-after"
            {boardId}
            postId={data.post.id}
            postAuthorId={data.post.author_id}
        />
    {/if}
    <!-- /canRead -->
</div>

<!-- 게시판 최근글 목록 -->
<!-- #12040: boardId 변경 시 RecentPosts 를 강제 재생성하여 이전 게시판의
     posts state 가 남아있다가 잘못된 URL 로 이동하는 문제 방지 -->
<!-- #12048: 본문 wrapper 외부의 RecentPosts 가 일부 모바일 환경(Samsung Internet/다뷰)
     에서 가로 스크롤 유발. 동일한 overflow-x cascade 폴백 + clip 적용. -->
<!-- #12409 + #12413: 같은 게시판 내 다른 글로 SPA navigation 시 key 가 변하지 않아
     RecentPosts 가 재마운트되지 않고 onMount 가 재실행되지 않음 → 이전 글 진입 시점의
     initialPage(보통 1) 가 stale 상태로 남아 항상 1페이지가 표시되는 회귀.
     post.id 를 key 에 포함시켜 글 이동마다 RecentPosts 를 재마운트, URL ?page=N 반영. -->
{#if canRead}
    <div style="overflow-x: hidden; overflow-x: clip;">
        {#key `${boardId}:${data.post.id}`}
            <RecentPosts
                {boardId}
                {boardTitle}
                currentPostId={data.post.id}
                limit={BOARD_LIST_PAGE_SIZE}
                initialPage={Number($page.url.searchParams.get('page')) ||
                    data.recentPosts?.page ||
                    1}
                {promotionPosts}
                displaySettings={data.board?.display_settings}
            />
        {/key}
    </div>
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
