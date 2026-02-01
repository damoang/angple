<script lang="ts">
    /**
     * 관리자 삭제 게시물 관리 페이지
     * 소프트 삭제된 게시물의 복구 및 영구 삭제 관리
     */
    import { onMount } from 'svelte';
    import * as Card from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
    import AlertTriangle from '@lucide/svelte/icons/alert-triangle';
    import ChevronLeft from '@lucide/svelte/icons/chevron-left';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';

    interface DeletedPost {
        id: number;
        title: string;
        author: string;
        board_id: string;
        deleted_at: string;
        deleted_by?: string;
        views: number;
        comments_count: number;
    }

    const API_BASE = import.meta.env.VITE_WEB_URL || 'http://localhost:5173';

    let posts = $state<DeletedPost[]>([]);
    let loading = $state(true);
    let page = $state(1);
    let totalPages = $state(1);
    let total = $state(0);
    let actionLoading = $state<Record<number, string>>({});

    async function fetchDeletedPosts() {
        loading = true;
        try {
            const res = await fetch(`${API_BASE}/api/plugins/deleted-posts?page=${page}&limit=20`);
            if (!res.ok) {
                // Mock 데이터
                posts = [];
                total = 0;
                totalPages = 1;
                return;
            }
            const data = await res.json();
            posts = data.items ?? [];
            total = data.total ?? 0;
            totalPages = data.total_pages ?? 1;
        } catch {
            posts = [];
        } finally {
            loading = false;
        }
    }

    async function restorePost(postId: number) {
        actionLoading = { ...actionLoading, [postId]: 'restore' };
        try {
            await fetch(`${API_BASE}/api/plugins/deleted-posts/${postId}/restore`, {
                method: 'POST'
            });
            posts = posts.filter((p) => p.id !== postId);
            total = Math.max(0, total - 1);
        } catch (err) {
            console.error('복구 실패:', err);
        } finally {
            const { [postId]: _, ...rest } = actionLoading;
            actionLoading = rest;
        }
    }

    async function permanentDelete(postId: number) {
        if (!confirm('정말 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
        actionLoading = { ...actionLoading, [postId]: 'delete' };
        try {
            await fetch(`${API_BASE}/api/plugins/deleted-posts/${postId}/permanent`, {
                method: 'DELETE'
            });
            posts = posts.filter((p) => p.id !== postId);
            total = Math.max(0, total - 1);
        } catch (err) {
            console.error('영구 삭제 실패:', err);
        } finally {
            const { [postId]: _, ...rest } = actionLoading;
            actionLoading = rest;
        }
    }

    function formatDate(dateStr: string): string {
        return new Date(dateStr).toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    onMount(() => {
        fetchDeletedPosts();
    });

    $effect(() => {
        // page 변경 시 재조회
        void page;
        fetchDeletedPosts();
    });
</script>

<svelte:head>
    <title>삭제된 게시물 관리 - Angple Admin</title>
</svelte:head>

<div class="mx-auto max-w-5xl space-y-6 p-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-2xl font-bold">삭제된 게시물 관리</h1>
            <p class="text-muted-foreground text-sm">
                소프트 삭제된 게시물을 복구하거나 영구 삭제합니다. (총 {total}건)
            </p>
        </div>
    </div>

    {#if loading}
        <div class="flex items-center justify-center py-12">
            <p class="text-muted-foreground text-sm">로딩 중...</p>
        </div>
    {:else if posts.length === 0}
        <Card.Root>
            <Card.Content class="flex flex-col items-center justify-center py-12">
                <AlertTriangle class="text-muted-foreground mb-4 h-12 w-12" />
                <p class="text-muted-foreground text-sm">삭제된 게시물이 없습니다.</p>
            </Card.Content>
        </Card.Root>
    {:else}
        <div class="space-y-3">
            {#each posts as post (post.id)}
                {@const isProcessing = actionLoading[post.id]}
                <Card.Root class="transition-opacity {isProcessing ? 'opacity-50' : ''}">
                    <Card.Content class="flex items-center gap-4 p-4">
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2">
                                <span class="truncate font-medium">{post.title}</span>
                                <Badge variant="outline" class="shrink-0 text-xs">
                                    {post.board_id}
                                </Badge>
                            </div>
                            <div class="text-muted-foreground mt-1 flex gap-3 text-xs">
                                <span>작성자: {post.author}</span>
                                <span>조회 {post.views}</span>
                                <span>댓글 {post.comments_count}</span>
                                <span>삭제: {formatDate(post.deleted_at)}</span>
                                {#if post.deleted_by}
                                    <span>삭제자: {post.deleted_by}</span>
                                {/if}
                            </div>
                        </div>
                        <div class="flex shrink-0 gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onclick={() => restorePost(post.id)}
                                disabled={!!isProcessing}
                            >
                                <RotateCcw class="mr-1.5 h-3.5 w-3.5" />
                                복구
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                onclick={() => permanentDelete(post.id)}
                                disabled={!!isProcessing}
                            >
                                <Trash2 class="mr-1.5 h-3.5 w-3.5" />
                                영구 삭제
                            </Button>
                        </div>
                    </Card.Content>
                </Card.Root>
            {/each}
        </div>

        {#if totalPages > 1}
            <div class="flex items-center justify-center gap-2">
                <Button
                    variant="outline"
                    size="icon"
                    onclick={() => (page = Math.max(1, page - 1))}
                    disabled={page <= 1}
                >
                    <ChevronLeft class="h-4 w-4" />
                </Button>
                <span class="text-muted-foreground text-sm">
                    {page} / {totalPages}
                </span>
                <Button
                    variant="outline"
                    size="icon"
                    onclick={() => (page = Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                >
                    <ChevronRight class="h-4 w-4" />
                </Button>
            </div>
        {/if}
    {/if}
</div>
