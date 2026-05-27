<script lang="ts">
    /**
     * 위키 좌측 페이지 트리 (Wiki.js 스타일 네비).
     * flat WikiTreeNode[] → parent_id 로 트리 구성, 접기/펼치기, 현재 문서 강조.
     */
    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import FileTextIcon from '@lucide/svelte/icons/file-text';

    // server/wiki.ts 의 WikiTreeNode 와 동일 구조 (클라 컴포넌트라 $lib/server 직접 import 회피)
    interface WikiTreeNode {
        id: number;
        page_id: number | null;
        path: string;
        title: string;
        depth: number;
        parent_id: number | null;
        is_folder: boolean;
        sort_order: number;
    }

    let { nodes = [], currentPath = '' }: { nodes?: WikiTreeNode[]; currentPath?: string } =
        $props();

    type TreeNode = WikiTreeNode & { children: TreeNode[] };

    const roots = $derived.by<TreeNode[]>(() => {
        const map = new Map<number, TreeNode>();
        for (const n of nodes) map.set(n.id, { ...n, children: [] });
        const out: TreeNode[] = [];
        for (const n of map.values()) {
            if (n.parent_id != null && map.has(n.parent_id)) {
                map.get(n.parent_id)!.children.push(n);
            } else {
                out.push(n);
            }
        }
        const sortRec = (arr: TreeNode[]) => {
            arr.sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
            arr.forEach((c) => sortRec(c.children));
        };
        sortRec(out);
        return out;
    });

    const cur = $derived((currentPath || '').replace(/\/+$/, ''));

    // 현재 문서의 조상 노드 id 집합 (그 가지만 펼침)
    const ancestorIds = $derived.by<Set<number>>(() => {
        const set = new Set<number>();
        const byId = new Map(nodes.map((n) => [n.id, n]));
        const node = nodes.find((n) => n.path.replace(/\/+$/, '') === cur);
        let p = node?.parent_id ?? null;
        while (p != null && byId.has(p)) {
            set.add(p);
            p = byId.get(p)!.parent_id ?? null;
        }
        return set;
    });

    let expanded = $state<Set<number>>(new Set());
    $effect(() => {
        // 현재 문서 조상 가지를 펼침
        expanded = new Set(ancestorIds);
    });

    function toggle(id: number) {
        const next = new Set(expanded);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        expanded = next;
    }

    function href(path: string): string {
        const clean = (path || '').replace(/^\/+/, '');
        return '/' + clean.split('/').map(encodeURIComponent).join('/');
    }
</script>

{#snippet treeItem(node: TreeNode, depth: number)}
    {@const isCur = node.path.replace(/\/+$/, '') === cur}
    {@const hasChildren = node.children.length > 0}
    {@const open = expanded.has(node.id)}
    <li>
        <div class="row" class:cur={isCur} style="padding-left: {depth * 0.75 + 0.25}rem">
            {#if hasChildren}
                <button
                    class="twist"
                    class:open
                    onclick={() => toggle(node.id)}
                    aria-label="펼치기"
                >
                    <ChevronRight class="h-3 w-3" />
                </button>
            {:else}
                <span class="twist-spacer"></span>
            {/if}
            <a href={href(node.path)} class="label" title={node.title}>
                <FileTextIcon class="ic h-3 w-3" />
                <span class="txt">{node.title}</span>
            </a>
        </div>
        {#if hasChildren && open}
            <ul>
                {#each node.children as child (child.id)}
                    {@render treeItem(child, depth + 1)}
                {/each}
            </ul>
        {/if}
    </li>
{/snippet}

<nav class="wiki-tree" aria-label="문서 트리">
    <div class="wiki-tree-title">문서</div>
    <ul>
        {#each roots as node (node.id)}
            {@render treeItem(node, 0)}
        {/each}
    </ul>
</nav>

<style>
    .wiki-tree {
        font-size: 0.82rem;
        line-height: 1.4;
    }
    .wiki-tree-title {
        font-weight: 600;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        color: var(--muted-foreground, #6b7280);
        margin-bottom: 0.5rem;
        padding-left: 0.25rem;
    }
    .wiki-tree ul {
        list-style: none;
        margin: 0;
        padding: 0;
    }
    .row {
        display: flex;
        align-items: center;
        gap: 0.125rem;
        border-radius: 0.3rem;
    }
    .row:hover {
        background: var(--muted, #f3f4f6);
    }
    .row.cur {
        background: color-mix(in srgb, var(--primary, #3366cc) 12%, transparent);
    }
    .row.cur .txt {
        color: var(--primary, #3366cc);
        font-weight: 600;
    }
    .twist {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 1.1rem;
        height: 1.1rem;
        flex-shrink: 0;
        border: none;
        background: none;
        cursor: pointer;
        color: var(--muted-foreground, #6b7280);
        transition: transform 0.12s;
    }
    .twist.open {
        transform: rotate(90deg);
    }
    .twist-spacer {
        width: 1.1rem;
        flex-shrink: 0;
    }
    .label {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        min-width: 0;
        padding: 0.2rem 0.3rem;
        color: var(--foreground, #374151);
        text-decoration: none;
        flex: 1;
    }
    .label .ic {
        flex-shrink: 0;
        opacity: 0.5;
    }
    .txt {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .label:hover .txt {
        color: var(--primary, #3366cc);
    }
</style>
