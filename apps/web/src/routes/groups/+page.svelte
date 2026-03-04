<script lang="ts">
    import { SeoHead } from '$lib/seo/index.js';
    import Users from '@lucide/svelte/icons/users';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import FileText from '@lucide/svelte/icons/file-text';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    let searchQuery = $state('');

    let filteredBoards = $derived(
        searchQuery
            ? data.boards.filter((b) =>
                  b.bo_subject.toLowerCase().includes(searchQuery.toLowerCase())
              )
            : data.boards
    );
</script>

<SeoHead
    config={{
        meta: { title: '소모임 전체 목록', description: '다모앙 소모임 게시판 전체 목록' },
        og: { title: '소모임 전체 목록', type: 'website' }
    }}
/>

<div class="mx-auto max-w-5xl px-4 py-8">
    <!-- 헤더 -->
    <div class="mb-6 flex items-center gap-3">
        <Users class="text-primary h-7 w-7" />
        <div>
            <h1 class="text-foreground text-2xl font-bold">소모임 전체 목록</h1>
            <p class="text-muted-foreground text-sm">
                총 {data.boards.length}개의 소모임이 운영 중입니다
            </p>
        </div>
    </div>

    <!-- 검색 -->
    <div class="mb-6">
        <input
            type="text"
            placeholder="소모임 검색..."
            class="border-border bg-canvas text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-primary w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none focus:ring-1"
            bind:value={searchQuery}
        />
    </div>

    <!-- 소모임 그리드 -->
    {#if filteredBoards.length === 0}
        <div class="text-muted-foreground py-12 text-center">
            {#if searchQuery}
                <p>'{searchQuery}'에 해당하는 소모임이 없습니다.</p>
            {:else}
                <p>소모임 목록을 불러올 수 없습니다.</p>
            {/if}
        </div>
    {:else}
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {#each filteredBoards as board (board.bo_table)}
                <a
                    href="/{board.bo_table}"
                    class="border-border hover:border-primary/40 bg-canvas flex items-center gap-3 rounded-lg border p-4 transition-all hover:shadow-sm"
                >
                    <div
                        class="bg-primary/10 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    >
                        <Users class="h-5 w-5" />
                    </div>
                    <div class="min-w-0 flex-1">
                        <h2 class="text-foreground truncate text-sm font-semibold">
                            {board.bo_subject}
                        </h2>
                        <div class="text-muted-foreground mt-0.5 flex items-center gap-3 text-xs">
                            <span class="flex items-center gap-1">
                                <FileText class="h-3 w-3" />
                                {board.bo_count_write.toLocaleString()}
                            </span>
                            <span class="flex items-center gap-1">
                                <MessageSquare class="h-3 w-3" />
                                {board.bo_count_comment.toLocaleString()}
                            </span>
                        </div>
                    </div>
                </a>
            {/each}
        </div>
    {/if}

    <!-- 소모임 개설 안내 -->
    <div class="border-border bg-muted/30 mt-8 rounded-lg border p-4 text-center">
        <p class="text-muted-foreground text-sm">
            새로운 소모임을 개설하고 싶으신가요?
            <a href="/newgroup" class="text-primary font-medium hover:underline">소모임 개설 신청</a
            >
        </p>
    </div>
</div>
