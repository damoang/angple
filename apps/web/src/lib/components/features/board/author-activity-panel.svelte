<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import type { FreePost } from '$lib/api/types.js';
    import { Card, CardHeader, CardContent } from '$lib/components/ui/card/index.js';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import ExternalLink from '@lucide/svelte/icons/external-link';

    interface RecentPost {
        bo_table: string;
        bo_subject: string;
        wr_id: number;
        wr_subject: string;
        wr_datetime: string;
        href: string;
    }

    interface RecentComment {
        bo_table: string;
        bo_subject: string;
        wr_id: number;
        parent_wr_id: number;
        preview: string;
        wr_datetime: string;
        href: string;
    }

    interface Props {
        post: FreePost;
    }

    let { post }: Props = $props();

    let loading = $state(true);
    let recentPosts = $state<RecentPost[]>([]);
    let recentComments = $state<RecentComment[]>([]);

    function formatDate(dateStr: string): string {
        const date = new Date(dateStr);
        const now = new Date();
        const isToday =
            date.getFullYear() === now.getFullYear() &&
            date.getMonth() === now.getMonth() &&
            date.getDate() === now.getDate();
        const isThisYear = date.getFullYear() === now.getFullYear();

        if (isToday) {
            return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
        } else if (isThisYear) {
            return `${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
        } else {
            return `${String(date.getFullYear()).slice(2)}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
        }
    }

    onMount(async () => {
        if (!browser || !post.author_id) {
            loading = false;
            return;
        }
        try {
            const res = await fetch(`/api/members/${post.author_id}/activity?limit=5`);
            if (res.ok) {
                const data = await res.json();
                recentPosts = data.recentPosts ?? [];
                recentComments = data.recentComments ?? [];
            }
        } catch {
            // 실패 시 조용히 처리
        } finally {
            loading = false;
        }
    });
</script>

{#if post.author_id}
    <div class="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <!-- 광고 영역 (GAM) -->
        <Card class="flex min-h-[160px] items-center justify-center bg-muted/30">
            <CardContent class="p-4 text-center">
                <!-- GAM ad slot -->
                <p class="text-xs text-muted-foreground">광고</p>
            </CardContent>
        </Card>

        <!-- 최근 글 -->
        <Card>
            <CardHeader class="pb-2 pt-3 px-4">
                <h4 class="text-sm font-semibold text-foreground">작성자 최근 글</h4>
            </CardHeader>
            <CardContent class="px-4 pb-3 pt-0">
                {#if loading}
                    <div class="flex justify-center py-4">
                        <Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                {:else if recentPosts.length === 0}
                    <p class="text-xs text-muted-foreground py-2">자료 없음</p>
                {:else}
                    <ul class="divide-y divide-border">
                        {#each recentPosts as p (p.wr_id)}
                            <li class="py-1.5">
                                <a
                                    href={p.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="group flex items-start gap-1"
                                >
                                    <span class="flex-1 min-w-0">
                                        <span class="block truncate text-xs text-foreground group-hover:text-primary">
                                            {p.wr_subject || '(제목 없음)'}
                                        </span>
                                        <span class="text-[10px] text-muted-foreground">
                                            [{p.bo_subject}] · {formatDate(p.wr_datetime)}
                                        </span>
                                    </span>
                                    <ExternalLink class="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                </a>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </CardContent>
        </Card>

        <!-- 최근 댓글 -->
        <Card>
            <CardHeader class="pb-2 pt-3 px-4">
                <h4 class="text-sm font-semibold text-foreground">작성자 최근 댓글</h4>
            </CardHeader>
            <CardContent class="px-4 pb-3 pt-0">
                {#if loading}
                    <div class="flex justify-center py-4">
                        <Loader2 class="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                {:else if recentComments.length === 0}
                    <p class="text-xs text-muted-foreground py-2">자료 없음</p>
                {:else}
                    <ul class="divide-y divide-border">
                        {#each recentComments as c (c.wr_id)}
                            <li class="py-1.5">
                                <a
                                    href={c.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="group flex items-start gap-1"
                                >
                                    <span class="flex-1 min-w-0">
                                        <span class="block truncate text-xs text-foreground group-hover:text-primary">
                                            {c.preview || '(내용 없음)'}
                                        </span>
                                        <span class="text-[10px] text-muted-foreground">
                                            [{c.bo_subject}] · {formatDate(c.wr_datetime)}
                                        </span>
                                    </span>
                                    <ExternalLink class="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                </a>
                            </li>
                        {/each}
                    </ul>
                {/if}
            </CardContent>
        </Card>
    </div>
{/if}
