<script lang="ts">
    /**
     * 축하 메시지 게시판 레이아웃
     *
     * 회원 축하/기념 게시글을 카드 형태로 표시합니다.
     * - 그라데이션 헤더 (회원 아이디 기반 일관된 색상)
     * - 레벨 배지 아바타
     * - 배너 이미지 오버레이
     *
     * Design System: "Soft Modern" - 부드러운 카드, 호버 리프트 효과
     */
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
    import Heart from '@lucide/svelte/icons/heart';
    import ExternalLink from '@lucide/svelte/icons/external-link';
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
    import { memberLevelStore } from '$lib/stores/member-levels.svelte.js';

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

    // 회원 아이디 기반 그라데이션 번호 (1-5, 일관된 색상)
    function getGradientNumber(memberId?: string): number {
        if (!memberId) return Math.floor(Math.random() * 5) + 1;
        let hash = 0;
        for (let i = 0; i < memberId.length; i++) {
            hash = (hash << 5) - hash + memberId.charCodeAt(i);
            hash |= 0;
        }
        return (Math.abs(hash) % 5) + 1;
    }

    // 그라데이션 색상 매핑
    const gradients: Record<number, string> = {
        1: 'from-indigo-500 to-purple-600',
        2: 'from-pink-400 to-rose-500',
        3: 'from-cyan-400 to-teal-500',
        4: 'from-emerald-400 to-cyan-500',
        5: 'from-rose-400 to-amber-400'
    };

    const gradNum = $derived(getGradientNumber(post.author_id));
    const grad = $derived(gradients[gradNum]);

    // 외부 링크 추출 (확장 필드 - link1 사용)
    const externalLink = $derived(post.link1);
</script>

<!-- 축하 메시지 카드 -->
{#if isDeleted}
    <div
        class="border-border bg-background flex h-full flex-col overflow-hidden rounded-2xl border opacity-50"
    >
        <div class="flex flex-1 items-center justify-center p-4">
            <span class="text-muted-foreground text-sm">[삭제된 게시물입니다]</span>
        </div>
    </div>
{:else}
    <div
        class="border-border bg-background group flex h-full flex-col overflow-hidden rounded-2xl border shadow-sm transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-lg"
    >
        <!-- 상단 헤더: 그라데이션 + 닉네임 -->
        <div class="flex items-center gap-2 bg-gradient-to-r px-3 py-2 text-white {grad}">
            <Heart class="h-4 w-4" />
            <span class="text-sm font-bold drop-shadow-md">
                {post.author ?? '축하합니다'}
                {post.author ? '님' : ''}
            </span>
            {#if externalLink}
                <a
                    href={externalLink}
                    rel="noopener"
                    class="ml-auto flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs transition-colors hover:bg-white/30"
                    onclick={(e) => e.stopPropagation()}
                >
                    <ExternalLink class="h-3 w-3" />
                    바로가기
                </a>
            {/if}
        </div>

        <!-- 본문: 프로필 + 배너 -->
        <a {href} class="relative flex min-h-[70px] flex-1" data-sveltekit-preload-data="hover">
            <!-- 프로필 레벨 배지 (왼쪽 중앙) -->
            <div class="absolute left-3 top-1/2 z-10 -translate-y-1/2">
                <div
                    class="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/50 bg-gradient-to-br shadow-lg {grad}"
                >
                    <LevelBadge level={memberLevelStore.getLevel(post.author_id)} size="md" />
                </div>
            </div>

            <!-- 배너 이미지 or 텍스트 영역 -->
            {#if hasImage}
                <div class="relative h-full w-full">
                    <img
                        src={thumbnailUrl}
                        alt={post.title}
                        class="h-full min-h-[70px] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        loading="lazy"
                    />
                    <!-- 오버레이 -->
                    <div
                        class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 pl-20"
                    >
                        <p
                            class="line-clamp-2 text-sm font-semibold text-white drop-shadow-md {isRead
                                ? 'opacity-70'
                                : ''}"
                        >
                            {post.title}
                        </p>
                    </div>
                </div>
            {:else}
                <div class="bg-muted flex w-full flex-col justify-center py-4 pl-20 pr-4">
                    <p
                        class="line-clamp-2 text-sm font-semibold {isRead
                            ? 'text-muted-foreground'
                            : 'text-foreground'}"
                    >
                        {post.title}
                    </p>
                </div>
            {/if}
        </a>
    </div>
{/if}
