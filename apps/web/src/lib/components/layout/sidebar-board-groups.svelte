<script lang="ts">
    /**
     * 사이드바 게시판 그룹 컴포넌트
     * 게시판을 그룹별로 묶어 표시
     */
    import type { BoardGroup } from '$lib/api/types.js';
    import ChevronDown from '@lucide/svelte/icons/chevron-down';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import FolderOpen from '@lucide/svelte/icons/folder-open';

    interface Props {
        groups: BoardGroup[];
        currentBoardId?: string;
    }

    let { groups, currentBoardId }: Props = $props();

    // 그룹별 열림/닫힘 상태
    let expandedGroups = $state<Set<string>>(new Set(groups.map((g) => g.id)));

    function toggleGroup(groupId: string) {
        const next = new Set(expandedGroups);
        if (next.has(groupId)) {
            next.delete(groupId);
        } else {
            next.add(groupId);
        }
        expandedGroups = next;
    }

    const visibleGroups = $derived(groups.filter((g) => g.is_visible));
</script>

<nav class="space-y-1" aria-label="게시판 목록">
    {#each visibleGroups as group (group.id)}
        {@const isExpanded = expandedGroups.has(group.id)}
        <div>
            <button
                class="text-muted-foreground hover:text-foreground hover:bg-muted flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors"
                onclick={() => toggleGroup(group.id)}
                aria-expanded={isExpanded}
            >
                {#if isExpanded}
                    <ChevronDown class="h-3.5 w-3.5 shrink-0" />
                {:else}
                    <ChevronRight class="h-3.5 w-3.5 shrink-0" />
                {/if}
                <FolderOpen class="h-3.5 w-3.5 shrink-0" />
                <span class="truncate">{group.name}</span>
            </button>

            {#if isExpanded && group.boards?.length}
                <div class="ml-5 space-y-0.5 border-l pl-3 dark:border-neutral-700">
                    {#each group.boards as board (board.board_id)}
                        {@const isActive = currentBoardId === board.board_id}
                        <a
                            href="/{board.board_id}"
                            class="block rounded-md px-3 py-1.5 text-sm transition-colors"
                            class:bg-primary={isActive}
                            class:text-primary-foreground={isActive}
                            class:text-muted-foreground={!isActive}
                            class:hover:text-foreground={!isActive}
                            class:hover:bg-muted={!isActive}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            {board.subject}
                        </a>
                    {/each}
                </div>
            {/if}
        </div>
    {/each}
</nav>
