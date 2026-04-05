<script lang="ts">
    import { page } from '$app/stores';
    import { onMount } from 'svelte';

    interface RecentPage {
        path: string;
        title: string;
        updated_at: string;
    }

    let recentPages: RecentPage[] = $state([]);
    let isLoading = $state(true);

    onMount(async () => {
        try {
            const res = await fetch('/api/wiki/recent?limit=5');
            if (res.ok) {
                recentPages = await res.json();
            }
        } catch (err) {
            console.error('Failed to load recent pages:', err);
        } finally {
            isLoading = false;
        }
    });

    function isActive(href: string): boolean {
        const pathname = $page.url.pathname;
        return pathname === href || (href !== '/' && pathname.startsWith(href));
    }

    function formatRelativeTime(dateStr: string): string {
        const now = new Date();
        const then = new Date(dateStr);
        const diffMs = now.getTime() - then.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return '방금 전';
        if (diffMins < 60) return `${diffMins}분 전`;
        if (diffHours < 24) return `${diffHours}시간 전`;
        if (diffDays < 7) return `${diffDays}일 전`;
        return then.toLocaleDateString('ko-KR');
    }
</script>

<aside class="w-52 flex-shrink-0">
    <nav class="sticky top-20 space-y-6">
        <!-- Main Navigation -->
        <div>
            <h3
                class="text-muted-foreground mb-2 px-3 text-xs font-semibold uppercase tracking-wider"
            >
                둘러보기
            </h3>
            <ul class="space-y-1">
                <li>
                    <a
                        href="/"
                        class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm {isActive('/') ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}"
                    >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                            />
                        </svg>
                        대문
                    </a>
                </li>
                <li>
                    <a
                        href="/wiki/Special:RecentChanges"
                        class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm {isActive('/wiki/Special:RecentChanges') ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}"
                    >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        최근 변경
                    </a>
                </li>
                <li>
                    <a
                        href="/wiki/Special:Random"
                        class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm {isActive('/wiki/Special:Random') ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}"
                    >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                        임의 문서
                    </a>
                </li>
            </ul>
        </div>

        <!-- Recent Changes (Dynamic) -->
        <div>
            <h3
                class="text-muted-foreground mb-2 px-3 text-xs font-semibold uppercase tracking-wider"
            >
                최근 문서
            </h3>
            {#if isLoading}
                <p class="text-muted-foreground px-3 text-xs">불러오는 중...</p>
            {:else if recentPages.length > 0}
                <ul class="space-y-1">
                    {#each recentPages as recentPage}
                        <li>
                            <a
                                href="/wiki{recentPage.path}"
                                class="group flex flex-col rounded-lg px-3 py-1.5 text-sm {isActive(`/wiki${recentPage.path}`) ? 'bg-primary/10' : 'hover:bg-muted'}"
                            >
                                <span class="{isActive(`/wiki${recentPage.path}`) ? 'text-primary font-medium' : 'text-foreground'} truncate">{recentPage.title}</span>
                                <span class="text-muted-foreground text-xs">{formatRelativeTime(recentPage.updated_at)}</span>
                            </a>
                        </li>
                    {/each}
                </ul>
            {:else}
                <p class="text-muted-foreground px-3 text-xs">최근 변경된 문서가 없습니다.</p>
            {/if}
        </div>

        <!-- Tools -->
        <div>
            <h3
                class="text-muted-foreground mb-2 px-3 text-xs font-semibold uppercase tracking-wider"
            >
                도구
            </h3>
            <ul class="space-y-1">
                <li>
                    <a
                        href="/wiki/Special:AllPages"
                        class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm {isActive('/wiki/Special:AllPages') ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}"
                    >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                            />
                        </svg>
                        모든 문서
                    </a>
                </li>
                <li>
                    <a
                        href="/wiki/Help:Contents"
                        class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm {isActive('/wiki/Help:Contents') ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}"
                    >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                        </svg>
                        도움말
                    </a>
                </li>
            </ul>
        </div>

        <!-- Community -->
        <div>
            <h3
                class="text-muted-foreground mb-2 px-3 text-xs font-semibold uppercase tracking-wider"
            >
                커뮤니티
            </h3>
            <ul class="space-y-1">
                <li>
                    <a
                        href="/wiki/Wikiang:Portal"
                        class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm {isActive('/wiki/Wikiang:Portal') ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-muted'}"
                    >
                        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                stroke-width="2"
                                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                        </svg>
                        사용자 모임
                    </a>
                </li>
            </ul>
        </div>
    </nav>
</aside>
