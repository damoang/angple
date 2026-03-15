<script lang="ts">
    import { goto, invalidate } from '$app/navigation';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Popover, PopoverContent, PopoverTrigger } from '$lib/components/ui/popover/index.js';
    import NotepadText from '@lucide/svelte/icons/notepad-text';
    import Pencil from '@lucide/svelte/icons/pencil';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import ChevronLeft from '@lucide/svelte/icons/chevron-left';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import Info from '@lucide/svelte/icons/info';
    import { pluginStore } from '$lib/stores/plugin.svelte';
    import { loadPluginLib } from '$lib/utils/plugin-optional-loader';
    import type { PageData } from './$types.js';

    const COLOR_STYLES: Record<string, { bg: string; text: string }> = {
        yellow: { bg: '#ffe69c', text: '#664d03' },
        green: { bg: '#d1e7dd', text: '#0f5132' },
        purple: { bg: '#e2d9f3', text: '#432874' },
        red: { bg: '#f8d7da', text: '#dc3545' },
        blue: { bg: '#cfe2ff', text: '#084298' }
    };

    let { data }: { data: PageData } = $props();

    let deletingId = $state<string | null>(null);

    // memo-store 동적 로드
    type MemoStoreModule = {
        openModal: (memberId: string) => void;
        getModalTarget: () => string | null;
    };
    type MemoApiModule = {
        deleteMemo: (targetMemberId: string) => Promise<void>;
    };

    let memoStore = $state<MemoStoreModule | null>(null);
    let memoApi = $state<MemoApiModule | null>(null);

    $effect(() => {
        if (pluginStore.isPluginActive('member-memo')) {
            loadPluginLib<MemoStoreModule>('member-memo', 'memo-store').then((m) => {
                if (m) memoStore = m;
            });
            loadPluginLib<MemoApiModule>('member-memo', 'memo-api').then((m) => {
                if (m) memoApi = m;
            });
        }
    });

    // 모달 닫힘 감지 → 목록 갱신
    let wasOpen = $state(false);
    $effect(() => {
        const target = memoStore?.getModalTarget?.();
        if (target === null && wasOpen) {
            invalidate('app:memos');
        }
        wasOpen = target !== null;
    });

    function handleEdit(targetMemberId: string) {
        if (memoStore) {
            memoStore.openModal(targetMemberId);
        } else {
            goto(`/member/${targetMemberId}`);
        }
    }

    async function handleDelete(targetMemberId: string) {
        if (!confirm('이 회원의 메모를 삭제하시겠습니까?')) return;

        deletingId = targetMemberId;
        try {
            if (memoApi) {
                await memoApi.deleteMemo(targetMemberId);
            } else {
                const res = await fetch(
                    `/api/v1/members/${encodeURIComponent(targetMemberId)}/memo`,
                    {
                        method: 'DELETE',
                        credentials: 'include'
                    }
                );
                if (!res.ok) throw new Error('삭제 실패');
            }
            await invalidate('app:memos');
        } catch (err) {
            console.error('메모 삭제 실패:', err);
        } finally {
            deletingId = null;
        }
    }

    function formatDate(dateStr: string | null): string {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function goToPage(pageNum: number): void {
        goto(`/my/memos?page=${pageNum}`);
    }

    function getPageNumbers(current: number, total: number): (number | '...')[] {
        if (total <= 5) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }
        const pages: (number | '...')[] = [];
        if (current <= 3) {
            for (let i = 1; i <= 4; i++) pages.push(i);
            pages.push('...');
            pages.push(total);
        } else if (current >= total - 2) {
            pages.push(1);
            pages.push('...');
            for (let i = total - 3; i <= total; i++) pages.push(i);
        } else {
            pages.push(1);
            pages.push('...');
            for (let i = current - 1; i <= current + 1; i++) pages.push(i);
            pages.push('...');
            pages.push(total);
        }
        return pages;
    }

    function getColorStyle(color: string): { bg: string; text: string } {
        return COLOR_STYLES[color] ?? COLOR_STYLES.yellow;
    }
</script>

<svelte:head>
    <title>회원 메모 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4">
    <!-- 헤더 -->
    <div class="mb-6">
        <h1 class="text-foreground text-2xl font-bold">회원 메모</h1>
        <p class="text-muted-foreground mt-1 text-sm">
            다른 회원에 대해 작성한 개인 메모 {data.total}건
        </p>
    </div>

    <!-- 요약 카드 -->
    <div class="mb-6">
        <Card class="bg-primary/5 border-primary/20">
            <CardContent class="pt-6">
                <div class="flex items-center gap-3">
                    <div class="bg-primary/10 rounded-full p-3">
                        <NotepadText class="text-primary h-6 w-6" />
                    </div>
                    <div>
                        <p class="text-muted-foreground text-sm">메모 수</p>
                        <p class="text-foreground text-2xl font-bold">
                            {data.total.toLocaleString()}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>

    <!-- 메모 목록 -->
    <Card class="bg-background">
        <CardHeader>
            <CardTitle class="flex items-center gap-2">
                <NotepadText class="h-5 w-5" />
                메모 목록
                <span class="text-muted-foreground text-sm font-normal">
                    ({data.total}건)
                </span>
            </CardTitle>
        </CardHeader>
        <CardContent>
            {#if data.memos.length > 0}
                <ul class="divide-border divide-y">
                    {#each data.memos as memo (memo.id)}
                        {@const isDeleting = deletingId === memo.target_member_id}
                        {@const colorStyle = getColorStyle(memo.color)}
                        <li
                            class="py-3 transition-opacity first:pt-0 last:pb-0"
                            class:opacity-50={isDeleting}
                        >
                            <div class="flex items-start gap-4">
                                <div class="min-w-0 flex-1">
                                    <!-- 대상 회원 -->
                                    <div class="mb-1 flex items-center gap-2">
                                        <a
                                            href="/member/{memo.target_member_id}"
                                            class="text-foreground text-sm font-medium hover:underline"
                                        >
                                            {memo.target_mb_nick}
                                        </a>
                                        <span class="text-muted-foreground text-xs">
                                            @{memo.target_member_id}
                                        </span>
                                    </div>

                                    <!-- 메모 내용 (Popover for memo_detail) -->
                                    {#if memo.memo_detail}
                                        <Popover>
                                            <PopoverTrigger class="cursor-pointer text-left">
                                                <span
                                                    class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-sm"
                                                    style="background-color: {colorStyle.bg}; color: {colorStyle.text};"
                                                >
                                                    {memo.memo}
                                                    <Info class="h-3 w-3 opacity-60" />
                                                </span>
                                            </PopoverTrigger>
                                            <PopoverContent class="max-w-xs">
                                                <p
                                                    class="text-muted-foreground whitespace-pre-wrap text-xs"
                                                >
                                                    {memo.memo_detail}
                                                </p>
                                            </PopoverContent>
                                        </Popover>
                                    {:else}
                                        <span
                                            class="inline-block rounded px-2 py-0.5 text-sm"
                                            style="background-color: {colorStyle.bg}; color: {colorStyle.text};"
                                        >
                                            {memo.memo}
                                        </span>
                                    {/if}

                                    <!-- 날짜 -->
                                    <div class="text-muted-foreground mt-1 text-xs">
                                        {formatDate(memo.updated_at || memo.created_at)}
                                    </div>
                                </div>

                                <!-- 액션 버튼 -->
                                <div class="flex shrink-0 gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        class="text-muted-foreground hover:text-foreground h-8 w-8"
                                        onclick={() => handleEdit(memo.target_member_id)}
                                        disabled={isDeleting}
                                        aria-label="메모 수정"
                                    >
                                        <Pencil class="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        class="text-muted-foreground hover:text-destructive h-8 w-8"
                                        onclick={() => handleDelete(memo.target_member_id)}
                                        disabled={isDeleting}
                                        aria-label="메모 삭제"
                                    >
                                        <Trash2 class="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </li>
                    {/each}
                </ul>
            {:else}
                <div class="flex flex-col items-center justify-center py-12">
                    <div class="bg-muted mb-4 rounded-full p-4">
                        <NotepadText class="text-muted-foreground h-8 w-8" />
                    </div>
                    <p class="text-foreground mb-1 font-medium">아직 작성한 메모가 없어요</p>
                    <p class="text-muted-foreground text-sm">
                        다른 회원의 프로필에서 메모를 작성해보세요.
                    </p>
                </div>
            {/if}
        </CardContent>
    </Card>

    <!-- 페이지네이션 -->
    {#if data.totalPages > 1}
        <div class="mt-6 flex items-center justify-center gap-1">
            <Button
                variant="outline"
                size="sm"
                disabled={data.page === 1}
                onclick={() => goToPage(data.page - 1)}
            >
                <ChevronLeft class="h-4 w-4" />
                이전
            </Button>

            {#each getPageNumbers(data.page, data.totalPages) as pageNum}
                {#if pageNum === '...'}
                    <span class="text-muted-foreground px-2 text-sm">...</span>
                {:else}
                    <Button
                        variant={data.page === pageNum ? 'default' : 'outline'}
                        size="sm"
                        class="min-w-9"
                        onclick={() => goToPage(pageNum)}
                    >
                        {pageNum}
                    </Button>
                {/if}
            {/each}

            <Button
                variant="outline"
                size="sm"
                disabled={data.page === data.totalPages}
                onclick={() => goToPage(data.page + 1)}
            >
                다음
                <ChevronRight class="h-4 w-4" />
            </Button>
        </div>
    {/if}
</div>
