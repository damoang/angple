<script lang="ts">
    import { onMount } from 'svelte';
    import type { GalleryPost } from '$lib/api/types.js';
    import { Card, CardContent } from '$lib/components/ui/card';
    import { GalleryCard } from './components';

    let posts = $state<GalleryPost[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);

    async function loadData() {
        loading = true;
        error = null;
        try {
            const response = await fetch('/data/cache/recommended/index-widgets.json');
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
    <CardContent class="p-3">
        {#if loading}
            <div class="flex items-center justify-center py-8">
                <div class="text-sm text-muted-foreground">로딩 중...</div>
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
            <div class="py-8 text-center text-sm text-muted-foreground">게시물이 없습니다.</div>
        {/if}
    </CardContent>
</Card>
