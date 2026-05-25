<script lang="ts">
    /**
     * 위키 목차 (TOC) — 우측 sticky 레일.
     * 본문(마크다운 원문)에서 h2~h4 추출. 헤딩 3개 미만이면 표시 안 함.
     * 앵커 slug 는 본문 헤딩 element 의 id 와 동일 (heading-slug.ts 공용).
     */
    import { parseMarkdownHeadings, type TocItem } from './heading-slug';
    import ListIcon from '@lucide/svelte/icons/list';

    let { content = '' }: { content: string } = $props();

    const items = $derived<TocItem[]>(parseMarkdownHeadings(content));

    let active = $state('');

    function handleClick(e: MouseEvent, slug: string) {
        const el = document.getElementById(slug);
        if (el) {
            e.preventDefault();
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            history.replaceState(null, '', `#${slug}`);
            active = slug;
        }
    }
</script>

{#if items.length >= 3}
    <nav class="wiki-toc" aria-label="목차">
        <div class="wiki-toc-title">
            <ListIcon class="h-3.5 w-3.5" />
            목차
        </div>
        <ul>
            {#each items as it (it.slug)}
                <li style="padding-left: {(it.level - 2) * 0.75}rem">
                    <a
                        href="#{it.slug}"
                        class:active={active === it.slug}
                        onclick={(e) => handleClick(e, it.slug)}>{it.text}</a
                    >
                </li>
            {/each}
        </ul>
    </nav>
{/if}

<style>
    .wiki-toc {
        position: sticky;
        top: 5rem;
        max-height: calc(100vh - 7rem);
        overflow-y: auto;
        font-size: 0.85rem;
        border-left: 2px solid var(--border, #e5e7eb);
        padding-left: 0.875rem;
    }
    .wiki-toc-title {
        display: flex;
        align-items: center;
        gap: 0.375rem;
        font-weight: 600;
        color: var(--muted-foreground, #6b7280);
        margin-bottom: 0.5rem;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
    }
    .wiki-toc ul {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
    }
    .wiki-toc a {
        display: block;
        padding: 0.15rem 0.25rem;
        color: var(--muted-foreground, #6b7280);
        text-decoration: none;
        border-radius: 0.25rem;
        line-height: 1.4;
        transition: color 0.12s;
    }
    .wiki-toc a:hover {
        color: var(--primary, #3366cc);
    }
    .wiki-toc a.active {
        color: var(--primary, #3366cc);
        font-weight: 600;
    }
</style>
