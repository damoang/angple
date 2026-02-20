<script lang="ts">
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
    import Lock from '@lucide/svelte/icons/lock';
    import type { Component } from 'svelte';
    import { pluginStore } from '$lib/stores/plugin.svelte';
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
    import { memberLevelStore } from '$lib/stores/member-levels.svelte.js';
    import { loadPluginComponent } from '$lib/utils/plugin-optional-loader';
    import { formatDate } from '$lib/utils/format-date.js';

    let memoPluginActive = $derived(pluginStore.isPluginActive('member-memo'));

    // 동적 플러그인 임포트: member-memo
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
        onclick
    }: {
        post: FreePost;
        displaySettings?: BoardDisplaySettings;
        onclick: () => void;
    } = $props();

    // 썸네일 표시 여부
    const showThumbnail = $derived(
        displaySettings?.show_thumbnail && post.images && post.images.length > 0
    );
    const thumbnailUrl = $derived(post.images?.[0] || '');
</script>

<!-- Card 스킨: 제목 + 본문 미리보기 2줄 + 메타데이터 + 태그 -->
<Card
    class="bg-background cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
    {onclick}
>
    <div class="flex {showThumbnail ? 'flex-row' : 'flex-col'}">
        <!-- 썸네일 (있는 경우) -->
        {#if showThumbnail}
            <div class="bg-muted relative h-32 w-32 shrink-0 sm:h-40 sm:w-40">
                <img
                    src={thumbnailUrl}
                    alt=""
                    class="h-full w-full object-cover"
                    onerror={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                    }}
                />
            </div>
        {/if}

        <div class="flex-1">
            <CardHeader>
                <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0 flex-1">
                        <CardTitle class="text-foreground mb-2 flex items-center gap-1.5 truncate">
                            {#if post.is_adult}
                                <Badge
                                    variant="destructive"
                                    class="shrink-0 px-1.5 py-0 text-[10px]">19</Badge
                                >
                            {/if}
                            {#if post.is_secret}
                                <Lock class="text-muted-foreground h-4 w-4 shrink-0" />
                            {/if}
                            {post.title}
                        </CardTitle>
                        <div
                            class="text-secondary-foreground flex flex-wrap items-center gap-2 text-[15px]"
                        >
                            <span>👍 {post.likes}</span>
                            <span>💬 {post.comments_count}</span>
                            <span>•</span>
                            <span class="inline-flex items-center gap-0.5"
                                ><LevelBadge
                                    level={memberLevelStore.getLevel(post.author_id)}
                                    size="sm"
                                />{post.author}</span
                            >
                            {#if memoPluginActive && MemoBadge}
                                <MemoBadge memberId={post.author_id} />
                            {/if}
                            <span>•</span>
                            <span>{formatDate(post.created_at)}</span>
                            <span>•</span>
                            <span>조회 {post.views.toLocaleString()}</span>
                        </div>
                    </div>
                    <div class="flex flex-shrink-0 flex-wrap gap-1.5">
                        {#if post.category}
                            <span
                                class="bg-primary/10 text-primary rounded-md px-2 py-0.5 text-[13px] font-medium"
                            >
                                {post.category}
                            </span>
                        {/if}
                        {#if post.tags && post.tags.length > 0}
                            {#each post.tags.slice(0, 3) as tag (tag)}
                                <Badge variant="secondary" class="rounded-full text-xs">{tag}</Badge
                                >
                            {/each}
                        {/if}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {#if displaySettings?.show_preview !== false}
                    <p class="text-secondary-foreground mb-4 line-clamp-2">
                        {post.content}
                    </p>
                {/if}
            </CardContent>
        </div>
    </div>
</Card>

<style>
    .line-clamp-2 {
        display: -webkit-box;
        line-clamp: 2;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>
