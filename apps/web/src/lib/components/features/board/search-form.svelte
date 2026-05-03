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

    // 검색 필드 옵션 — 기본/고급 분리
    // 기본 5개: 모바일/PC 공통 노출 (UX 단순화)
    // 고급 5개: 데스크톱-only 토글 펼침 시 노출 (닉네임/아이디 분리, 댓글 내용)
    // author / comment_author: 닉네임+아이디 모두 매칭 (legacy 호환)
    // *_nick: 닉네임만, *_id: 아이디만 (정확 매칭, false-positive 차단)
    const basicFieldOptions: { value: SearchField; label: string }[] = [
        { value: 'title_content', label: '제목+내용' },
        { value: 'title', label: '제목' },
        { value: 'content', label: '내용' },
        { value: 'author', label: '작성자' },
        { value: 'comment_author', label: '댓글 작성자' }
    ];

    const advancedFieldOptions: { value: SearchField; label: string }[] = [
        { value: 'author_nick', label: '작성자(닉네임)' },
        { value: 'author_id', label: '작성자(아이디)' },
        { value: 'comment_nick', label: '댓글(닉네임)' },
        { value: 'comment_id', label: '댓글(아이디)' },
        { value: 'comment', label: '댓글 내용' }
    ];

    // Google 검색은 별도 옵션 (기본 노출 유지)
    const googleFieldOption: { value: SearchField; label: string } = {
        value: 'google',
        label: 'Google'
    };

    // 전체 옵션 (라벨 조회용 — URL ?sfl=author_id 같은 직접 입력 호환)
    const allFieldOptions: { value: SearchField; label: string }[] = [
        ...basicFieldOptions,
        ...advancedFieldOptions,
        googleFieldOption
    ];

    // 데스크톱-only 고급 모드 토글
    // URL이 고급 필드를 가리키면 자동으로 펼침 (북마크/링크 호환)
    let showAdvanced = $state(false);

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

    // URL이 고급 필드를 가리키면 데스크톱에서 자동 펼침 (북마크/외부링크 호환)
    $effect(() => {
        if (advancedFieldOptions.some((opt) => opt.value === currentField)) {
            showAdvanced = true;
        }
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

    // 검색 정렬 (최신순/관련성순)
    const currentSort = $derived($page.url.searchParams.get('sort') || 'date');

    function toggleSort(sort: string): void {
        const url = new URL(window.location.href);
        if (sort === 'relevance') {
            url.searchParams.set('sort', 'relevance');
        } else {
            url.searchParams.delete('sort');
        }
        url.searchParams.set('page', '1');
        goto(url.pathname + url.search);
    }

    // 현재 선택된 필드의 라벨 (전체 옵션에서 조회 — 직접 URL 입력 호환)
    const selectedFieldLabel = $derived(
        allFieldOptions.find((opt) => opt.value === searchField)?.label || '제목+내용'
    );

    // 데스크톱 select 노출 옵션 (기본 + 고급 토글 + Google)
    const desktopVisibleOptions = $derived([
        ...basicFieldOptions,
        ...(showAdvanced ? advancedFieldOptions : []),
        googleFieldOption
    ]);

    // 모바일 select 노출 옵션 (기본 5개 + Google)
    // 단, 현재 sfl이 고급 필드면 라벨 표시를 위해 해당 옵션 추가 (외부 링크 호환)
    const mobileVisibleOptions = $derived.by(() => {
        const advancedMatch = advancedFieldOptions.find((opt) => opt.value === searchField);
        if (advancedMatch) {
            // 현재 선택된 고급 필드를 모바일에도 노출 (URL 직접 입력 호환)
            return [...basicFieldOptions, advancedMatch, googleFieldOption];
        }
        return [...basicFieldOptions, googleFieldOption];
    });
</script>

<form onsubmit={handleSearch} class="flex items-center gap-2">
    <!-- 검색 필드 선택: 모바일=네이티브 select, 데스크톱=커스텀 Select -->
    <!-- 모바일 네이티브 select (md 미만) — 기본 5개 + Google (현재 선택된 고급 필드는 노출 유지) -->
    <div class="relative shrink-0 md:hidden">
        <select
            class="border-input bg-background text-foreground focus:ring-ring h-9 w-full appearance-none rounded-md border px-2 pr-7 text-sm focus:outline-none focus:ring-1"
            bind:value={searchField}
        >
            {#each mobileVisibleOptions as option (option.value)}
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
    <!-- 데스크톱 커스텀 Select (md 이상) — 기본 5개 + Google, 고급 토글 시 5개 추가 -->
    <div class="hidden md:block md:shrink-0">
        <Select.Root type="single" value={searchField} onValueChange={handleFieldChange}>
            <Select.Trigger class="w-[120px]">
                {selectedFieldLabel}
            </Select.Trigger>
            <Select.Content>
                {#each desktopVisibleOptions as option (option.value)}
                    <Select.Item value={option.value}>{option.label}</Select.Item>
                {/each}
            </Select.Content>
        </Select.Root>
    </div>

    <!-- 데스크톱-only 고급 토글 (md 이상) — 모바일은 노출 안 함 -->
    <button
        type="button"
        onclick={() => (showAdvanced = !showAdvanced)}
        class="border-input bg-background text-muted-foreground hover:bg-accent hover:text-foreground hidden h-9 shrink-0 items-center rounded-md border px-2 text-xs transition-colors md:inline-flex"
        aria-expanded={showAdvanced}
        title="작성자/댓글 닉네임·아이디 분리 검색"
    >
        고급 {showAdvanced ? '▴' : '▾'}
    </button>

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

<!-- 검색 결과 안내 + 정렬 옵션 -->
{#if isSearching}
    <div class="text-muted-foreground mt-2 flex items-center justify-between text-sm">
        <span>
            <span class="text-foreground font-medium">"{currentQuery}"</span>
            검색 결과 ({selectedFieldLabel})
        </span>
        <span class="flex items-center gap-1">
            <button
                type="button"
                class="rounded px-1.5 py-0.5 text-xs transition-colors {currentSort !== 'relevance'
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:text-foreground'}"
                onclick={() => toggleSort('date')}>최신순</button
            >
            <button
                type="button"
                class="rounded px-1.5 py-0.5 text-xs transition-colors {currentSort === 'relevance'
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:text-foreground'}"
                onclick={() => toggleSort('relevance')}>관련성순</button
            >
        </span>
    </div>
{/if}
