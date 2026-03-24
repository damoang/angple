<script lang="ts">
    /**
     * 나눔 게시판 레이아웃
     *
     * 나눔 게시글을 탭 (진행중/종료)으로 분류하여 표시합니다.
     * - 실시간 카운트다운 타이머
     * - 응모 건수 표시 (0건, 1-20건, 20건+, 50건+ 축제)
     * - 상태 뱃지 (진행중, 대기중, 일시정지, 종료)
     *
     * Design System: "Soft Modern" - 카드 기반, 부드러운 전환
     */
    import { Card } from '$lib/components/ui/card';
    import { Badge } from '$lib/components/ui/badge';
    import * as Tabs from '$lib/components/ui/tabs';
    import { Gift, Clock, Users, Pause, PlayCircle, Timer } from '../../lucide.js';
    import {
        resolveGivingMeta,
        type GivingMetaSource,
        type GivingStatus
    } from '../../../apps/web/src/lib/features/giving/model';

    interface GivingPost extends GivingMetaSource {
        id: number;
        title: string;
        url?: string;
        thumbnail_url?: string;
        author?: {
            id?: string;
            nickname?: string;
            avatar_url?: string;
        };
        giving_start?: string;
        giving_end?: string;
        is_paused?: boolean;
        bid_count?: number;
        comment_count?: number;
        created_at?: string;
    }

    let {
        posts = [],
        showTitle = true,
        boardId = ''
    }: {
        posts: GivingPost[];
        showTitle?: boolean;
        boardId?: string;
    } = $props();

    // 현재 시간 (반응형)
    let now = $state(Date.now());
    $effect(() => {
        const interval = setInterval(() => {
            now = Date.now();
        }, 1000);
        return () => clearInterval(interval);
    });

    function getGivingStatus(post: GivingPost): {
        status: GivingStatus;
        text: string;
        icon: typeof Gift;
        class: string;
    } {
        const meta = resolveGivingMeta(
            {
                extra_4: post.giving_start,
                extra_5: post.giving_end,
                extra_7: post.is_paused ? '1' : undefined,
                participant_count: post.bid_count
            },
            now
        );

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

    // 활성/종료 목록 분류
    const activeList = $derived(
        posts.filter((p) => {
            const status = getGivingStatus(p).status;
            return status === 'active' || status === 'waiting' || status === 'paused';
        })
    );

    const endedList = $derived(
        posts.filter((p) => {
            const status = getGivingStatus(p).status;
            return status === 'ended';
        })
    );

    // 카운트다운 포맷
    function formatCountdown(endTime: string): string {
        const end = new Date(endTime).getTime();
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
    function getBidCountStyle(count: number): string {
        if (count === 0) return 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';
        if (count < 20) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400';
        if (count >= 50)
            return 'bg-gradient-to-r from-rose-500 to-amber-500 text-white animate-pulse';
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400';
    }

    // 날짜 포맷
    function formatDate(dateStr?: string): string {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return `${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }

    let currentTab = $state('active');
</script>

<Card class="gap-0 overflow-hidden">
    {#if showTitle}
        <div class="border-border flex items-center gap-2 border-b px-4 py-2.5">
            <Gift class="h-4 w-4 text-emerald-500" />
            <h3 class="text-sm font-semibold">나눔</h3>
        </div>
    {/if}

    <Tabs.Root bind:value={currentTab} class="w-full">
        <Tabs.List class="border-border bg-muted/30 grid w-full grid-cols-2 border-b">
            <Tabs.Trigger value="active" class="data-[state=active]:bg-background gap-2">
                <span>진행중</span>
                <Badge variant="secondary" class="ml-1 h-5 px-1.5 text-xs">
                    {activeList.length}
                </Badge>
            </Tabs.Trigger>
            <Tabs.Trigger value="ended" class="data-[state=active]:bg-background gap-2">
                <span>종료</span>
                <Badge variant="secondary" class="ml-1 h-5 px-1.5 text-xs">
                    {endedList.length}
                </Badge>
            </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="active" class="p-4">
            {#if activeList.length === 0}
                <div class="flex flex-col items-center justify-center py-10 text-center">
                    <Gift class="text-muted-foreground/50 mb-3 h-10 w-10" />
                    <p class="text-muted-foreground">현재 진행중인 나눔이 없습니다.</p>
                </div>
            {:else}
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {#each activeList as post (post.id)}
                        {@const status = getGivingStatus(post)}
                        <a
                            href={post.url ?? '#'}
                            class="border-border bg-background group flex flex-col overflow-hidden rounded-xl border shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md"
                        >
                            <!-- 썸네일 -->
                            <div class="bg-muted relative aspect-[4/3] overflow-hidden">
                                {#if post.thumbnail_url}
                                    <img
                                        src={post.thumbnail_url}
                                        alt={post.title}
                                        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                        loading="lazy"
                                    />
                                {:else}
                                    <div
                                        class="text-muted-foreground flex h-full w-full items-center justify-center"
                                    >
                                        <Gift class="h-12 w-12 opacity-30" />
                                    </div>
                                {/if}

                                <!-- 상태 뱃지 -->
                                <div class="absolute right-2 top-2">
                                    <span
                                        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold {status.class}"
                                    >
                                        <svelte:component this={status.icon} class="h-3 w-3" />
                                        {status.text}
                                    </span>
                                </div>
                            </div>

                            <!-- 콘텐츠 -->
                            <div class="flex flex-1 flex-col p-3">
                                <h4 class="text-foreground line-clamp-2 text-sm font-medium">
                                    {post.title}
                                </h4>
                                {#if post.comment_count}
                                    <span class="text-primary ml-1 text-xs"
                                        >+{post.comment_count}</span
                                    >
                                {/if}

                                <!-- 나눔 시간 정보 -->
                                {#if post.giving_start && post.giving_end}
                                    <div class="text-muted-foreground mt-2 space-y-1 text-xs">
                                        <div class="flex justify-between">
                                            <span>시작</span>
                                            <span class="font-medium"
                                                >{formatDate(post.giving_start)}</span
                                            >
                                        </div>
                                        <div class="flex justify-between">
                                            <span>종료</span>
                                            <span class="font-medium"
                                                >{formatDate(post.giving_end)}</span
                                            >
                                        </div>
                                    </div>

                                    <!-- 카운트다운 -->
                                    {#if status.status === 'active'}
                                        <div class="mt-2 text-center">
                                            <span class="font-mono text-sm font-bold text-red-600">
                                                {formatCountdown(post.giving_end)}
                                            </span>
                                        </div>
                                    {:else if status.status === 'waiting'}
                                        <div class="mt-2 text-center">
                                            <Badge variant="outline" class="text-xs">
                                                {formatDate(post.giving_start)} 시작
                                            </Badge>
                                        </div>
                                    {/if}
                                {/if}

                                <!-- 응모 건수 -->
                                {#if post.bid_count !== undefined && post.giving_start && post.giving_end}
                                    <div class="mt-auto pt-2">
                                        <div
                                            class="rounded-lg px-3 py-1.5 text-center text-sm font-semibold {getBidCountStyle(
                                                post.bid_count
                                            )}"
                                        >
                                            {post.bid_count}건 응모
                                        </div>
                                    </div>
                                {/if}

                                <!-- 작성자 -->
                                {#if post.author}
                                    <div class="mt-2 flex items-center gap-2 pt-2">
                                        {#if post.author.avatar_url}
                                            <img
                                                src={post.author.avatar_url}
                                                alt=""
                                                class="h-5 w-5 rounded-full object-cover"
                                            />
                                        {/if}
                                        <span class="text-muted-foreground truncate text-xs">
                                            {post.author.nickname ?? post.author.id}
                                        </span>
                                    </div>
                                {/if}
                            </div>
                        </a>
                    {/each}
                </div>
            {/if}
        </Tabs.Content>

        <Tabs.Content value="ended" class="p-4">
            {#if endedList.length === 0}
                <div class="flex flex-col items-center justify-center py-10 text-center">
                    <Clock class="text-muted-foreground/50 mb-3 h-10 w-10" />
                    <p class="text-muted-foreground">종료된 나눔이 없습니다.</p>
                </div>
            {:else}
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {#each endedList as post (post.id)}
                        {@const status = getGivingStatus(post)}
                        <a
                            href={post.url ?? '#'}
                            class="border-border bg-background group flex flex-col overflow-hidden rounded-xl border opacity-75 shadow-sm transition-all duration-200 ease-out hover:opacity-100 hover:shadow-md"
                        >
                            <!-- 썸네일 -->
                            <div
                                class="bg-muted relative aspect-[4/3] overflow-hidden grayscale-[30%]"
                            >
                                {#if post.thumbnail_url}
                                    <img
                                        src={post.thumbnail_url}
                                        alt={post.title}
                                        class="h-full w-full object-cover"
                                        loading="lazy"
                                    />
                                {:else}
                                    <div
                                        class="text-muted-foreground flex h-full w-full items-center justify-center"
                                    >
                                        <Gift class="h-12 w-12 opacity-30" />
                                    </div>
                                {/if}

                                <!-- 상태 뱃지 -->
                                <div class="absolute right-2 top-2">
                                    <span
                                        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold {status.class}"
                                    >
                                        <Clock class="h-3 w-3" />
                                        종료
                                    </span>
                                </div>

                                <!-- 참여 인원 뱃지 -->
                                {#if post.bid_count && post.bid_count > 0}
                                    <div class="absolute left-2 top-2">
                                        <span
                                            class="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold text-white"
                                        >
                                            <Users class="h-3 w-3" />
                                            {post.bid_count.toLocaleString()}명
                                        </span>
                                    </div>
                                {/if}
                            </div>

                            <!-- 콘텐츠 -->
                            <div class="flex flex-1 flex-col p-3">
                                <h4 class="text-foreground line-clamp-2 text-sm font-medium">
                                    {post.title}
                                </h4>
                                {#if post.comment_count}
                                    <span class="text-primary ml-1 text-xs"
                                        >+{post.comment_count}</span
                                    >
                                {/if}

                                <!-- 작성자 -->
                                {#if post.author}
                                    <div class="mt-auto flex items-center gap-2 pt-2">
                                        {#if post.author.avatar_url}
                                            <img
                                                src={post.author.avatar_url}
                                                alt=""
                                                class="h-5 w-5 rounded-full object-cover"
                                            />
                                        {/if}
                                        <span class="text-muted-foreground truncate text-xs">
                                            {post.author.nickname ?? post.author.id}
                                        </span>
                                    </div>
                                {/if}
                            </div>
                        </a>
                    {/each}
                </div>
            {/if}
        </Tabs.Content>
    </Tabs.Root>
</Card>
