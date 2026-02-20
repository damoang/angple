<script lang="ts">
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle
    } from '$lib/components/ui/dialog/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { apiClient } from '$lib/api/index.js';
    import type { TenorGif } from '$lib/api/types.js';
    import Search from '@lucide/svelte/icons/search';
    import Loader2 from '@lucide/svelte/icons/loader-2';

    interface Props {
        open: boolean;
        onInsertGif: (url: string) => void;
        onClose: () => void;
    }

    let { open = $bindable(), onInsertGif, onClose }: Props = $props();

    let query = $state('');
    let gifs = $state<TenorGif[]>([]);
    let isLoading = $state(false);
    let nextPos = $state('');
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    // 초기 로드: trending GIF
    $effect(() => {
        if (open && gifs.length === 0) {
            loadFeatured();
        }
    });

    async function loadFeatured(): Promise<void> {
        isLoading = true;
        try {
            const result = await apiClient.getFeaturedGifs();
            gifs = result.results;
            nextPos = result.next;
        } catch (err) {
            console.error('Failed to load featured GIFs:', err);
        } finally {
            isLoading = false;
        }
    }

    async function searchGifs(searchQuery: string): Promise<void> {
        if (!searchQuery.trim()) {
            await loadFeatured();
            return;
        }
        isLoading = true;
        try {
            const result = await apiClient.searchGifs(searchQuery.trim());
            gifs = result.results;
            nextPos = result.next;
        } catch (err) {
            console.error('Failed to search GIFs:', err);
        } finally {
            isLoading = false;
        }
    }

    async function loadMore(): Promise<void> {
        if (!nextPos || isLoading) return;
        isLoading = true;
        try {
            const result = query.trim()
                ? await apiClient.searchGifs(query.trim(), nextPos)
                : await apiClient.getFeaturedGifs(nextPos);
            gifs = [...gifs, ...result.results];
            nextPos = result.next;
        } catch (err) {
            console.error('Failed to load more GIFs:', err);
        } finally {
            isLoading = false;
        }
    }

    function handleInput(): void {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            searchGifs(query);
        }, 400);
    }

    function selectGif(gif: TenorGif): void {
        // 레거시 호환: [URL] 형태로 삽입
        onInsertGif(`[${gif.url}]`);
        open = false;
        onClose();
    }

    function handleClose(isOpen: boolean): void {
        if (!isOpen) {
            onClose();
        }
    }
</script>

<Dialog bind:open onOpenChange={handleClose}>
    <DialogContent class="max-w-lg">
        <DialogHeader>
            <DialogTitle>GIF 검색</DialogTitle>
        </DialogHeader>

        <!-- 검색바 -->
        <div class="relative">
            <Search
                class="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            />
            <input
                type="text"
                bind:value={query}
                oninput={handleInput}
                placeholder="GIF 검색..."
                class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring w-full rounded-md border py-2 pl-10 pr-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            />
        </div>

        <!-- GIF 그리드 -->
        <div class="max-h-[400px] overflow-y-auto">
            {#if isLoading && gifs.length === 0}
                <div class="flex items-center justify-center py-12">
                    <Loader2 class="text-muted-foreground h-6 w-6 animate-spin" />
                </div>
            {:else if gifs.length === 0}
                <p class="text-muted-foreground py-8 text-center text-sm">검색 결과가 없습니다.</p>
            {:else}
                <div class="columns-2 gap-2">
                    {#each gifs as gif (gif.id)}
                        <button
                            type="button"
                            onclick={() => selectGif(gif)}
                            class="mb-2 block w-full overflow-hidden rounded-md transition-opacity hover:opacity-80"
                        >
                            <img
                                src={gif.preview_url}
                                alt={gif.title}
                                class="w-full"
                                loading="lazy"
                            />
                        </button>
                    {/each}
                </div>
                {#if nextPos}
                    <div class="py-3 text-center">
                        <Button variant="ghost" size="sm" onclick={loadMore} disabled={isLoading}>
                            {#if isLoading}
                                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                            {/if}
                            더 보기
                        </Button>
                    </div>
                {/if}
            {/if}
        </div>

        <!-- Tenor 브랜딩 -->
        <p class="text-muted-foreground text-center text-xs">Powered by Tenor</p>
    </DialogContent>
</Dialog>
