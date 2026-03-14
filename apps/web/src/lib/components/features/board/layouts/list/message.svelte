<script lang="ts">
    /**
     * 축하 메시지 게시판 레이아웃 — Soft Parchment Card
     *
     * 회원 축하/기념 게시글을 카드 형태로 표시합니다.
     * - 왼쪽 accent border (회원 아이디 기반 dusty 팔레트)
     * - 이미지 aspect-[2/1] inset
     * - 하단 메타: 아바타 + 닉네임 + 날짜
     */
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
    import Heart from '@lucide/svelte/icons/heart';
    import { getAvatarUrl } from '$lib/utils/member-icon.js';
    import AuthorLink from '$lib/components/ui/author-link/author-link.svelte';
    import { formatDate } from '$lib/utils/format-date.js';
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

    let showIcon = $state(true);
    const iconUrl = $derived(showIcon ? getAvatarUrl(post.author_image) : null);
    const initial = $derived((post.author || '?').charAt(0).toUpperCase());

    const isDeleted = $derived(!!post.deleted_at);

    const thumbnailUrl = $derived(post.thumbnail || post.images?.[0] || '');
    const hasImage = $derived(Boolean(thumbnailUrl));

    // 회원 아이디 기반 accent 색상 (dusty 팔레트)
    const accentColors = [
        'border-l-dusty-300',
        'border-l-dusty-400',
        'border-l-dusty-500',
        'border-l-dusty-600',
        'border-l-dusty-300/70'
    ];

    function getAccentIndex(memberId?: string): number {
        if (!memberId) return 0;
        let hash = 0;
        for (let i = 0; i < memberId.length; i++) {
            hash = (hash << 5) - hash + memberId.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash) % accentColors.length;
    }

    const accent = $derived(accentColors[getAccentIndex(post.author_id)]);
</script>

{#if isDeleted}
    <a
        {href}
        class="border-border bg-background flex h-full cursor-pointer flex-col overflow-hidden rounded-lg border no-underline opacity-50 transition-shadow hover:shadow-md"
    >
        <div class="flex flex-1 items-center justify-center p-4">
            <span class="text-muted-foreground text-sm">[삭제된 게시물입니다]</span>
        </div>
    </a>
{:else}
    <div
        class="border-border bg-background group flex h-full flex-col overflow-hidden rounded-lg border border-l-[3px] shadow-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md {accent}"
        class:opacity-75={isRead}
    >
        <!-- 제목 -->
        <a {href} class="block px-3 pb-1 pt-3">
            <h3 class="text-foreground truncate text-sm font-medium">
                {post.title}
            </h3>
        </a>

        <!-- 이미지 영역 -->
        <a {href} class="block px-3 py-1">
            {#if hasImage}
                <div class="overflow-hidden rounded">
                    <img
                        src={thumbnailUrl}
                        alt={post.title}
                        class="aspect-[6/1] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        loading="lazy"
                    />
                </div>
            {:else}
                <div
                    class="bg-dusty-50 flex aspect-[6/1] w-full items-center justify-center rounded"
                >
                    <Heart class="text-dusty-300 h-8 w-8" />
                </div>
            {/if}
        </a>

        <!-- 하단 메타: 아바타 + 닉네임 + 날짜 -->
        <div class="flex items-center gap-2 px-3 pb-3 pt-1">
            <div
                class="bg-dusty-100 flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full"
            >
                {#if iconUrl}
                    <img
                        src={iconUrl}
                        alt={post.author}
                        class="h-full w-full object-cover"
                        onerror={() => {
                            showIcon = false;
                        }}
                    />
                {:else}
                    <span class="text-dusty-500 text-xs font-medium">{initial}</span>
                {/if}
            </div>
            <span class="text-muted-foreground truncate text-xs">
                <AuthorLink
                    authorId={post.author_id}
                    authorName={post.author || '익명'}
                    isWithdrawn={!!post.is_left}
                />
            </span>
            {#if post.created_at}
                <span class="text-muted-foreground/60 ml-auto shrink-0 text-xs">
                    {formatDate(post.created_at)}
                </span>
            {/if}
        </div>
    </div>
{/if}
