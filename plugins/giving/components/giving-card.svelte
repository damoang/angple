<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
    import CountdownTimer from './countdown-timer.svelte';
    import ImageIcon from '@lucide/svelte/icons/image';
    import Users from '@lucide/svelte/icons/users';
    import type { GivingStatus } from '../types/giving.js';

    let {
        post,
        displaySettings,
        onclick
    }: {
        post: FreePost;
        displaySettings?: BoardDisplaySettings;
        onclick: () => void;
    } = $props();

    // giving 목록에서 넘어온 확장 데이터 (extra 필드 활용)
    const endTime = $derived(post.extra_5 || '');
    const startTime = $derived(post.extra_4 || '');
    const status = $derived(getStatus());
    const participantCount = $derived(
        parseInt((post as FreePost & { participant_count?: string }).participant_count || '0', 10)
    );
    const thumbnailUrl = $derived(post.extra_10 || post.thumbnail || post.images?.[0] || '');
    const hasImage = $derived(Boolean(thumbnailUrl));

    function getStatus(): GivingStatus {
        if (post.extra_7 === '2') return 'ended';
        if (post.extra_7 === '1') return 'paused';
        const now = new Date();
        if (endTime && new Date(endTime) <= now) return 'ended';
        if (startTime && new Date(startTime) > now) return 'waiting';
        return 'active';
    }

    // 참여자 배지 색상
    const participantBadgeClass = $derived(() => {
        if (participantCount === 0)
            return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
        if (participantCount < 20)
            return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
        if (participantCount < 50)
            return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
    });

    // 상태 배지
    const statusBadge = $derived(() => {
        switch (status) {
            case 'active':
                return {
                    label: '진행중',
                    class: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                };
            case 'waiting':
                return {
                    label: '대기중',
                    class: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                };
            case 'paused':
                return {
                    label: '일시정지',
                    class: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                };
            case 'ended':
                return {
                    label: '종료',
                    class: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                };
        }
    });
</script>

<!-- 나눔 카드 레이아웃 -->
<div
    class="bg-background border-border hover:border-primary/30 group cursor-pointer overflow-hidden rounded-lg border transition-all hover:shadow-md {status ===
    'ended'
        ? 'opacity-60'
        : ''}"
    {onclick}
    role="button"
    tabindex="0"
    onkeydown={(e) => e.key === 'Enter' && onclick()}
>
    <!-- 썸네일 -->
    <div class="bg-muted relative aspect-video overflow-hidden">
        {#if hasImage}
            <img
                src={thumbnailUrl}
                alt=""
                class="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
                onerror={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                }}
            />
        {:else}
            <div class="flex h-full items-center justify-center">
                <ImageIcon class="text-muted-foreground h-10 w-10" />
            </div>
        {/if}

        <!-- 상태 배지 (좌상단) -->
        <div class="absolute left-2 top-2">
            <span
                class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {statusBadge()
                    .class}"
            >
                {#if status === 'active'}
                    <span class="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-green-500"></span>
                {/if}
                {statusBadge().label}
            </span>
        </div>

        <!-- 참여자 수 배지 (우상단) -->
        <div class="absolute right-2 top-2">
            <span
                class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium {participantBadgeClass()}"
            >
                <Users class="h-3 w-3" />
                {participantCount}
            </span>
        </div>

        <!-- 카운트다운 (하단) -->
        {#if endTime && status !== 'ended'}
            <div
                class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2"
            >
                <CountdownTimer {endTime} class="text-white" />
            </div>
        {/if}
    </div>

    <!-- 정보 -->
    <div class="p-3">
        <h3 class="text-foreground mb-1 truncate text-sm font-medium">
            {post.title}
        </h3>
        <div class="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span>{post.author}</span>
            {#if post.comments_count > 0}
                <span>·</span>
                <span>댓글 {post.comments_count}</span>
            {/if}
        </div>
    </div>
</div>
