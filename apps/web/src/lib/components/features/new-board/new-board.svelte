<script lang="ts">
    import type { NewsTabId, NewsPost } from '$lib/api/types.js';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card';
    import Newspaper from '@lucide/svelte/icons/newspaper';
    import { NewsTabs } from './components/tabs';
    import { SimplePostList } from './components/post-list';

    // Props로 데이터 받기 (SSR 지원)
    interface Props {
        posts?: NewsPost[];
    }
    const { posts = [] }: Props = $props();

    let activeTab = $state<NewsTabId>('new');

    // props에서 반응형 데이터 사용
    const currentPosts = $derived(posts.filter((post) => post.tab === activeTab));
    const hasData = $derived(posts.length > 0);

    function handleTabChange(tabId: NewsTabId) {
        activeTab = tabId;
    }
</script>

<Card class="gap-0">
    <CardHeader class="flex flex-row items-center justify-between space-y-0 px-4 py-3">
        <div class="flex items-center gap-2">
            <div
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30"
            >
                <Newspaper class="h-4 w-4 text-blue-500" />
            </div>
            <h3 class="text-foreground text-base font-semibold">새로운 소식</h3>
        </div>
        <NewsTabs bind:activeTab onTabChange={handleTabChange} />
    </CardHeader>

    <CardContent class="px-4">
        {#if !hasData}
            <div class="flex items-center justify-center py-8">
                <div class="text-muted-foreground text-sm">로딩 중...</div>
            </div>
        {:else}
            <SimplePostList posts={currentPosts} />
        {/if}
    </CardContent>
</Card>
