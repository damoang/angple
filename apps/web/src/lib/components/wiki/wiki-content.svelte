<script lang="ts">
    import { tick } from 'svelte';
    import { renderWiki, type WikiFormat } from '$lib/wiki/render';
    let {
        content,
        contentType = 'markdown',
        existingPaths,
        path = ''
    }: {
        content: string;
        contentType?: WikiFormat;
        existingPaths?: Set<string>;
        path?: string;
    } = $props();
    const rendered = $derived(renderWiki(content, contentType, existingPaths, path));
    let root: HTMLDivElement;
    function markBroken(img: EventTarget | null) {
        if (!(img instanceof HTMLImageElement) || img.dataset.failed) return;
        img.dataset.failed = 'true';
        const note = document.createElement('span');
        note.className = 'wiki-image-unavailable';
        note.textContent = `이미지를 불러올 수 없습니다${img.alt ? ': ' + img.alt : ''}`;
        img.hidden = true;
        img.after(note);
    }
    $effect(() => {
        void rendered;
        if (!root) return;
        const handle = (event: Event) => markBroken(event.target);
        root.addEventListener('error', handle, true);
        tick().then(() =>
            root?.querySelectorAll('img').forEach((img) => {
                if (img.complete && !img.naturalWidth) markBroken(img);
            })
        );
        return () => root?.removeEventListener('error', handle, true);
    });
</script>

<div bind:this={root} class="wiki-prose" data-document-path={path}>
    <!-- Sanitized with the shared wiki renderer on both server and client. -->
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html rendered.html}
</div>

<style>
    .wiki-prose {
        line-height: 1.8;
        overflow-wrap: anywhere;
        min-width: 0;
    }
    .wiki-prose :global(h1) {
        font-size: 1.8rem;
        font-weight: 700;
        margin: 1.3em 0 0.6em;
    }
    .wiki-prose :global(h2) {
        font-size: 1.4rem;
        font-weight: 700;
        margin: 1.4em 0 0.6em;
        border-bottom: 1px solid var(--border);
    }
    .wiki-prose :global(h3),
    .wiki-prose :global(h4) {
        font-size: 1.1rem;
        font-weight: 650;
        margin: 1em 0 0.5em;
    }
    .wiki-prose :global([id]) {
        scroll-margin-top: 5rem;
    }
    .wiki-prose :global(p),
    .wiki-prose :global(ul),
    .wiki-prose :global(ol) {
        margin: 0.7em 0;
    }
    .wiki-prose :global(ul) {
        list-style: disc;
        padding-left: 1.5rem;
    }
    .wiki-prose :global(ol) {
        list-style: decimal;
        padding-left: 1.5rem;
    }
    .wiki-prose :global(a) {
        color: var(--primary, #2563eb);
        text-decoration: underline;
        text-underline-offset: 3px;
    }
    .wiki-prose :global(a.red-link) {
        color: #c23c3c;
    }
    .wiki-prose :global(img) {
        max-width: 100%;
        height: auto;
    }
    .wiki-prose :global(.wiki-table-scroll) {
        overflow-x: auto;
        max-width: 100%;
        margin: 1rem 0;
    }
    .wiki-prose :global(table) {
        width: 100%;
        border-collapse: collapse;
    }
    .wiki-prose :global(th),
    .wiki-prose :global(td) {
        padding: 0.5rem 0.7rem;
        border: 1px solid var(--border, #cbd5e1);
        vertical-align: top;
        min-width: 5rem;
    }
    .wiki-prose :global(th) {
        background: var(--muted);
        font-weight: 600;
    }
    .wiki-prose :global(pre) {
        overflow-x: auto;
        white-space: pre;
        padding: 1rem;
        border-radius: 0.4rem;
        background: var(--muted);
    }
    .wiki-prose :global(code) {
        font-family: ui-monospace, monospace;
        font-size: 0.88em;
    }
    .wiki-prose :global(blockquote) {
        border-left: 3px solid var(--primary);
        padding: 0.4rem 1rem;
        margin: 1rem 0;
        background: var(--muted);
    }
    .wiki-prose :global(details) {
        padding: 0.6rem;
        border: 1px solid var(--border);
        border-radius: 0.4rem;
    }
    .wiki-prose :global(summary) {
        cursor: pointer;
        font-weight: 600;
    }
    .wiki-prose :global(hr) {
        margin: 1.5rem 0;
    }
    .wiki-prose :global(.wiki-image-unavailable) {
        color: var(--muted-foreground);
        font-size: 0.85rem;
        border: 1px dashed var(--border);
        padding: 0.4rem;
        display: inline-block;
    }
</style>
