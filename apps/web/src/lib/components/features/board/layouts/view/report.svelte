<script lang="ts">
    /**
     * report 뷰 레이아웃 — 운영 리포트 대시보드
     *
     * PHP `report/view.skin.php` 포팅.
     * post.extra_9에 JSON 통계 데이터가 저장됨.
     *
     * 구성요소:
     * - 기간 배지 (date_from ~ date_to)
     * - 주요 지표 카드: 전체 글 수, 전체 댓글 수
     * - 보조 지표 카드: 신고처리, 제재, 신고글, 이의제기, 신고댓글, 신고자 수
     * - 기본 본문 (basic의 CardContent 부분 재사용)
     */

    import {
        Card,
        CardHeader,
        CardContent,
        CardFooter,
        CardTitle
    } from '$lib/components/ui/card/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Markdown } from '$lib/components/ui/markdown/index.js';
    import ExternalLink from '@lucide/svelte/icons/external-link';
    import Download from '@lucide/svelte/icons/download';
    import Video from '@lucide/svelte/icons/video';
    import Heart from '@lucide/svelte/icons/heart';
    import ThumbsDown from '@lucide/svelte/icons/thumbs-down';
    import Users from '@lucide/svelte/icons/users';
    import Lock from '@lucide/svelte/icons/lock';
    import Flag from '@lucide/svelte/icons/flag';
    import FileText from '@lucide/svelte/icons/file-text';
    import MessageCircle from '@lucide/svelte/icons/message-circle';
    import Shield from '@lucide/svelte/icons/shield';
    import Gavel from '@lucide/svelte/icons/gavel';
    import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
    import Scale from '@lucide/svelte/icons/scale';
    import CalendarDays from '@lucide/svelte/icons/calendar-days';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { AdultBlur } from '$lib/components/features/adult/index.js';
    import { uiSettingsStore, type ContentFontSize } from '$lib/stores/ui-settings.svelte.js';
    import { getMemberIconUrl } from '$lib/utils/member-icon.js';
    import AuthorLink from '$lib/components/ui/author-link/author-link.svelte';
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
    import { memberLevelStore } from '$lib/stores/member-levels.svelte.js';
    import { ReactionBar } from '$lib/components/features/reaction/index.js';
    import { AvatarStack } from '$lib/components/ui/avatar-stack/index.js';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';
    import AdminViewLayoutSwitcher from '$lib/components/features/board/admin-view-layout-switcher.svelte';
    import EconomyShoppingBanner from '$lib/components/features/board/economy-shopping-banner.svelte';
    import Info from '@lucide/svelte/icons/info';
    import type { ViewLayoutProps } from '../types.js';

    const FONT_SIZES: Record<ContentFontSize, string> = {
        small: '16px',
        base: '18px',
        large: '20px',
        xlarge: '22px'
    };

    const currentFontSize = $derived(uiSettingsStore.contentFontSize);

    let {
        post,
        board,
        boardId,
        isAuthor,
        isAdmin,
        canViewSecret,
        likeCount,
        dislikeCount,
        isLiked,
        isDisliked,
        isLiking,
        isDisliking,
        isLikeAnimating,
        likers,
        likersTotal,
        fontSize,
        fontSizeLabel: _fontSizeLabel,
        onLike,
        onDislike,
        onLoadLikers,
        onReport,
        onChangeFontSize,
        memoPluginActive,
        reactionPluginActive,
        MemoBadge,
        beforeContentSlots,
        afterContentSlots,
        editCount = 0,
        formatDate,
        formatTimeShort,
        formatFileSize,
        postContent,
        pageData,
        promotionExpired = false,
        postReactions
    }: ViewLayoutProps = $props();

    let hasAffiliateLinks = $derived(postContent?.includes('data-affiliate') ?? false);

    // extra_9에서 통계 데이터 파싱
    interface ReportStats {
        date_from?: string;
        date_to?: string;
        total_posts?: number;
        total_comments?: number;
        report_processed?: number;
        sanctions?: number;
        reported_posts?: number;
        appeals?: number;
        reported_comments?: number;
        reporters?: number;
    }

    const stats = $derived.by((): ReportStats => {
        try {
            return JSON.parse(post.extra_9 || '{}');
        } catch {
            return {};
        }
    });

    // 기간 포맷
    function formatPeriod(dateStr?: string): string {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('ko-KR', {
                timeZone: 'Asia/Seoul',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } catch {
            return dateStr;
        }
    }

    // 주요 지표 카드 정의
    const primaryMetrics = $derived([
        {
            label: '전체 글 수',
            value: stats.total_posts ?? 0,
            icon: FileText,
            color: 'text-blue-600 dark:text-blue-400',
            bg: 'bg-blue-50 dark:bg-blue-950/30'
        },
        {
            label: '전체 댓글 수',
            value: stats.total_comments ?? 0,
            icon: MessageCircle,
            color: 'text-green-600 dark:text-green-400',
            bg: 'bg-green-50 dark:bg-green-950/30'
        }
    ]);

    // 보조 지표 카드 정의
    const secondaryMetrics = $derived([
        {
            label: '신고처리',
            value: stats.report_processed ?? 0,
            icon: Shield,
            color: 'text-purple-600 dark:text-purple-400',
            bg: 'bg-purple-50 dark:bg-purple-950/30'
        },
        {
            label: '제재',
            value: stats.sanctions ?? 0,
            icon: Gavel,
            color: 'text-red-600 dark:text-red-400',
            bg: 'bg-red-50 dark:bg-red-950/30'
        },
        {
            label: '신고글',
            value: stats.reported_posts ?? 0,
            icon: AlertTriangle,
            color: 'text-orange-600 dark:text-orange-400',
            bg: 'bg-orange-50 dark:bg-orange-950/30'
        },
        {
            label: '이의제기',
            value: stats.appeals ?? 0,
            icon: Scale,
            color: 'text-teal-600 dark:text-teal-400',
            bg: 'bg-teal-50 dark:bg-teal-950/30'
        },
        {
            label: '신고댓글',
            value: stats.reported_comments ?? 0,
            icon: MessageCircle,
            color: 'text-amber-600 dark:text-amber-400',
            bg: 'bg-amber-50 dark:bg-amber-950/30'
        },
        {
            label: '신고자 수',
            value: stats.reporters ?? 0,
            icon: Users,
            color: 'text-indigo-600 dark:text-indigo-400',
            bg: 'bg-indigo-50 dark:bg-indigo-950/30'
        }
    ]);
</script>

<!-- 운영 리포트 카드 -->
<Card class="bg-background mb-6">
    <CardHeader class="space-y-3">
        <!-- 관리자 본문 레이아웃 스위처 -->
        <div class="flex items-center justify-end">
            <AdminViewLayoutSwitcher
                {boardId}
                currentLayout={board?.display_settings?.view_layout || 'report'}
            />
        </div>
        <div>
            {#if post.category}
                <div class="mb-3 flex flex-wrap gap-1.5">
                    <span
                        class="bg-primary/10 text-primary rounded-md px-2 py-0.5 text-[13px] font-medium"
                    >
                        {post.category}
                    </span>
                </div>
            {/if}
            <CardTitle
                class="text-foreground flex items-center gap-2 text-xl font-bold sm:text-2xl"
            >
                {post.title}
            </CardTitle>

            <!-- 리포트 기간 배지 -->
            {#if stats.date_from || stats.date_to}
                <div class="mt-3 flex items-center gap-2">
                    <Badge variant="outline" class="gap-1.5 px-3 py-1">
                        <CalendarDays class="h-3.5 w-3.5" />
                        {formatPeriod(stats.date_from)} ~ {formatPeriod(stats.date_to)}
                    </Badge>
                </div>
            {/if}
        </div>

        <div class="border-border flex flex-wrap items-center gap-4 border-t pt-4">
            <div class="flex items-center gap-2">
                {#if getMemberIconUrl(post.author_id)}
                    <img
                        src={getMemberIconUrl(post.author_id)}
                        alt={post.author}
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
                        {post.author.charAt(0).toUpperCase()}
                    </div>
                {:else}
                    <div
                        class="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-full"
                    >
                        {post.author.charAt(0).toUpperCase()}
                    </div>
                {/if}
                <div>
                    <p class="text-foreground flex items-center gap-1.5 font-medium">
                        <LevelBadge level={memberLevelStore.getLevel(post.author_id)} />
                        <AuthorLink authorId={post.author_id} authorName={post.author} />
                        {#if memoPluginActive && MemoBadge && !uiSettingsStore.hideMemo}
                            <MemoBadge
                                memberId={post.author_id}
                                showIcon={true}
                                blur={uiSettingsStore.blurMemo}
                            />
                        {/if}
                    </p>
                    <p class="text-secondary-foreground text-[15px]">
                        {formatDate(post.created_at)}
                        {#if post.updated_at && post.updated_at !== post.created_at && formatTimeShort}
                            {#if editCount > 0}
                                <span class="text-muted-foreground/70"
                                    >· 수정 {editCount}회({formatTimeShort(
                                        post.updated_at,
                                        post.created_at
                                    )})</span
                                >
                            {:else}
                                <span class="text-muted-foreground/70"
                                    >· 수정됨({formatTimeShort(
                                        post.updated_at,
                                        post.created_at
                                    )})</span
                                >
                            {/if}
                        {/if}
                        {#if post.deleted_at && formatTimeShort}
                            <span class="text-red-500/70"
                                >· 삭제됨 {formatTimeShort(post.deleted_at, post.created_at)}</span
                            >
                        {/if}
                    </p>
                </div>
            </div>

            <div
                class="text-secondary-foreground ml-auto flex gap-2 text-[13px] sm:gap-4 sm:text-[15px]"
            >
                <span>조회 {post.views.toLocaleString()}</span>
                <span>추천 {likeCount.toLocaleString()}</span>
                <span>댓글 {post.comments_count.toLocaleString()}</span>
            </div>
        </div>
    </CardHeader>

    <CardContent class="space-y-6">
        <!-- 플러그인 슬롯: post.before_content -->
        {#each beforeContentSlots as slot (slot.component)}
            {@const SlotComponent = slot.component}
            <SlotComponent
                {...slot.propsMapper ? slot.propsMapper(pageData) : { data: pageData }}
            />
        {/each}

        <!-- 통계 대시보드 -->
        {#if Object.keys(stats).length > 0}
            <!-- 주요 지표 (2열) -->
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {#each primaryMetrics as metric (metric.label)}
                    {@const Icon = metric.icon}
                    <div class="rounded-xl border p-5 {metric.bg}">
                        <div class="flex items-center gap-3">
                            <div class="rounded-lg bg-white/60 p-2.5 dark:bg-white/10">
                                <Icon class="h-6 w-6 {metric.color}" />
                            </div>
                            <div>
                                <p class="text-muted-foreground text-sm">{metric.label}</p>
                                <p class="text-foreground text-2xl font-bold">
                                    {metric.value.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>

            <!-- 보조 지표 (반응형 그리드: 6col → 3col → 2col → 1col) -->
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {#each secondaryMetrics as metric (metric.label)}
                    {@const Icon = metric.icon}
                    <div class="rounded-lg border p-3 text-center {metric.bg}">
                        <Icon class="mx-auto mb-1.5 h-5 w-5 {metric.color}" />
                        <p class="text-foreground text-lg font-bold">
                            {metric.value.toLocaleString()}
                        </p>
                        <p class="text-muted-foreground text-xs">{metric.label}</p>
                    </div>
                {/each}
            </div>
        {/if}

        <!-- GAM 광고 -->
        {#if widgetLayoutStore.hasEnabledAds}
            <AdSlot position="board-content" height="90px" />
        {/if}

        <!-- 알뜰구매 모든 링크열기 (GAM 바로 아래) -->
        {#each afterContentSlots as slot (slot.component)}
            {@const SlotComponent = slot.component}
            <SlotComponent
                {...slot.propsMapper ? slot.propsMapper(pageData) : { data: pageData }}
            />
        {/each}

        <!-- 글자 크기 조절 -->
        <div class="mb-1 flex justify-end gap-1">
            <button
                type="button"
                class="text-muted-foreground hover:text-foreground active:bg-muted border-border hover:bg-muted rounded border px-3 py-1.5 text-sm transition-colors disabled:opacity-30"
                disabled={currentFontSize === 'small'}
                onclick={() => uiSettingsStore.changeContentFontSize(-1)}
                aria-label="글자 작게">A-</button
            >
            <button
                type="button"
                class="text-muted-foreground hover:text-foreground active:bg-muted border-border hover:bg-muted rounded border px-3 py-1.5 text-sm transition-colors"
                onclick={() => uiSettingsStore.changeContentFontSize(0)}
                aria-label="글자 기본">A</button
            >
            <button
                type="button"
                class="text-muted-foreground hover:text-foreground active:bg-muted border-border hover:bg-muted rounded border px-3 py-1.5 text-sm transition-colors disabled:opacity-30"
                disabled={currentFontSize === 'xlarge'}
                onclick={() => uiSettingsStore.changeContentFontSize(1)}
                aria-label="글자 크게">A+</button
            >
        </div>

        <!-- 게시글 본문 -->
        {#if canViewSecret}
            <AdultBlur
                isAdult={(post.is_adult ?? false) || uiSettingsStore.shouldBlurContent(post.title)}
            >
                <div id="economy-post-content" style="font-size: {FONT_SIZES[currentFontSize]}">
                    <Markdown content={postContent} />
                </div>

                {#if hasAffiliateLinks}
                    <p
                        class="text-muted-foreground mt-4 flex items-start gap-1.5 text-xs leading-relaxed"
                    >
                        <Info class="mt-0.5 h-3 w-3 shrink-0" />
                        <span
                            >이 글에 포함된 일부 링크는 제휴 링크이며, 다모앙은 소정의 커미션을 제공
                            받을 수 있습니다.</span
                        >
                    </p>
                {/if}

                {#if post.videos && post.videos.length > 0}
                    <div class="mt-6 space-y-4">
                        {#each post.videos as video, i (i)}
                            <div class="overflow-hidden rounded-lg border">
                                <video controls preload="metadata" playsinline class="w-full">
                                    <source src={video.url} />
                                    동영상을 재생할 수 없습니다.
                                </video>
                                <div
                                    class="bg-muted/50 flex items-center gap-3 border-t px-4 py-2.5"
                                >
                                    <Video class="text-muted-foreground h-4 w-4 shrink-0" />
                                    <span class="text-foreground min-w-0 truncate text-sm">
                                        {video.filename}
                                    </span>
                                    {#if video.size}
                                        <span class="text-muted-foreground shrink-0 text-xs">
                                            {formatFileSize(video.size)}
                                        </span>
                                    {/if}
                                    <a
                                        href={video.url}
                                        download={video.filename}
                                        class="text-primary hover:text-primary/80 ml-auto flex shrink-0 items-center gap-1 text-sm font-medium"
                                    >
                                        <Download class="h-4 w-4" />
                                        다운로드
                                    </a>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}

                {#if post.images && post.images.length > 0}
                    <div class="mt-6 grid gap-4">
                        {#each post.images as image, i (i)}
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

            {#if post.link1 || post.link2}
                <div class="mt-4 space-y-1.5">
                    {#if post.link1}
                        <div class="flex items-center gap-1.5 text-sm">
                            <ExternalLink class="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                            <a
                                href={post.link1}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="text-primary truncate hover:underline">{post.link1}</a
                            >
                        </div>
                    {/if}
                    {#if post.link2}
                        <div class="flex items-center gap-1.5 text-sm">
                            <ExternalLink class="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                            <a
                                href={post.link2}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="text-primary truncate hover:underline">{post.link2}</a
                            >
                        </div>
                    {/if}
                </div>
            {/if}
        {:else}
            <div
                class="flex flex-col items-center justify-center rounded-xl border border-dashed py-16"
            >
                <Lock class="text-muted-foreground mb-4 h-12 w-12" />
                {#if promotionExpired}
                    <p class="text-muted-foreground text-lg font-medium">
                        광고 기간이 종료된 게시글입니다
                    </p>
                    <p class="text-muted-foreground mt-1 text-sm">
                        광고주와 관리자만 볼 수 있습니다.
                    </p>
                {:else}
                    <p class="text-muted-foreground text-lg font-medium">비밀글입니다</p>
                    <p class="text-muted-foreground mt-1 text-sm">
                        작성자와 관리자만 볼 수 있습니다.
                    </p>
                {/if}
            </div>
        {/if}
    </CardContent>
    {#if canViewSecret}
        <CardFooter class="flex-col items-start gap-3">
            <!-- 추천/비추천/신고 버튼 -->
            <div
                id="likes"
                class="flex w-full flex-wrap items-center gap-3"
                style="scroll-margin-top: 100px"
            >
                <!-- 추천 버튼 -->
                <div
                    class="flex items-center rounded-lg border {isLiked
                        ? 'border-liked/40 bg-liked/5'
                        : 'border-border'}"
                >
                    <Button
                        variant="ghost"
                        size="sm"
                        onclick={onLike}
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
                        onclick={onLoadLikers}
                        class="border-l px-2 py-1 text-xs transition-colors {isLiked
                            ? 'border-liked/40 text-liked'
                            : 'text-muted-foreground hover:text-foreground border-border'}"
                    >
                        <Users class="h-4 w-4" />
                    </button>
                </div>

                <!-- 추천자 아바타 스택 -->
                {#if likers.length > 0}
                    <AvatarStack
                        items={likers}
                        total={likersTotal}
                        max={5}
                        size="sm"
                        onclick={onLoadLikers}
                    />
                {/if}

                <!-- 비추천 버튼 -->
                {#if board?.use_nogood}
                    <div class="border-border flex items-center rounded-lg border">
                        <Button
                            variant="ghost"
                            size="sm"
                            onclick={onDislike}
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
                            onReport();
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
                <ReactionBar
                    {boardId}
                    postId={post.id}
                    target="post"
                    initialReactions={postReactions}
                />
            {/if}
        </CardFooter>
    {/if}
</Card>

<style>
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
