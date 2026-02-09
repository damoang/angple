<script lang="ts">
    import type { GalleryPost } from '$lib/api/types.js';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card';
    import Images from '@lucide/svelte/icons/images';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import { GalleryCard } from './components';

    // Props로 데이터 받기 (SSR 지원)
    interface Props {
        posts?: GalleryPost[];
    }
    const { posts = [] }: Props = $props();

    const hasData = $derived(posts.length > 0);
</script>

<Card class="gap-0">
    <CardHeader class="flex flex-row flex-nowrap items-center justify-between space-y-0 px-4 py-3">
        <div class="flex items-center gap-2">
            <div
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30"
            >
                <Images class="h-4 w-4 text-purple-500" />
            </div>
            <h3 class="text-foreground text-base font-semibold">갤러리</h3>
        </div>
        <a
            href="/gallery"
            rel="external"
            class="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 text-sm transition-all duration-200 ease-out"
        >
            더보기
            <ChevronRight class="h-4 w-4" />
        </a>
    </CardHeader>

    <CardContent class="px-4">
        {#if hasData}
            <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {#each posts as post, index (`${post.id}-${index}`)}
                    <GalleryCard {post} />
                {/each}
            </div>
        {:else}
            <div class="flex items-center justify-center py-8">
                <div class="text-muted-foreground text-sm">로딩 중...</div>
            </div>
        {/if}
    </CardContent>
</Card>
