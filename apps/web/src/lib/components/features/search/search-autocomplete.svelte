<script lang="ts">
    import { goto } from '$app/navigation';
    import { apiClient } from '$lib/api/index.js';
    import type { GlobalSearchResult } from '$lib/api/types.js';
    import Search from '@lucide/svelte/icons/search';
    import FileText from '@lucide/svelte/icons/file-text';

    interface Props {
        placeholder?: string;
        initialQuery?: string;
        onSearch?: (query: string) => void;
    }

    let { placeholder = '검색어를 입력하세요', initialQuery = '', onSearch }: Props = $props();

    let query = $state(initialQuery);
    let results = $state<GlobalSearchResult[]>([]);
    let isOpen = $state(false);
    let isLoading = $state(false);
    let selectedIndex = $state(-1);
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let inputEl: HTMLInputElement | undefined = $state();

    // 총 결과 항목 수 (게시글 + 게시판 헤더)
    const flatItems = $derived(
        results.flatMap((r) => [
            { type: 'board' as const, boardId: r.board_id, boardName: r.board_name },
            ...r.posts.slice(0, 3).map((p) => ({
                type: 'post' as const,
                boardId: r.board_id,
                postId: p.id,
                title: p.title
            }))
        ])
    );

    function debounceSearch(value: string): void {
        if (debounceTimer) clearTimeout(debounceTimer);
        if (value.trim().length < 2) {
            results = [];
            isOpen = false;
            return;
        }

        isLoading = true;
        debounceTimer = setTimeout(async () => {
            try {
                const response = await apiClient.searchGlobal(value.trim(), 'title_content', 3);
                results = response.results || [];
                isOpen = results.length > 0;
                selectedIndex = -1;
            } catch {
                results = [];
                isOpen = false;
            } finally {
                isLoading = false;
            }
        }, 300);
    }

    function handleInput(e: Event): void {
        const target = e.target as HTMLInputElement;
        query = target.value;
        debounceSearch(query);
    }

    function handleKeydown(e: KeyboardEvent): void {
        if (!isOpen) {
            if (e.key === 'Enter') {
                submitSearch();
            }
            return;
        }

        const selectableItems = flatItems.filter((i) => i.type === 'post');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, selectableItems.length - 1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, -1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && selectedIndex < selectableItems.length) {
                const item = selectableItems[selectedIndex];
                if (item.type === 'post') {
                    goto(`/${item.boardId}/${item.postId}`);
                    close();
                }
            } else {
                submitSearch();
            }
        } else if (e.key === 'Escape') {
            close();
        }
    }

    function submitSearch(): void {
        if (!query.trim()) return;
        close();
        if (onSearch) {
            onSearch(query.trim());
        } else {
            goto(`/search?q=${encodeURIComponent(query.trim())}&sfl=title_content`);
        }
    }

    function close(): void {
        isOpen = false;
        selectedIndex = -1;
    }

    function handleBlur(): void {
        // 클릭 이벤트가 먼저 처리되도록 딜레이
        setTimeout(close, 200);
    }

    // 그룹별 게시글의 글로벌 인덱스 계산
    function getPostGlobalIndex(groupIdx: number, postIdx: number): number {
        let idx = 0;
        for (let i = 0; i < groupIdx; i++) {
            idx += Math.min(results[i].posts.length, 3);
        }
        return idx + postIdx;
    }
</script>

<div class="relative w-full">
    <div class="relative">
        <Search class="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
        <input
            bind:this={inputEl}
            type="text"
            value={query}
            oninput={handleInput}
            onkeydown={handleKeydown}
            onblur={handleBlur}
            onfocus={() => {
                if (results.length > 0) isOpen = true;
            }}
            {placeholder}
            class="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-ring w-full rounded-md border py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2"
            autocomplete="off"
        />
        {#if isLoading}
            <div
                class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-current border-t-transparent"
            ></div>
        {/if}
    </div>

    {#if isOpen}
        <div
            class="bg-popover border-border absolute z-50 mt-1 w-full overflow-hidden rounded-md border shadow-lg"
        >
            {#each results as group, groupIdx (group.board_id)}
                <div class="border-border border-b last:border-b-0">
                    <div class="bg-muted/50 text-muted-foreground px-3 py-1.5 text-xs font-medium">
                        {group.board_name}
                    </div>
                    {#each group.posts.slice(0, 3) as post, postIdx (post.id)}
                        {@const currentIndex = getPostGlobalIndex(groupIdx, postIdx)}
                        <button
                            type="button"
                            class="hover:bg-accent flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors {currentIndex ===
                            selectedIndex
                                ? 'bg-accent'
                                : ''}"
                            onmousedown={() => {
                                goto(`/${group.board_id}/${post.id}`);
                                close();
                            }}
                        >
                            <FileText class="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                            <span class="truncate">{post.title}</span>
                        </button>
                    {/each}
                </div>
            {/each}

            <button
                type="button"
                class="text-primary hover:bg-accent flex w-full items-center justify-center gap-1 px-3 py-2 text-sm"
                onmousedown={submitSearch}
            >
                <Search class="h-3.5 w-3.5" />
                "{query}" 전체 검색
            </button>
        </div>
    {/if}
</div>
