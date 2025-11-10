<script lang="ts">
    import { onMount } from 'svelte';
    import type { EconomyTabId, EconomyPost } from '$lib/api/types.js';
    import { Card, CardContent } from '$lib/components/ui/card';
    import { EconomyTabs } from './components/tabs';
    import { EconomyPostList } from './components/post-list';

    let activeTab = $state<EconomyTabId>('economy');
    let data = $state<EconomyPost[] | null>(null);
    let loading = $state(true);
    let error = $state<string | null>(null);

    // 탭별 포스트 필터링
    const currentPosts = $derived(data ? data.filter((post) => post.tab === activeTab) : []);

    async function loadData() {
        loading = true;
        error = null;
        try {
            const response = await fetch('/data/cache/recommended/index-widgets.json');
            if (!response.ok) throw new Error('데이터 로드 실패');

            const jsonData = await response.json();
            data = jsonData.economy_tabs;
        } catch (err) {
            error = err instanceof Error ? err.message : '데이터 로드 실패';
            console.error('경제 탭 로드 실패:', err);
        } finally {
            loading = false;
        }
    }

    function handleTabChange(tabId: EconomyTabId) {
        activeTab = tabId;
    }

    onMount(() => {
        loadData();
    });
</script>

<Card class="gap-0 border-0 shadow-none">
    <div class="border-b px-3 pb-3 pt-3">
        <EconomyTabs bind:activeTab onTabChange={handleTabChange} />
    </div>

    <CardContent class="px-3">
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
        {:else if data}
            <EconomyPostList posts={currentPosts} />
        {/if}
    </CardContent>
</Card>
