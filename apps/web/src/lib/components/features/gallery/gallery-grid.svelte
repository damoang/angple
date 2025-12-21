<script lang="ts">
    import { onMount } from 'svelte';
    import type { GalleryPost } from '$lib/api/types.js';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card';
    import Images from '@lucide/svelte/icons/images';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import { GalleryCard } from './components';

    let posts = $state<GalleryPost[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    async function loadData() {
        loading = true;
        error = null;
        try {
            const response = await fetch('/api/v2/recommended/index-widgets');
            if (!response.ok) throw new Error('데이터 로드 실패');

            const jsonData = await response.json();
            posts = jsonData.gallery || [];
        } catch (err) {
            error = err instanceof Error ? err.message : '데이터 로드 실패';
            console.error('갤러리 로드 실패:', err);
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        loadData();
    });
</script>

<Card class="gap-0">
    <CardHeader
        class="flex flex-row flex-nowrap items-center justify-between space-y-0 px-4 py-2.5"
    >
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
        {#if loading}
            <div class="flex items-center justify-center py-8">
                <div class="text-muted-foreground text-sm">로딩 중...</div>
            </div>
        {:else if error}
            <div class="flex items-center justify-center py-8">
                <div class="text-center">
                    <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            </div>
        {:else if posts.length > 0}
            <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {#each posts as post, index (`${post.id}-${index}`)}
                    <GalleryCard {post} />
                {/each}
            </div>
        {:else}
            <div class="text-muted-foreground py-8 text-center text-sm">게시물이 없습니다.</div>
        {/if}
    </CardContent>
</Card>
