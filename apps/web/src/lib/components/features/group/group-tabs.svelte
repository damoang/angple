<script lang="ts">
    import { onMount } from 'svelte';
    import type { GroupTabsData, GroupTabId } from '$lib/api/types.js';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import { GroupHeader } from './components/header';
    import { GroupTabs } from './components/tabs';
    import { GroupPostList } from './components/post-list';

    let activeTab = $state<GroupTabId>('all');
    let data = $state<GroupTabsData | null>(null);
    let loading = $state(true);
    let error = $state<string | null>(null);

    // 탭별 포스트 필터링
    const currentPosts = $derived(data ? data[activeTab] || [] : []);

    async function loadData() {
        loading = true;
        error = null;
        try {
            const response = await fetch('/api/v2/recommended/index-widgets');
            if (!response.ok) throw new Error('데이터 로드 실패');

            const jsonData = await response.json();
            data = jsonData.group_tabs;
        } catch (err) {
            error = err instanceof Error ? err.message : '데이터 로드 실패';
            console.error('소모임 추천글 로드 실패:', err);
        } finally {
            loading = false;
        }
    }

    function handleTabChange(tabId: GroupTabId) {
        activeTab = tabId;
    }

    onMount(() => {
        loadData();
    });
</script>

<Card class="gap-0">
    <CardHeader class="flex flex-row items-center justify-between space-y-0 px-4 py-2.5">
        <GroupHeader />
        <div class="flex items-center gap-2">
            <GroupTabs bind:activeTab onTabChange={handleTabChange} />
            <a
                href="/bbs/group.php?gr_id=group"
                rel="external"
                class="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm transition-all duration-200 ease-out"
            >
                더보기
                <ChevronRight class="h-4 w-4" />
            </a>
        </div>
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
        {:else if data}
            <GroupPostList posts={currentPosts} />
        {/if}
    </CardContent>
</Card>
