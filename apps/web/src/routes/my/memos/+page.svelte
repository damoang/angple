<script lang="ts">
    /**
     * 내 회원 메모 목록 페이지
     * 내가 다른 회원에 대해 남긴 메모를 모아보는 페이지
     */
    import { goto, invalidate } from '$app/navigation';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import NotepadText from '@lucide/svelte/icons/notepad-text';
    import Pencil from '@lucide/svelte/icons/pencil';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import LogOut from '@lucide/svelte/icons/log-out';
    import ChevronLeft from '@lucide/svelte/icons/chevron-left';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import { deleteMemberMemo } from '$lib/api/admin-members.js';
    import { getGradeName } from '$lib/utils/grade.js';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    let deletingId = $state<number | null>(null);

    const memoColorMap: Record<string, { bg: string; text: string }> = {
        yellow: { bg: '#ffe69c', text: '#664d03' },
        green: { bg: '#d1e7dd', text: '#0f5132' },
        purple: { bg: '#e2d9f3', text: '#432874' },
        red: { bg: '#f8d7da', text: '#dc3545' },
        blue: { bg: '#cfe2ff', text: '#084298' }
    };

    async function handleDelete(memoId: number) {
        if (!confirm('이 메모를 삭제하시겠습니까?')) return;
        deletingId = memoId;
        try {
            await deleteMemberMemo(memoId);
            await invalidate('app:memos');
        } catch (err) {
            console.error('메모 삭제 실패:', err);
        } finally {
            deletingId = null;
        }
    }

    function formatDate(dateStr: string): string {
        return new Date(dateStr).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function goToPage(pageNum: number): void {
        if (pageNum < 1 || pageNum > data.totalPages) return;
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
</script>

<svelte:head>
    <title>내 회원 메모 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-4">
    <div class="mb-6">
        <h1 class="text-foreground text-2xl font-bold">내 회원 메모</h1>
        <p class="text-muted-foreground mt-1 text-sm">
            다른 회원에 대해 남긴 메모 {data.total}건
        </p>
    </div>

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
                <!-- Desktop table -->
                <div class="hidden overflow-x-auto md:block">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="bg-muted/50 border-b">
                                <th class="p-3 text-left font-medium">닉네임</th>
                                <th class="p-3 text-left font-medium">아이디</th>
                                <th class="p-3 text-center font-medium">등급</th>
                                <th class="p-3 text-left font-medium">메모</th>
                                <th class="w-24 p-3 text-center font-medium">관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each data.memos as memo (memo.id)}
                                {@const colors = memoColorMap[memo.color] || memoColorMap.yellow}
                                {@const isDeleting = deletingId === memo.id}
                                <tr
                                    class="border-b transition-opacity"
                                    class:opacity-50={isDeleting}
                                >
                                    <td class="p-3">
                                        <a
                                            href="/member/{memo.target_member_id}"
                                            class="text-foreground font-medium hover:underline"
                                        >
                                            {memo.target_member_nickname}
                                        </a>
                                    </td>
                                    <td class="text-muted-foreground p-3">
                                        {memo.target_member_id}
                                    </td>
                                    <td class="p-3 text-center">
                                        <a
                                            href="/disciplinelog?sfl=wr_subject%7C%7Cwr_content%2C1&sop=and&stx={encodeURIComponent(
                                                memo.target_member_id
                                            )}"
                                            target="_blank"
                                            title="{memo.target_member_nickname}님 이용제한 이력 조회"
                                        >
                                            {#if memo.target_member_left}
                                                <LogOut class="mx-auto h-4 w-4 opacity-50" />
                                            {:else}
                                                <Badge variant="outline"
                                                    >{getGradeName(memo.target_member_level)}</Badge
                                                >
                                            {/if}
                                        </a>
                                    </td>
                                    <td class="p-3">
                                        <span
                                            class="inline-block max-w-xs truncate rounded px-2 py-0.5 text-sm"
                                            style="background-color: {colors.bg}; color: {colors.text}"
                                            title={memo.memo_detail || memo.memo}
                                        >
                                            {memo.memo}
                                        </span>
                                    </td>
                                    <td class="p-3 text-center">
                                        <div class="flex items-center justify-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                class="h-8 w-8"
                                                onclick={() =>
                                                    goto(`/member/${memo.target_member_id}`)}
                                                aria-label="수정"
                                            >
                                                <Pencil class="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                class="text-muted-foreground hover:text-destructive h-8 w-8"
                                                onclick={() => handleDelete(memo.id)}
                                                disabled={isDeleting}
                                                aria-label="삭제"
                                            >
                                                <Trash2 class="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

                <!-- Mobile cards -->
                <div class="space-y-3 md:hidden">
                    {#each data.memos as memo (memo.id)}
                        {@const colors = memoColorMap[memo.color] || memoColorMap.yellow}
                        {@const isDeleting = deletingId === memo.id}
                        <div
                            class="rounded-lg border p-4 transition-opacity"
                            class:opacity-50={isDeleting}
                        >
                            <div class="mb-2 flex items-center justify-between">
                                <a
                                    href="/member/{memo.target_member_id}"
                                    class="text-foreground font-medium hover:underline"
                                >
                                    {memo.target_member_nickname}
                                </a>
                                <a
                                    href="/disciplinelog?sfl=wr_subject%7C%7Cwr_content%2C1&sop=and&stx={encodeURIComponent(
                                        memo.target_member_id
                                    )}"
                                    target="_blank"
                                    title="{memo.target_member_nickname}님 이용제한 이력 조회"
                                >
                                    {#if memo.target_member_left}
                                        <LogOut class="h-4 w-4 opacity-50" />
                                    {:else}
                                        <Badge variant="outline"
                                            >{getGradeName(memo.target_member_level)}</Badge
                                        >
                                    {/if}
                                </a>
                            </div>
                            <div class="text-muted-foreground mb-2 text-sm">
                                {memo.target_member_id} · {formatDate(memo.created_at)}
                            </div>
                            <div class="mb-3">
                                <span
                                    class="inline-block rounded px-2 py-0.5 text-sm"
                                    style="background-color: {colors.bg}; color: {colors.text}"
                                >
                                    {memo.memo}
                                </span>
                                {#if memo.memo_detail}
                                    <p class="text-muted-foreground mt-1 text-xs">
                                        {memo.memo_detail}
                                    </p>
                                {/if}
                            </div>
                            <div class="flex justify-end gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onclick={() => goto(`/member/${memo.target_member_id}`)}
                                >
                                    <Pencil class="mr-1 h-3 w-3" />
                                    수정
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                                    onclick={() => handleDelete(memo.id)}
                                    disabled={isDeleting}
                                >
                                    <Trash2 class="mr-1 h-3 w-3" />
                                    삭제
                                </Button>
                            </div>
                        </div>
                    {/each}
                </div>
            {:else}
                <div class="flex flex-col items-center justify-center py-12">
                    <div class="bg-muted mb-4 rounded-full p-4">
                        <NotepadText class="text-muted-foreground h-8 w-8" />
                    </div>
                    <p class="text-foreground mb-1 font-medium">아직 메모가 없어요</p>
                    <p class="text-muted-foreground text-sm">회원 프로필에서 메모를 남겨보세요.</p>
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
