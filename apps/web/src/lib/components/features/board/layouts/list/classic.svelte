<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
    import type { Component } from 'svelte';
    import Lock from '@lucide/svelte/icons/lock';
    import ImageIcon from '@lucide/svelte/icons/image';
    import Play from '@lucide/svelte/icons/play';
    import Pin from '@lucide/svelte/icons/pin';
    import { getMemberIconUrl, handleIconError } from '$lib/utils/member-icon.js';
    import { formatDate, isToday } from '$lib/utils/format-date.js';
    import { formatCompactNumber } from '$lib/utils/format-number.js';
    import { pluginStore } from '$lib/stores/plugin.svelte';
    import { loadPluginComponent } from '$lib/utils/plugin-optional-loader';

    // 메모 플러그인
    let memoPluginActive = $derived(pluginStore.isPluginActive('member-memo'));
    let MemoBadge = $state<Component | null>(null);

    $effect(() => {
        if (memoPluginActive) {
            loadPluginComponent('member-memo', 'memo-badge').then((c) => (MemoBadge = c));
        }
    });

    // Props
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

    // 회원 아이콘 URL
    const iconUrl = $derived(getMemberIconUrl(post.author_id));

    // 추천 색상 단계 (0: 거의 투명, 1-4: 뮤트, 5-9: 강조, 10+: 최고)
    const likesStepClass = $derived.by(() => {
        const likes = post.likes;
        if (likes === 0) {
            return 'bg-likes-0 text-[#333] opacity-35';
        } else if (likes <= 4) {
            return 'bg-likes-1 text-foreground/50';
        } else if (likes <= 9) {
            return 'bg-likes-2 text-foreground';
        } else {
            return 'bg-likes-4 text-white font-bold';
        }
    });

    // 삭제된 글
    const isDeleted = $derived(!!post.deleted_at);

    // 새글 (24시간 이내)
    const isNew = $derived.by(() => {
        if (!post.created_at) return false;
        const created = new Date(post.created_at).getTime();
        const now = Date.now();
        return now - created < 24 * 60 * 60 * 1000;
    });

    // 동영상 여부 (extra_9에 유튜브 URL)
    const hasVideo = $derived(!!post.extra_9);

    // 이미지 첨부 여부
    const hasImage = $derived(
        post.has_file || (post.images && post.images.length > 0) || !!post.extra_10
    );

    // 홍보 게시글 여부
    const isPromo = $derived(post.category === '홍보');
</script>

<!-- Classic 스킨: 데스크톱 CSS Grid 5컬럼 (추천|제목|이름|날짜|조회) -->
{#if isDeleted}
    <div class="bg-background px-4 py-1.5 opacity-50">
        <div class="flex items-center gap-2 md:gap-3">
            <div class="hidden shrink-0 md:block">
                <div
                    class="bg-muted text-muted-foreground flex h-7 w-10 items-center justify-center rounded-md text-sm font-semibold"
                >
                    -
                </div>
            </div>
            <div class="min-w-0 flex-1">
                <span class="text-muted-foreground text-sm">[삭제된 게시물입니다]</span>
            </div>
        </div>
    </div>
{:else}
    <a
        {href}
        class="bg-background hover:bg-accent block px-4 py-1.5 no-underline transition-colors"
        class:post-promo={isPromo}
        data-sveltekit-preload-data="hover"
    >
        <div
            class="flex items-center gap-2 md:grid md:grid-cols-[40px_1fr_auto_auto_auto] md:items-center md:gap-0"
        >
            <!-- 추천 박스 (col 1, 데스크톱만) -->
            <div class="hidden md:flex md:items-center md:justify-center">
                {#if post.is_notice}
                    <div class="bg-liked/10 flex h-7 w-10 items-center justify-center rounded-md">
                        <Pin class="text-liked h-4 w-4" />
                    </div>
                {:else}
                    <div
                        class="flex h-7 w-10 items-center justify-center rounded-md text-sm font-semibold {likesStepClass}"
                        class:rec-zero={Number(post.likes) === 0}
                    >
                        {post.likes.toLocaleString()}
                    </div>
                {/if}
            </div>

            <!-- 콘텐츠 (모바일: block, 데스크톱: contents → 그리드 col 2~5 참여) -->
            <div class="min-w-0 flex-1 space-y-0.5 md:contents">
                <!-- 제목 줄 (col 2) -->
                <div class="flex min-w-0 items-center gap-1">
                    {#if post.is_notice}
                        <Pin class="text-liked h-3.5 w-3.5 shrink-0 md:hidden" />
                    {/if}
                    {#if post.is_adult}
                        <Badge variant="destructive" class="shrink-0 px-1 py-0 text-[10px]"
                            >19</Badge
                        >
                    {/if}
                    {#if post.is_secret}
                        <Lock class="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                    {/if}
                    {#if post.category}
                        <span
                            class="bg-primary/10 text-primary shrink-0 rounded px-1.5 py-0 text-xs font-medium"
                        >
                            {post.category}
                        </span>
                    {/if}
                    <span
                        class="truncate text-base {isRead
                            ? 'text-muted-foreground font-normal'
                            : 'text-foreground font-semibold'}"
                    >
                        {post.title}
                    </span>
                    <!-- 부가 아이콘: N, 이미지, 동영상, 댓글 -->
                    {#if isNew}
                        <span class="text-liked shrink-0 text-[10px] font-bold">N</span>
                    {/if}
                    {#if hasVideo}
                        <Play class="text-destructive h-3.5 w-3.5 shrink-0" />
                    {:else if hasImage}
                        <ImageIcon class="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                    {/if}
                    {#if post.comments_count > 0}
                        <span class="text-liked shrink-0 text-[13px] font-semibold"
                            >+{post.comments_count}</span
                        >
                    {/if}
                </div>

                <!-- 이름 (col 3, 데스크톱만) -->
                <span
                    class="text-foreground/70 hidden items-center gap-1 truncate text-sm md:inline-flex md:w-[130px] md:pl-1"
                >
                    {#if iconUrl}
                        <img
                            src={iconUrl}
                            alt=""
                            class="h-5 w-5 shrink-0 rounded-full object-cover"
                            onerror={handleIconError}
                        />
                    {/if}
                    {post.author}
                    {#if memoPluginActive && MemoBadge}
                        <MemoBadge memberId={post.author_id} />
                    {/if}
                </span>

                <!-- 날짜 (col 4, 데스크톱만) -->
                <span
                    class="hidden text-sm md:inline md:w-[70px] md:pl-1 md:text-center {isToday(
                        post.created_at
                    )
                        ? 'text-date-today'
                        : 'text-muted-foreground'}"
                >
                    {formatDate(post.created_at)}
                </span>

                <!-- 조회수 (col 5, 데스크톱만) -->
                <span
                    class="text-foreground/40 hidden text-xs md:inline md:w-[50px] md:pl-1 md:text-center"
                >
                    {formatCompactNumber(post.views)}
                </span>

                <!-- 모바일 메타 -->
                <div class="flex flex-wrap items-center gap-1.5 md:hidden">
                    <span class="text-foreground/70 inline-flex items-center gap-1 text-sm">
                        {#if iconUrl}
                            <img
                                src={iconUrl}
                                alt=""
                                class="h-5 w-5 shrink-0 rounded-full object-cover"
                                onerror={handleIconError}
                            />
                        {/if}
                        {post.author}
                        {#if memoPluginActive && MemoBadge}
                            <MemoBadge memberId={post.author_id} />
                        {/if}
                    </span>
                    <span
                        class="{isToday(post.created_at)
                            ? 'text-date-today'
                            : 'text-muted-foreground'} text-sm"
                    >
                        {formatDate(post.created_at)}
                    </span>
                    <span class="text-muted-foreground text-xs"
                        >조회 {formatCompactNumber(post.views)}</span
                    >
                    {#if post.likes > 0}
                        <span
                            class="inline-flex h-4 items-center rounded px-1 text-[10px] font-semibold {likesStepClass}"
                        >
                            👍 {post.likes}
                        </span>
                    {/if}
                </div>
            </div>
        </div>
    </a>
{/if}

<style>
    .rec-zero {
        color: #333 !important;
        opacity: 0.3 !important;
    }

    .post-promo {
        background: rgba(251, 146, 60, 0.05) !important;
        border-left: 3px solid rgba(251, 146, 60, 0.35) !important;
    }
</style>
