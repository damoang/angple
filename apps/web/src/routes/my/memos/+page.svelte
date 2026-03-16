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
    import Search from '@lucide/svelte/icons/search';
    import Pin from '@lucide/svelte/icons/pin';
    import X from '@lucide/svelte/icons/x';
    import { slide } from 'svelte/transition';
    import { pluginStore } from '$lib/stores/plugin.svelte';
    import { loadPluginLib } from '$lib/utils/plugin-optional-loader';
    import { uiSettingsStore } from '$lib/stores/ui-settings.svelte';
    import type { PageData } from './$types.js';

    const COLOR_OPTIONS = [
        { value: 'yellow', label: '노랑', bg: '#ffe69c', text: '#664d03' },
        { value: 'green', label: '초록', bg: '#d1e7dd', text: '#0f5132' },
        { value: 'purple', label: '보라', bg: '#e2d9f3', text: '#432874' },
        { value: 'red', label: '빨강', bg: '#f8d7da', text: '#dc3545' },
        { value: 'blue', label: '파랑', bg: '#cfe2ff', text: '#084298' }
    ];

    const COLOR_STYLES: Record<string, { bg: string; text: string }> = {};
    for (const c of COLOR_OPTIONS) {
        COLOR_STYLES[c.value] = { bg: c.bg, text: c.text };
    }

    let { data }: { data: PageData } = $props();

    let deletingId = $state<string | null>(null);

    // 검색 상태
    let searchColor = $state(data.search?.color ?? '');
    let searchMemo = $state(data.search?.memo ?? '');
    let searchDetail = $state(data.search?.detail ?? '');
    let searchTarget = $state(data.search?.target ?? '');

    const hasActiveSearch = $derived(!!(searchColor || searchMemo || searchDetail || searchTarget));
    const isSearching = $derived(
        !!(data.search?.color || data.search?.memo || data.search?.detail || data.search?.target)
    );
    let showSearch = $state(uiSettingsStore.pinMemoSearch);

    function handleSearch() {
        // eslint-disable-next-line svelte/prefer-svelte-reactivity
        const params = new URLSearchParams();
        if (searchColor) params.set('color', searchColor);
        if (searchMemo.trim()) params.set('memo', searchMemo.trim());
        if (searchDetail.trim()) params.set('detail', searchDetail.trim());
        if (searchTarget.trim()) params.set('target', searchTarget.trim());
        const qs = params.toString();
        goto(`/my/memos${qs ? `?${qs}` : ''}`);
    }

    function clearSearch() {
        searchColor = '';
        searchMemo = '';
        searchDetail = '';
        searchTarget = '';
        goto('/my/memos');
    }



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
        // eslint-disable-next-line svelte/prefer-svelte-reactivity
        const params = new URLSearchParams();
        params.set('page', String(pageNum));
        if (searchColor) params.set('color', searchColor);
        if (searchMemo.trim()) params.set('memo', searchMemo.trim());
        if (searchDetail.trim()) params.set('detail', searchDetail.trim());
        if (searchTarget.trim()) params.set('target', searchTarget.trim());
        goto(`/my/memos?${params.toString()}`);
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
    <div class="mb-6 flex items-start justify-between">
        <div>
            <h1 class="text-foreground text-2xl font-bold">회원 메모</h1>
            <p class="text-muted-foreground mt-1 text-sm">
                다른 회원에 대해 작성한 개인 메모 {data.total}건
            </p>
        </div>
        <div class="flex items-center gap-0">
            <Button
                variant="outline"
                size="sm"
                class="gap-1.5 {showSearch || isSearching || uiSettingsStore.pinMemoSearch
                    ? 'rounded-r-none border-r-0'
                    : ''}"
                onclick={() => (showSearch = !showSearch)}
            >
                <Search class="h-3.5 w-3.5" />
                검색
            </Button>
            {#if showSearch || isSearching || uiSettingsStore.pinMemoSearch}
                <Button
                    variant="outline"
                    size="sm"
                    class="rounded-l-none px-2 {uiSettingsStore.pinMemoSearch
                        ? 'bg-primary/10 text-primary'
                        : ''}"
                    onclick={() => uiSettingsStore.setPinMemoSearch(!uiSettingsStore.pinMemoSearch)}
                    title={uiSettingsStore.pinMemoSearch ? '검색 고정 해제' : '검색 고정'}
                >
                    <Pin
                        class="h-3.5 w-3.5"
                        fill={uiSettingsStore.pinMemoSearch ? 'currentColor' : 'none'}
                    />
                </Button>
            {/if}
        </div>
    </div>

    <!-- 색상별 분포 -->
    {#if Object.values(data.colorDist ?? {}).reduce((s, n) => s + n, 0) > 0}
        {@const totalMemos = Object.values(data.colorDist ?? {}).reduce((s, n) => s + n, 0)}
        <div class="mb-6">
            <Card class="bg-primary/5 border-primary/20">
                <CardContent class="px-4 py-3">
                    <div class="mb-2 flex items-center gap-2">
                        <NotepadText class="text-primary h-4 w-4" />
                        <span class="text-foreground text-sm font-medium">
                            총 {totalMemos.toLocaleString()}건
                        </span>
                    </div>
                    <!-- 분포 바 -->
                    <div class="mb-2 flex h-2.5 overflow-hidden rounded-full">
                        {#each COLOR_OPTIONS as color}
                            {@const count = data.colorDist?.[color.value] ?? 0}
                            {#if count > 0}
                                <div
                                    style="width: {(count / totalMemos) *
                                        100}%; background-color: {color.bg};"
                                    title="{color.label} {count}건"
                                ></div>
                            {/if}
                        {/each}
                    </div>
                    <!-- 범례 -->
                    <div class="flex flex-wrap gap-3">
                        {#each COLOR_OPTIONS as color}
                            {@const count = data.colorDist?.[color.value] ?? 0}
                            {#if count > 0}
                                <button
                                    type="button"
                                    class="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80"
                                    onclick={() => {
                                        searchColor =
                                            searchColor === color.value ? '' : color.value;
                                        showSearch = true;
                                        handleSearch();
                                    }}
                                >
                                    <span
                                        class="inline-block h-2.5 w-2.5 rounded-full"
                                        style="background-color: {color.bg}; border: 1px solid {color.text};"
                                    ></span>
                                    <span class="text-muted-foreground">
                                        {color.label}
                                        <span class="text-foreground font-medium">{count}</span>
                                    </span>
                                </button>
                            {/if}
                        {/each}
                    </div>
                </CardContent>
            </Card>
        </div>
    {/if}

    {#if showSearch || isSearching || uiSettingsStore.pinMemoSearch}
        <div class="mb-6" transition:slide={{ duration: 200 }}>
            <Card class="bg-background">
                <CardContent class="pt-6">
                    <form
                        onsubmit={(e) => {
                            e.preventDefault();
                            handleSearch();
                        }}
                        class="space-y-4"
                    >
                        {#if searchColor}
                            {@const activeColor = COLOR_OPTIONS.find(
                                (c) => c.value === searchColor
                            )}
                            {#if activeColor}
                                <div class="flex items-center gap-2">
                                    <span class="text-muted-foreground text-xs">색상 필터</span>
                                    <button
                                        type="button"
                                        class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                                        style="background-color: {activeColor.bg}; color: {activeColor.text};"
                                        onclick={() => {
                                            searchColor = '';
                                            handleSearch();
                                        }}
                                        title="색상 필터 해제"
                                    >
                                        {activeColor.label}
                                        <X class="h-3 w-3" />
                                    </button>
                                </div>
                            {/if}
                        {/if}
                        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div>
                                <label
                                    for="search-target"
                                    class="text-muted-foreground mb-1 block text-xs"
                                >
                                    대상 회원
                                </label>
                                <input
                                    id="search-target"
                                    type="text"
                                    bind:value={searchTarget}
                                    placeholder="닉네임 또는 ID"
                                    class="border-input bg-background text-foreground placeholder:text-muted-foreground w-full rounded-md border px-3 py-1.5 text-sm"
                                />
                            </div>
                            <div>
                                <label
                                    for="search-memo"
                                    class="text-muted-foreground mb-1 block text-xs"
                                >
                                    메모
                                </label>
                                <input
                                    id="search-memo"
                                    type="text"
                                    bind:value={searchMemo}
                                    placeholder="메모 내용 검색"
                                    class="border-input bg-background text-foreground placeholder:text-muted-foreground w-full rounded-md border px-3 py-1.5 text-sm"
                                />
                            </div>
                            <div>
                                <label
                                    for="search-detail"
                                    class="text-muted-foreground mb-1 block text-xs"
                                >
                                    상세 메모
                                </label>
                                <input
                                    id="search-detail"
                                    type="text"
                                    bind:value={searchDetail}
                                    placeholder="상세 메모 검색"
                                    class="border-input bg-background text-foreground placeholder:text-muted-foreground w-full rounded-md border px-3 py-1.5 text-sm"
                                />
                            </div>
                        </div>

                        <!-- 버튼 -->
                        <div class="flex items-center gap-2">
                            <Button type="submit" size="sm" class="gap-1.5">
                                <Search class="h-3.5 w-3.5" />
                                검색
                            </Button>
                            {#if hasActiveSearch}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    class="gap-1.5"
                                    onclick={clearSearch}
                                >
                                    <X class="h-3.5 w-3.5" />
                                    초기화
                                </Button>
                            {/if}
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    {/if}

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
