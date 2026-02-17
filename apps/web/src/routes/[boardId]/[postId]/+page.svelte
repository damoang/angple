<script lang="ts">
    import { goto } from '$app/navigation';
    import {
        Card,
        CardHeader,
        CardContent,
        CardFooter,
        CardTitle
    } from '$lib/components/ui/card/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import type { PageData } from './$types.js';
    import { Markdown } from '$lib/components/ui/markdown/index.js';
    import Heart from '@lucide/svelte/icons/heart';
    import ThumbsDown from '@lucide/svelte/icons/thumbs-down';
    import Users from '@lucide/svelte/icons/users';
    import Pencil from '@lucide/svelte/icons/pencil';
    import Lock from '@lucide/svelte/icons/lock';
    import Flag from '@lucide/svelte/icons/flag';
    import Pin from '@lucide/svelte/icons/pin';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { apiClient } from '$lib/api/index.js';
    import DeleteConfirmDialog from '$lib/components/features/board/delete-confirm-dialog.svelte';
    import CommentForm from '$lib/components/features/board/comment-form.svelte';
    import CommentList from '$lib/components/features/board/comment-list.svelte';
    import RecentPosts from '$lib/components/features/board/recent-posts.svelte';
    import { RecommendedPosts } from '$lib/components/features/recommended/index.js';
    import { ReportDialog } from '$lib/components/features/report/index.js';
    import type { FreeComment, FreePost, LikerInfo } from '$lib/api/types.js';
    import { sendMentionNotifications } from '$lib/utils/mention-notify.js';
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { AdultBlur } from '$lib/components/features/adult/index.js';
    import { getMemberIconUrl } from '$lib/utils/member-icon.js';
    import { isEmbeddable } from '$lib/plugins/auto-embed';
    import AdminPostActions from '$lib/components/features/board/admin-post-actions.svelte';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
    import { pluginStore } from '$lib/stores/plugin.svelte';
    import { SeoHead, createArticleJsonLd, createBreadcrumbJsonLd } from '$lib/seo/index.js';
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

    // Q&A 게시판 슬롯 등록
    postSlotRegistry.register('post.before_content', {
        component: QAAnswerSection,
        condition: (boardType: string) => boardType === 'qa',
        priority: 5,
        propsMapper: (pageData: { post: FreePost; boardId: string }) => ({
            post: pageData.post,
            boardId: pageData.boardId
        })
    });
    import { ReactionBar } from '$lib/components/features/reaction/index.js';
    import { AvatarStack } from '$lib/components/ui/avatar-stack/index.js';
    import { loadPluginComponent } from '$lib/utils/plugin-optional-loader';

    let { data }: { data: PageData } = $props();

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
            loadPluginComponent('member-memo', 'memo-inline-editor').then((c) => (MemoInlineEditor = c));
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
    const boardTitle = $derived(data.board?.subject || boardId);

    // 특수 게시판 타입 감지
    const boardType = $derived(
        data.board?.board_type ||
            (boardId === 'giving'
                ? 'giving'
                : boardId === 'angtt'
                  ? 'angtt'
                  : boardId === 'angmap'
                    ? 'angmap'
                    : 'standard')
    );
    const isUsedMarket = $derived(boardType === 'used-market');

    // 플러그인 슬롯
    const beforeContentSlots = $derived(postSlotRegistry.resolve('post.before_content', boardType));
    const afterContentSlots = $derived(postSlotRegistry.resolve('post.after_content', boardType));

    // 중고게시판 상태 관리
    let marketStatus = $state<MarketStatus>('selling');
    $effect(() => { marketStatus = (data.post.extra_2 as MarketStatus) || 'selling'; });
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

    // 댓글 목록 상태 (반응형으로 관리)
    let comments = $state<FreeComment[]>([]);
    $effect(() => { comments = data.comments.items; });
    let isCreatingComment = $state(false);

    // 추천/비추천 상태
    let likeCount = $state(0);
    $effect(() => { likeCount = data.post.likes; });
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

    // 인라인 메모 편집 대상 (추천인 목록 내)
    let editingMemoFor = $state<string | null>(null);

    // 게시글 삭제 상태
    let isDeleting = $state(false);

    // 신고 다이얼로그 상태
    let showReportDialog = $state(false);

    // 초기 추천 상태 + 레벨 로드
    onMount(async () => {
        // 게시글 작성자 레벨 배치 로드
        if (data.post.author_id) {
            memberLevelStore.fetchLevels([data.post.author_id]);
        }

        if (authStore.isAuthenticated) {
            try {
                const status = await apiClient.getPostLikeStatus(boardId, String(data.post.id));
                isLiked = status.user_liked;
                isDisliked = status.user_disliked ?? false;
                likeCount = status.likes;
                dislikeCount = status.dislikes ?? 0;
            } catch (err) {
                console.error('Failed to load like status:', err);
            }
        }

        // 추천 수 > 0이면 아바타 미리 로드
        if (likeCount > 0) {
            loadLikerAvatars();
        }
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
    $effect(() => { noticeType = data.post.notice_type ?? null; });
    let isTogglingNotice = $state(false);

    async function toggleNotice(type: 'normal' | 'important' | null): Promise<void> {
        isTogglingNotice = true;
        try {
            await apiClient.toggleNotice(boardId, data.post.id, type);
            noticeType = type;
        } catch (err) {
            console.error('Failed to toggle notice:', err);
            alert('공지 설정에 실패했습니다.');
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
        try {
            const response = await apiClient.getPostLikers(boardId, String(data.post.id));
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
        isSecret?: boolean
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
                is_secret: isSecret
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
        isSecret?: boolean
    ): Promise<void> {
        if (!authStore.user) {
            throw new Error('로그인이 필요합니다.');
        }

        const newComment = await apiClient.createComment(boardId, String(data.post.id), {
            content,
            author: authStore.user.mb_name,
            parent_id: parentId,
            is_secret: isSecret
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

    const seoConfig: SeoConfig = $derived({
        meta: {
            title: `${data.post.title} - ${boardTitle}`,
            description: postDescription,
            canonicalUrl: `${$page.url.origin}/${boardId}/${data.post.id}`
        },
        og: {
            title: data.post.title,
            description: postDescription,
            type: 'article',
            url: `${$page.url.origin}/${boardId}/${data.post.id}`,
            image: data.post.thumbnail || data.post.images?.[0]
        },
        twitter: {
            card: data.post.thumbnail || data.post.images?.[0] ? 'summary_large_image' : 'summary',
            title: data.post.title,
            description: postDescription,
            image: data.post.thumbnail || data.post.images?.[0]
        },
        jsonLd: [
            createArticleJsonLd({
                headline: data.post.title,
                author: data.post.author,
                datePublished: data.post.created_at,
                dateModified: data.post.updated_at || data.post.created_at,
                image: data.post.thumbnail || data.post.images?.[0],
                description: postDescription
            }),
            createBreadcrumbJsonLd([
                { name: '홈', url: $page.url.origin },
                { name: boardTitle, url: `${$page.url.origin}/${boardId}` },
                { name: data.post.title }
            ])
        ]
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
            <AdSlot position="board-head" height="90px" />
        </div>
    {/if}

    <!-- 상단 네비게이션 -->
    <div class="mb-6 flex items-center justify-between gap-3">
        <Button variant="outline" size="sm" onclick={goBack} class="shrink-0">← 목록으로</Button>

        <div class="flex shrink-0 gap-2">
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
            {#if isAuthor}
                <Button variant="outline" size="sm" onclick={goToEdit}>
                    <Pencil class="mr-1 h-4 w-4" />
                    수정
                </Button>
            {/if}
            {#if isAuthor || isAdmin}
                <DeleteConfirmDialog
                    title="게시글 삭제"
                    description="이 게시글을 삭제하시겠습니까? 댓글도 함께 삭제되며, 이 작업은 되돌릴 수 없습니다."
                    onConfirm={handleDelete}
                    isLoading={isDeleting}
                />
            {/if}
        </div>
    </div>

    <!-- 게시글 카드 -->
    <Card class="bg-background mb-6">
        <CardHeader class="space-y-3">
            <div>
                {#if data.post.category}
                    <div class="mb-3 flex flex-wrap gap-1.5">
                        <span
                            class="bg-primary/10 text-primary rounded-md px-2 py-0.5 text-[13px] font-medium"
                        >
                            {data.post.category}
                        </span>
                    </div>
                {/if}
                <CardTitle class="text-foreground flex items-center gap-2 text-xl sm:text-2xl">
                    {#if data.post.is_secret}
                        <Lock class="text-muted-foreground h-6 w-6 shrink-0" />
                    {/if}
                    {data.post.title}
                </CardTitle>
                {#if data.post.tags && data.post.tags.length > 0}
                    <div class="mt-3 flex flex-wrap gap-2">
                        {#each data.post.tags as tag, i (i)}
                            <a href="/tags/{encodeURIComponent(tag)}">
                                <Badge variant="secondary" class="cursor-pointer hover:bg-primary/10">#{tag}</Badge>
                            </a>
                        {/each}
                    </div>
                {/if}
            </div>

            <div class="border-border flex flex-wrap items-center gap-4 border-t pt-4">
                <div class="flex items-center gap-2">
                    {#if getMemberIconUrl(data.post.author_id)}
                        <img
                            src={getMemberIconUrl(data.post.author_id)}
                            alt={data.post.author}
                            class="size-10 rounded-full object-cover"
                            onerror={(e) => {
                                const img = e.currentTarget as HTMLImageElement;
                                img.style.display = 'none';
                                const fallback = img.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = 'flex';
                            }}
                        />
                        <div
                            class="bg-primary text-primary-foreground hidden size-10 items-center justify-center rounded-full"
                        >
                            {data.post.author.charAt(0).toUpperCase()}
                        </div>
                    {:else}
                        <div
                            class="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-full"
                        >
                            {data.post.author.charAt(0).toUpperCase()}
                        </div>
                    {/if}
                    <div>
                        <p class="text-foreground flex items-center gap-1.5 font-medium">
                            <LevelBadge level={memberLevelStore.getLevel(data.post.author_id)} />
                            {data.post.author}
                            {#if memoPluginActive && MemoBadge}
                                <MemoBadge memberId={data.post.author_id} showIcon={true} />
                            {/if}
                            {#if data.post.author_ip}
                                <span class="text-muted-foreground ml-1 text-xs font-normal"
                                    >({data.post.author_ip})</span
                                >
                            {/if}
                        </p>
                        <p class="text-secondary-foreground text-[15px]">
                            {formatDate(data.post.created_at)}
                        </p>
                    </div>
                </div>

                <div
                    class="text-secondary-foreground ml-auto flex gap-2 text-[13px] sm:gap-4 sm:text-[15px]"
                >
                    <span>조회 {data.post.views.toLocaleString()}</span>
                    <span>추천 {likeCount.toLocaleString()}</span>
                    <span>댓글 {data.post.comments_count.toLocaleString()}</span>
                </div>
            </div>
        </CardHeader>
        <CardContent class="space-y-6">
            <!-- 플러그인 슬롯: post.before_content (Q&A 상태 헤더 등) -->
            {#each beforeContentSlots as slot (slot.component)}
                {@const SlotComponent = slot.component}
                <SlotComponent
                    {...slot.propsMapper ? slot.propsMapper(data) : { data }}
                />
            {/each}

            <!-- GAM 광고 -->
            {#if widgetLayoutStore.hasEnabledAds}
                <AdSlot position="board-content" height="90px" />
            {/if}

            <!-- 게시글 본문 -->
            {#if canViewSecret}
                <AdultBlur isAdult={data.post.is_adult ?? false}>
                    <Markdown content={postContent()} />

                    {#if data.post.images && data.post.images.length > 0}
                        <div class="mt-6 grid gap-4">
                            {#each data.post.images as image, i (i)}
                                <img
                                    src={image}
                                    alt="게시글 이미지"
                                    class="max-w-full rounded-lg border"
                                    loading="lazy"
                                />
                            {/each}
                        </div>
                    {/if}
                </AdultBlur>
            {:else}
                <div
                    class="flex flex-col items-center justify-center rounded-xl border border-dashed py-16"
                >
                    <Lock class="text-muted-foreground mb-4 h-12 w-12" />
                    <p class="text-muted-foreground text-lg font-medium">비밀글입니다</p>
                    <p class="text-muted-foreground mt-1 text-sm">
                        작성자와 관리자만 볼 수 있습니다.
                    </p>
                </div>
            {/if}
        </CardContent>
        {#if canViewSecret}
            <CardFooter class="flex-col items-start gap-3">
                <!-- 추천/비추천/신고 버튼 -->
                <div class="flex w-full flex-wrap items-center gap-3">
                    <!-- 추천 버튼 -->
                    <div class="border-border flex items-center rounded-lg border">
                        <Button
                            variant="ghost"
                            size="sm"
                            onclick={handleLike}
                            disabled={isLiking}
                            class="gap-2 {isLiked ? 'text-liked' : ''}"
                        >
                            <Heart
                                class="h-5 w-5 {isLiked ? 'fill-liked' : ''} {isLikeAnimating
                                    ? 'like-animation'
                                    : ''}"
                            />
                            <span class="font-semibold">{likeCount}</span>
                        </Button>
                        <button
                            type="button"
                            onclick={loadLikers}
                            class="text-muted-foreground hover:text-foreground border-border border-l px-2 py-1 text-xs transition-colors"
                        >
                            <Users class="h-4 w-4" />
                        </button>
                    </div>

                    <!-- 추천자 아바타 스택 (같은 줄) -->
                    {#if likers.length > 0}
                        <AvatarStack
                            items={likers}
                            total={likersTotal}
                            max={5}
                            size="sm"
                            onclick={loadLikers}
                        />
                    {/if}

                    <!-- 비추천 버튼 (게시판 설정에서 활성화된 경우만) -->
                    {#if data.board?.use_nogood === 1}
                        <div class="border-border flex items-center rounded-lg border">
                            <Button
                                variant="ghost"
                                size="sm"
                                onclick={handleDislike}
                                disabled={isDisliking}
                                class="gap-2 {isDisliked ? 'text-disliked' : ''}"
                            >
                                <ThumbsDown class="h-5 w-5 {isDisliked ? 'fill-disliked' : ''}" />
                                <span class="font-semibold">{dislikeCount}</span>
                            </Button>
                        </div>
                    {/if}

                    <!-- 신고 버튼 -->
                    {#if !isAuthor}
                        <Button
                            variant="ghost"
                            size="sm"
                            onclick={() => {
                                if (!authStore.isAuthenticated) {
                                    authStore.redirectToLogin();
                                    return;
                                }
                                showReportDialog = true;
                            }}
                            class="text-muted-foreground hover:text-destructive ml-auto gap-2"
                        >
                            <Flag class="h-4 w-4" />
                            <span>신고</span>
                        </Button>
                    {/if}
                </div>

                <!-- 리액션 (da-reaction 플러그인) -->
                {#if reactionPluginActive}
                    <ReactionBar {boardId} postId={data.post.id} target="post" />
                {/if}
            </CardFooter>
        {/if}
    </Card>

    <!-- 수정/삭제 시간 표시 -->
    {#if data.post.updated_at && data.post.updated_at !== data.post.created_at}
        <p class="text-muted-foreground mt-4 text-center text-[15px]">
            마지막 수정: {formatDate(data.post.updated_at)}
        </p>
    {/if}

    <!-- 본문 하단 광고 -->
    {#if widgetLayoutStore.hasEnabledAds}
        <div class="my-6">
            <AdSlot position="board-content-bottom" height="90px" />
        </div>
    {/if}

    <!-- 플러그인 슬롯: post.after_content (나눔 BidPanel 등) -->
    {#each afterContentSlots as slot (slot.component)}
        {@const SlotComponent = slot.component}
        <div class="mb-6">
            <SlotComponent
                {...slot.propsMapper ? slot.propsMapper(data) : { data }}
            />
        </div>
    {/each}

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

    <!-- 댓글 섹션 (비밀글 열람 가능 시에만 표시) -->
    {#if canViewSecret}
        <Card class="bg-background">
            <CardHeader>
                <h3 class="text-foreground text-lg font-semibold">
                    댓글 <span class="text-muted-foreground">({comments.length})</span>
                </h3>
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
                />

                <div class="border-border border-t pt-6">
                    <CommentForm
                        onSubmit={handleCreateComment}
                        isLoading={isCreatingComment}
                        permissions={data.board?.permissions}
                        requiredCommentLevel={data.board?.comment_level ?? 1}
                    />
                </div>
            </CardContent>
        </Card>
    {/if}

    <!-- 1시간 추천글 리스트 -->
    <div class="mt-6">
        <RecommendedPosts />
    </div>

    <!-- 추천글 아래 배너 -->
    {#if widgetLayoutStore.hasEnabledAds}
        <div class="mt-6">
            <AdSlot position="board-content-bottom" height="90px" />
        </div>
    {/if}

    <!-- 게시판 최근글 목록 (체류시간 증가) -->
    <div class="mt-6">
        <RecentPosts {boardId} {boardTitle} currentPostId={data.post.id} limit={10} />
    </div>

    <!-- 댓글 섹션 하단 광고 (푸터 위) -->
    {#if widgetLayoutStore.hasEnabledAds}
        <div class="mt-6">
            <AdSlot position="board-footer" height="90px" />
        </div>
    {/if}
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

<style>
    /* 좋아요 버튼 애니메이션 (ASIS 다모앙과 동일) */
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
</style>
