<script lang="ts">
    import type { GroupTabId, GroupTabsData } from '$lib/api/types.js';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import { GroupHeader } from './components/header';
    import { GroupTabs } from './components/tabs';
    import { GroupPostList } from './components/post-list';

    // Props로 데이터 받기 (SSR 지원)
    interface Props {
        data?: GroupTabsData | null;
    }
    const { data = null }: Props = $props();

    let activeTab = $state<GroupTabId>('all');

    // props에서 반응형 데이터 사용
    const currentPosts = $derived(data ? data[activeTab] || [] : []);
    const hasData = $derived(data !== null);

    function handleTabChange(tabId: GroupTabId) {
        activeTab = tabId;
    }
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
        {#if !hasData}
            <div class="flex items-center justify-center py-8">
                <div class="text-muted-foreground text-sm">로딩 중...</div>
            </div>
        {:else}
            <GroupPostList posts={currentPosts} />
        {/if}
    </CardContent>
</Card>
