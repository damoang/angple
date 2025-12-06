<script lang="ts">
    import { onMount } from 'svelte';
    import type { GroupTabsData, GroupTabId, GroupPost } from '$lib/api/types.js';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card';
    import { GroupHeader } from './components/header';
    import { GroupTabs } from './components/tabs';
    import { GroupPostList } from './components/post-list';

    let activeTab = $state<GroupTabId>('all');
    let data = $state<GroupTabsData | null>(null);
    let loading = $state(true);
    let error = $state<string | null>(null);

    const groupUrl = '/bbs/group.php?gr_id=group';

    // 탭별 포스트 필터링
    const currentPosts = $derived(data ? data[activeTab] || [] : []);

    async function loadData() {
        loading = true;
        error = null;
        try {
            const response = await fetch('/data/cache/recommended/index-widgets.json');
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
    <CardHeader class="flex-row items-center justify-between space-y-0 border-b pb-3">
        <div class="flex flex-1 items-center justify-between gap-2">
            <GroupHeader />

            <!-- 탭 네비게이션 -->
            <GroupTabs bind:activeTab onTabChange={handleTabChange} />

            <a
                href={groupUrl}
                class="text-muted-foreground hover:text-foreground transition-colors"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    fill="currentColor"
                    viewBox="0 0 16 16"
                >
                    <path
                        d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"
                    />
                </svg>
            </a>
        </div>
    </CardHeader>

    <CardContent class="px-3">
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
