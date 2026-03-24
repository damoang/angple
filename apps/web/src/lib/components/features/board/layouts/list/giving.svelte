<script lang="ts">
    /**
     * 나눔 게시판 레이아웃
     *
     * 나눔 게시글을 카드 형태로 표시합니다.
     * - 실시간 카운트다운 타이머
     * - 응모 건수 표시 (0건, 1-20건, 20건+, 50건+ 축제)
     * - 상태 뱃지 (진행중, 대기중, 일시정지, 종료)
     *
     * Design System: "Soft Modern" - 카드 기반, 부드러운 전환
     *
     * 확장 필드 매핑:
     * - extra_4: 시작일시 (wr_4)
     * - extra_5: 종료일시 (wr_5)
     * - extra_7: 상태 (0=활성, 1=일시정지, 2=강제종료) (wr_7)
     * - extra_2: 응모수/포인트 (wr_2)
     */
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
    import AuthorLink from '$lib/components/ui/author-link/author-link.svelte';
    import Gift from '@lucide/svelte/icons/gift';
    import Clock from '@lucide/svelte/icons/clock';
    import Users from '@lucide/svelte/icons/users';
    import Pause from '@lucide/svelte/icons/pause';
    import PlayCircle from '@lucide/svelte/icons/play-circle';
    import Timer from '@lucide/svelte/icons/timer';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import { resolveGivingMeta, type GivingStatus } from '$lib/features/giving/model.js';
    let {
        post,
        displaySettings,
        href,
        isRead = false
    }: {
        post: FreePost;
        displaySettings?: BoardDisplaySettings;
        href: string;
        isRead?: boolean;
    } = $props();

    // 삭제된 글
    const isDeleted = $derived(!!post.deleted_at);

    // 썸네일 표시
    const thumbnailUrl = $derived(post.thumbnail || post.images?.[0] || '');
    const hasImage = $derived(Boolean(thumbnailUrl));

    const givingMeta = $derived(resolveGivingMeta(post));
    const givingStart = $derived(post.giving_start ?? givingMeta.givingStart);
    const givingEnd = $derived(post.giving_end ?? givingMeta.givingEnd);
    const bidCount = $derived(post.participant_count ?? givingMeta.participantCount);

    // 현재 시간 (반응형)
    let now = $state(Date.now());
    $effect(() => {
        const interval = setInterval(() => {
            now = Date.now();
        }, 1000);
        return () => clearInterval(interval);
    });

    // 나눔 상태 계산
    function getGivingStatus(): {
        status: GivingStatus;
        text: string;
        icon: typeof Gift;
        class: string;
    } {
        const meta = resolveGivingMeta(post, now);
        switch (meta.status) {
            case 'paused':
                return {
                    status: 'paused',
                    text: '일시정지',
                    icon: Pause,
                    class: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'
                };
            case 'active':
                return {
                    status: 'active',
                    text: '진행중',
                    icon: PlayCircle,
                    class: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400'
                };
            case 'ended':
                return {
                    status: 'ended',
                    text: '종료',
                    icon: Clock,
                    class: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                };
            case 'waiting':
                return {
                    status: 'waiting',
                    text: '대기중',
                    icon: Timer,
                    class: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400'
                };
            default:
                return {
                    status: 'no_giving',
                    text: '일반글',
                    icon: Gift,
                    class: 'bg-muted text-muted-foreground'
                };
        }
    }

    const statusInfo = $derived(getGivingStatus());
    const isEnded = $derived(statusInfo.status === 'ended');

    // 카운트다운 포맷
    function formatCountdown(): string {
        if (!givingEnd) return '';
        const end = new Date(givingEnd).getTime();
        const diff = end - now;

        if (diff <= 0) return '종료';

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (days > 0) {
            return `${days}일 ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    // 응모 건수 스타일
    function getBidCountStyle(): string {
        if (bidCount === 0) return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
        if (bidCount < 20)
            return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400';
        if (bidCount >= 50)
            return 'bg-gradient-to-r from-rose-500 to-amber-500 text-white animate-pulse';
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400';
    }

    // 날짜 포맷
    function formatDate(dateStr?: string): string {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return `${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
</script>

<!-- 나눔 카드 -->
{#if isDeleted}
    <a
        {href}
        class="border-border bg-background flex cursor-pointer flex-col overflow-hidden rounded-xl border no-underline opacity-50 transition-shadow hover:shadow-md"
    >
        <div class="bg-muted flex aspect-[4/3] items-center justify-center">
            <span class="text-muted-foreground text-sm">[삭제됨]</span>
        </div>
    </a>
{:else}
    <a
        {href}
        class="border-border bg-background group flex flex-col overflow-hidden rounded-xl border shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md {isEnded
            ? 'opacity-75'
            : ''}"
    >
        <!-- 썸네일 -->
        <div
            class="bg-muted relative aspect-[4/3] overflow-hidden {isEnded
                ? 'grayscale-[30%]'
                : ''}"
        >
            {#if hasImage}
                <img
                    src={thumbnailUrl}
                    alt={post.title}
                    class="h-full w-full object-cover transition-transform duration-300 {isEnded
                        ? ''
                        : 'group-hover:scale-105'}"
                    loading="lazy"
                />
            {:else}
                <div class="text-muted-foreground flex h-full w-full items-center justify-center">
                    <Gift class="h-12 w-12 opacity-30" />
                </div>
            {/if}

            <!-- 상태 뱃지 -->
            <div class="absolute right-2 top-2">
                <span
                    class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold {statusInfo.class}"
                >
                    {#if statusInfo.status === 'active'}
                        <PlayCircle class="h-3 w-3" />
                    {:else if statusInfo.status === 'waiting'}
                        <Timer class="h-3 w-3" />
                    {:else if statusInfo.status === 'paused'}
                        <Pause class="h-3 w-3" />
                    {:else if statusInfo.status === 'ended'}
                        <Clock class="h-3 w-3" />
                    {:else}
                        <Gift class="h-3 w-3" />
                    {/if}
                    {statusInfo.text}
                </span>
            </div>

            <!-- 참여 인원 뱃지 (종료된 경우) -->
            {#if isEnded && bidCount > 0}
                <div class="absolute left-2 top-2">
                    <span
                        class="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold text-white"
                    >
                        <Users class="h-3 w-3" />
                        {bidCount.toLocaleString()}명
                    </span>
                </div>
            {/if}
        </div>

        <!-- 콘텐츠 -->
        <div class="flex flex-1 flex-col p-3">
            <h4
                class="line-clamp-2 text-sm font-medium {isRead
                    ? 'text-muted-foreground'
                    : 'text-foreground'}"
            >
                {post.title}
            </h4>
            {#if post.comments_count > 0}
                <span class="text-primary ml-1 inline-flex items-center gap-0.5 text-xs">
                    <MessageSquare class="h-3 w-3" />
                    {post.comments_count}
                </span>
            {/if}

            <!-- 나눔 시간 정보 -->
            {#if givingStart && givingEnd}
                <div class="text-muted-foreground mt-2 space-y-1 text-xs">
                    <div class="flex justify-between">
                        <span>시작</span>
                        <span class="font-medium">{formatDate(givingStart)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span>종료</span>
                        <span class="font-medium">{formatDate(givingEnd)}</span>
                    </div>
                </div>

                <!-- 카운트다운 -->
                {#if statusInfo.status === 'active'}
                    <div class="mt-2 text-center">
                        <span class="font-mono text-sm font-bold text-red-600">
                            {formatCountdown()}
                        </span>
                    </div>
                {:else if statusInfo.status === 'waiting'}
                    <div class="mt-2 text-center">
                        <span
                            class="border-border text-muted-foreground inline-flex items-center rounded-full border px-2 py-0.5 text-xs"
                        >
                            {formatDate(givingStart)} 시작
                        </span>
                    </div>
                {/if}

                <!-- 응모 건수 -->
                {#if !isEnded}
                    <div class="mt-auto pt-2">
                        <div
                            class="rounded-lg px-3 py-1.5 text-center text-sm font-semibold {getBidCountStyle()}"
                        >
                            {bidCount}건 응모
                        </div>
                    </div>
                {/if}
            {/if}

            <!-- 작성자 -->
            <div class="text-muted-foreground mt-2 flex items-center gap-2 pt-2 text-xs">
                <span class="truncate">
                    <AuthorLink
                        authorId={post.author_id}
                        authorName={post.author}
                        isWithdrawn={!!post.is_left}
                    />
                </span>
            </div>
        </div>
    </a>
{/if}
