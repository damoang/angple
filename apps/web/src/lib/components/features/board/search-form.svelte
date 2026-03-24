<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import * as Select from '$lib/components/ui/select/index.js';
    import Search from '@lucide/svelte/icons/search';
    import X from '@lucide/svelte/icons/x';
    import type { SearchField } from '$lib/api/types.js';

    interface Props {
        boardPath?: string; // 게시판 경로 (예: '/free')
        placeholder?: string;
        showReset?: boolean;
    }

    let {
        boardPath = '/free',
        placeholder = '검색어를 입력하세요',
        showReset = true
    }: Props = $props();

    // 검색 필드 옵션
    const searchFieldOptions: { value: SearchField; label: string }[] = [
        { value: 'title_content', label: '제목+내용' },
        { value: 'title', label: '제목' },
        { value: 'content', label: '내용' },
        { value: 'author', label: '작성자' },
        { value: 'google', label: 'Google' }
    ];

    // URL에서 현재 검색 파라미터 가져오기
    const currentField = $derived(
        ($page.url.searchParams.get('sfl') as SearchField) || 'title_content'
    );
    const currentQuery = $derived($page.url.searchParams.get('stx') || '');

    // 로컬 상태 (폼 입력용)
    let searchField = $state<SearchField>(currentField);
    let searchQuery = $state(currentQuery);

    // URL 변경시 로컬 상태 동기화
    $effect(() => {
        searchField = currentField;
        searchQuery = currentQuery;
    });

    // 검색 실행
    function handleSearch(e: Event): void {
        e.preventDefault();

        if (!searchQuery.trim()) {
            handleReset();
            return;
        }

        // Google 사이트 검색: 새 탭에서 열기
        if (searchField === 'google') {
            const boardSlug = boardPath.replace(/^\//, '');
            const q = encodeURIComponent(`site:damoang.net/${boardSlug} ${searchQuery.trim()}`);
            window.open(`https://www.google.com/search?q=${q}`, '_blank');
            return;
        }

        const url = new URL(window.location.href);
        url.searchParams.set('sfl', searchField);
        url.searchParams.set('stx', searchQuery.trim());
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search);
    }

    // 검색 초기화
    function handleReset(): void {
        searchQuery = '';
        const url = new URL(window.location.href);
        url.searchParams.delete('sfl');
        url.searchParams.delete('stx');
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search);
    }

    // 검색 중인지 여부
    const isSearching = $derived(Boolean(currentQuery));

    // Select 값 변경 핸들러
    function handleFieldChange(value: string | undefined): void {
        if (value) {
            searchField = value as SearchField;
        }
    }

    // 현재 선택된 필드의 라벨
    const selectedFieldLabel = $derived(
        searchFieldOptions.find((opt) => opt.value === searchField)?.label || '제목+내용'
    );
</script>

<form onsubmit={handleSearch} class="flex items-center gap-2">
    <!-- 검색 필드 선택: 모바일=네이티브 select, 데스크톱=커스텀 Select -->
    <!-- 모바일 네이티브 select (md 미만) -->
    <div class="relative shrink-0 md:hidden">
        <select
            class="border-input bg-background text-foreground focus:ring-ring h-9 w-full appearance-none rounded-md border px-2 pr-7 text-sm focus:outline-none focus:ring-1"
            bind:value={searchField}
        >
            {#each searchFieldOptions as option (option.value)}
                <option value={option.value}>{option.label}</option>
            {/each}
        </select>
        <svg
            class="text-muted-foreground pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
        >
            <path d="M6 9l6 6 6-6" />
        </svg>
    </div>
    <!-- 데스크톱 커스텀 Select (md 이상) -->
    <div class="hidden md:block md:shrink-0">
        <Select.Root type="single" value={searchField} onValueChange={handleFieldChange}>
            <Select.Trigger class="w-[120px]">
                {selectedFieldLabel}
            </Select.Trigger>
            <Select.Content>
                {#each searchFieldOptions as option (option.value)}
                    <Select.Item value={option.value}>{option.label}</Select.Item>
                {/each}
            </Select.Content>
        </Select.Root>
    </div>

    <!-- 검색어 입력 -->
    <div class="relative min-w-0 flex-1">
        <Input type="text" bind:value={searchQuery} {placeholder} class="pr-10" />
        {#if searchQuery}
            <button
                type="button"
                onclick={() => (searchQuery = '')}
                class="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
            >
                <X class="h-4 w-4" />
            </button>
        {/if}
    </div>

    <!-- 검색 버튼 -->
    <Button type="submit" size="sm" class="shrink-0">
        <Search class="h-4 w-4 md:mr-1" />
        <span class="hidden md:inline">검색</span>
    </Button>

    <!-- 초기화 버튼 (검색 중일 때만 표시) -->
    {#if showReset && isSearching}
        <Button type="button" variant="outline" size="sm" onclick={handleReset}>초기화</Button>
    {/if}
</form>

<!-- 검색 결과 안내 -->
{#if isSearching}
    <div class="text-muted-foreground mt-2 text-sm">
        <span class="text-foreground font-medium">"{currentQuery}"</span>
        검색 결과 ({selectedFieldLabel})
    </div>
{/if}
