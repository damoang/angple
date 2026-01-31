<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import * as Select from '$lib/components/ui/select/index.js';
    import { SearchAutocomplete } from '$lib/components/features/search/index.js';
    import type { PageData } from './$types.js';
    import type { SearchField } from '$lib/api/types.js';
    import Search from '@lucide/svelte/icons/search';
    import FileText from '@lucide/svelte/icons/file-text';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';

    let { data }: { data: PageData } = $props();

    // 검색 필드 옵션
    const searchFieldOptions: { value: SearchField; label: string }[] = [
        { value: 'title_content', label: '제목+내용' },
        { value: 'title', label: '제목' },
        { value: 'content', label: '내용' },
        { value: 'author', label: '작성자' }
    ];

    // 로컬 상태
    let searchQuery = $state(data.query || '');
    let searchField = $state<SearchField>(data.field || 'title_content');

    // 검색 실행
    function handleSearch(e: Event): void {
        e.preventDefault();

        if (!searchQuery.trim()) return;

        const url = new URL(window.location.origin + '/search');
        url.searchParams.set('q', searchQuery.trim());
        url.searchParams.set('sfl', searchField);
        goto(url.pathname + url.search);
    }

    // 게시판으로 이동 (더보기)
    function goToBoard(boardId: string): void {
        const url = new URL(window.location.origin + `/${boardId}`);
        url.searchParams.set('sfl', searchField);
        url.searchParams.set('stx', data.query);
        goto(url.pathname + url.search);
    }

    // 게시글로 이동
    function goToPost(boardId: string, postId: number): void {
        goto(`/${boardId}/${postId}`);
    }

    // 날짜 포맷
    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

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

    // 검색 결과 존재 여부
    const hasResults = $derived(
        data.searchResults && data.searchResults.results && data.searchResults.results.length > 0
    );
</script>

<svelte:head>
    <title>{data.query ? `"${data.query}" 검색 결과` : '검색'} | 다모앙</title>
</svelte:head>

<div class="mx-auto max-w-4xl pt-4">
    <!-- 검색 헤더 -->
    <div class="mb-8">
        <h1 class="text-foreground mb-4 text-3xl font-bold">검색</h1>

        <!-- 검색 폼 -->
        <form onsubmit={handleSearch} class="flex flex-wrap items-center gap-2">
            <!-- 검색 필드 선택 -->
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

            <!-- 검색어 입력 (자동완성) -->
            <div class="relative min-w-[250px] flex-1">
                <SearchAutocomplete
                    initialQuery={searchQuery}
                    placeholder="검색어를 입력하세요"
                    onSearch={(q) => {
                        searchQuery = q;
                        handleSearch(new Event('submit'));
                    }}
                />
            </div>

            <!-- 검색 버튼 -->
            <Button type="submit">
                <Search class="mr-1 h-4 w-4" />
                검색
            </Button>
        </form>
    </div>

    <!-- 검색 결과 -->
    {#if data.error}
        <Card class="border-destructive">
            <CardContent class="pt-6">
                <p class="text-destructive text-center">{data.error}</p>
            </CardContent>
        </Card>
    {:else if data.query && !hasResults}
        <Card class="bg-background">
            <CardContent class="py-12 text-center">
                <Search class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <p class="text-foreground mb-2 text-lg font-medium">
                    "{data.query}" 검색 결과가 없습니다
                </p>
                <p class="text-secondary-foreground">
                    다른 검색어를 입력하거나 검색 조건을 변경해 보세요.
                </p>
            </CardContent>
        </Card>
    {:else if hasResults}
        <!-- 검색 결과 요약 -->
        <div class="mb-6">
            <p class="text-secondary-foreground">
                <span class="text-foreground font-medium">"{data.query}"</span>
                검색 결과 총
                <span class="text-foreground font-medium"
                    >{data.searchResults?.total.toLocaleString()}</span
                >건
            </p>
        </div>

        <!-- 게시판별 결과 -->
        <div class="space-y-6">
            {#each data.searchResults?.results || [] as result (result.board_id)}
                <Card class="bg-background">
                    <CardHeader class="pb-3">
                        <div class="flex items-center justify-between">
                            <CardTitle class="flex items-center gap-2 text-lg">
                                <FileText class="text-primary h-5 w-5" />
                                {result.board_name}
                                <span class="text-muted-foreground text-sm font-normal">
                                    ({result.total}건)
                                </span>
                            </CardTitle>
                            {#if result.total > result.posts.length}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onclick={() => goToBoard(result.board_id)}
                                >
                                    더보기
                                    <ChevronRight class="ml-1 h-4 w-4" />
                                </Button>
                            {/if}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ul class="divide-border divide-y">
                            {#each result.posts as post (post.id)}
                                <li class="py-3 first:pt-0 last:pb-0">
                                    <button
                                        type="button"
                                        onclick={() => goToPost(result.board_id, post.id)}
                                        class="hover:bg-accent -m-2 w-full rounded-md p-2 text-left transition-colors"
                                    >
                                        <h3 class="text-foreground mb-1 line-clamp-1 font-medium">
                                            {post.title}
                                        </h3>
                                        <p
                                            class="text-secondary-foreground mb-2 line-clamp-2 text-sm"
                                        >
                                            {post.content}
                                        </p>
                                        <div
                                            class="text-muted-foreground flex items-center gap-2 text-xs"
                                        >
                                            <span>{post.author}</span>
                                            <span>•</span>
                                            <span>{formatDate(post.created_at)}</span>
                                            <span>•</span>
                                            <span>조회 {post.views.toLocaleString()}</span>
                                            <span>•</span>
                                            <span>👍 {post.likes}</span>
                                            <span>•</span>
                                            <span>💬 {post.comments_count}</span>
                                        </div>
                                    </button>
                                </li>
                            {/each}
                        </ul>
                    </CardContent>
                </Card>
            {/each}
        </div>
    {:else}
        <!-- 검색어 입력 전 안내 -->
        <Card class="bg-background">
            <CardContent class="py-12 text-center">
                <Search class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <p class="text-foreground mb-2 text-lg font-medium">전체 검색</p>
                <p class="text-secondary-foreground">
                    모든 게시판에서 원하는 내용을 검색할 수 있습니다.
                </p>
            </CardContent>
        </Card>
    {/if}
</div>

<style>
    .line-clamp-1 {
        display: -webkit-box;
        -webkit-line-clamp: 1;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>
