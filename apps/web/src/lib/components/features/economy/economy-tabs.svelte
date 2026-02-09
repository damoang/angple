<script lang="ts">
    import type { EconomyTabId, EconomyPost } from '$lib/api/types.js';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card';
    import ShoppingCart from '@lucide/svelte/icons/shopping-cart';
    import { EconomyTabs } from './components/tabs';
    import { EconomyPostList } from './components/post-list';

    // Props로 데이터 받기 (SSR 지원)
    interface Props {
        posts?: EconomyPost[];
    }
    const { posts = [] }: Props = $props();

    let activeTab = $state<EconomyTabId>('economy');

    // props에서 반응형 데이터 사용
    const currentPosts = $derived(posts.filter((post) => post.tab === activeTab));
    const hasData = $derived(posts.length > 0);

    function handleTabChange(tabId: EconomyTabId) {
        activeTab = tabId;
    }
</script>

<Card class="gap-0">
    <CardHeader class="flex flex-row items-center justify-between space-y-0 px-4 py-3">
        <div class="flex items-center gap-2">
            <div
                class="flex h-7 w-7 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30"
            >
                <ShoppingCart class="h-4 w-4 text-green-500" />
            </div>
            <h3 class="text-foreground text-base font-semibold">알뜰구매</h3>
        </div>
        <EconomyTabs bind:activeTab onTabChange={handleTabChange} />
    </CardHeader>

    <CardContent class="px-4">
        {#if !hasData}
            <div class="flex items-center justify-center py-8">
                <div class="text-muted-foreground text-sm">로딩 중...</div>
            </div>
        {:else}
            <EconomyPostList posts={currentPosts} />
        {/if}
    </CardContent>
</Card>
