<script lang="ts">
    import {
        BUILDER_SCHEMA_VERSION,
        type Block,
        type BlockData,
        type BlockType,
        type BuilderContent
    } from './types.js';
    import { listBlocks, registerPoCBlocks } from './registry.js';
    import { ulid } from './ulid.js';
    import Renderer from './renderer.svelte';

    /**
     * Block-level editor for the M1 A1 PoC.
     * TipTap inline rich-text 통합은 Phase 2 (paragraph block 안에 mount).
     * PoC 시점은 form-based 편집 + Renderer 미리보기.
     */

    let {
        initial = { schema_version: BUILDER_SCHEMA_VERSION, blocks: [] } as BuilderContent,
        onChange = (_c: BuilderContent) => {}
    }: {
        initial?: BuilderContent;
        onChange?: (content: BuilderContent) => void;
    } = $props();

    registerPoCBlocks();
    const blockDefs = listBlocks();

    let blocks = $state<Block[]>(structuredClone(initial.blocks ?? []));
    let preview = $state(false);

    function emit() {
        onChange({ schema_version: BUILDER_SCHEMA_VERSION, blocks });
    }

    function addBlock(type: BlockType) {
        const def = blockDefs.find((d) => d.type === type);
        if (!def) return;
        blocks = [...blocks, { id: ulid(), type, data: def.createDefault() as BlockData }];
        emit();
    }

    function moveBlock(idx: number, dir: -1 | 1) {
        const target = idx + dir;
        if (target < 0 || target >= blocks.length) return;
        const next = [...blocks];
        [next[idx], next[target]] = [next[target], next[idx]];
        blocks = next;
        emit();
    }

    function removeBlock(idx: number) {
        blocks = blocks.filter((_, i) => i !== idx);
        emit();
    }

    function updateData(idx: number, data: BlockData) {
        const next = [...blocks];
        next[idx] = { ...next[idx], data };
        blocks = next;
        emit();
    }

    const previewContent = $derived<BuilderContent>({
        schema_version: BUILDER_SCHEMA_VERSION,
        blocks
    });
</script>

<div class="builder-editor">
    <div class="toolbar">
        {#each blockDefs as def (def.type)}
            <button type="button" onclick={() => addBlock(def.type)}>+ {def.label}</button>
        {/each}
        <button
            type="button"
            class="preview-toggle"
            class:active={preview}
            onclick={() => (preview = !preview)}
        >
            미리보기
        </button>
    </div>

    {#if preview}
        <div class="preview">
            <Renderer content={previewContent} />
        </div>
    {:else}
        <ol class="block-list">
            {#each blocks as block, idx (block.id)}
                <li class="block-row">
                    <header>
                        <span class="badge">{block.type}</span>
                        <span class="id">{block.id.slice(0, 8)}…</span>
                        <span class="actions">
                            <button
                                type="button"
                                onclick={() => moveBlock(idx, -1)}
                                aria-label="위로">↑</button
                            >
                            <button
                                type="button"
                                onclick={() => moveBlock(idx, 1)}
                                aria-label="아래로">↓</button
                            >
                            <button type="button" onclick={() => removeBlock(idx)} aria-label="삭제"
                                >✕</button
                            >
                        </span>
                    </header>

                    {#if block.type === 'header'}
                        <input
                            type="text"
                            value={(block.data as { text: string }).text}
                            oninput={(e) =>
                                updateData(idx, {
                                    ...(block.data as object),
                                    text: e.currentTarget.value
                                } as BlockData)}
                            placeholder="제목"
                        />
                        <select
                            value={(block.data as { level: number }).level}
                            onchange={(e) =>
                                updateData(idx, {
                                    ...(block.data as object),
                                    level: Number(e.currentTarget.value)
                                } as BlockData)}
                        >
                            <option value="1">H1</option>
                            <option value="2">H2</option>
                            <option value="3">H3</option>
                            <option value="4">H4</option>
                        </select>
                    {:else if block.type === 'paragraph'}
                        <textarea
                            rows="4"
                            value={(block.data as { text: string }).text}
                            oninput={(e) =>
                                updateData(idx, {
                                    text: e.currentTarget.value,
                                    format: 'html'
                                } as BlockData)}
                            placeholder="<p>본문 HTML</p>"
                        ></textarea>
                    {:else if block.type === 'image'}
                        <input
                            type="url"
                            value={(block.data as { url: string }).url}
                            oninput={(e) =>
                                updateData(idx, {
                                    ...(block.data as object),
                                    url: e.currentTarget.value
                                } as BlockData)}
                            placeholder="https://example.com/image.jpg"
                        />
                        <input
                            type="text"
                            value={(block.data as { alt: string }).alt}
                            oninput={(e) =>
                                updateData(idx, {
                                    ...(block.data as object),
                                    alt: e.currentTarget.value
                                } as BlockData)}
                            placeholder="alt (필수)"
                        />
                    {:else if block.type === 'button'}
                        <input
                            type="text"
                            value={(block.data as { text: string }).text}
                            oninput={(e) =>
                                updateData(idx, {
                                    ...(block.data as object),
                                    text: e.currentTarget.value
                                } as BlockData)}
                            placeholder="버튼 텍스트"
                        />
                        <input
                            type="url"
                            value={(block.data as { href: string }).href}
                            oninput={(e) =>
                                updateData(idx, {
                                    ...(block.data as object),
                                    href: e.currentTarget.value
                                } as BlockData)}
                            placeholder="링크 URL"
                        />
                    {:else if block.type === 'list'}
                        <textarea
                            rows="3"
                            value={(block.data as { items: string[] }).items.join('\n')}
                            oninput={(e) =>
                                updateData(idx, {
                                    ...(block.data as object),
                                    items: e.currentTarget.value.split('\n')
                                } as BlockData)}
                            placeholder="항목을 줄바꿈으로 구분"
                        ></textarea>
                    {:else if block.type === 'embed'}
                        <input
                            type="url"
                            value={(block.data as { source: string }).source}
                            oninput={(e) =>
                                updateData(idx, {
                                    provider: 'youtube',
                                    source: e.currentTarget.value
                                } as BlockData)}
                            placeholder="YouTube URL"
                        />
                    {:else if block.type === 'divider'}
                        <span class="muted">— 구분선 —</span>
                    {/if}
                </li>
            {/each}
        </ol>
    {/if}
</div>

<style>
    .builder-editor {
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    .toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        padding: 0.5rem;
        border: 1px solid #e5e7eb;
        border-radius: 0.375rem;
        background: #f9fafb;
    }
    .toolbar button {
        padding: 0.25rem 0.75rem;
        border: 1px solid #d1d5db;
        background: white;
        border-radius: 0.25rem;
        cursor: pointer;
    }
    .toolbar button:hover {
        background: #eff6ff;
    }
    .preview-toggle.active {
        background: #3b82f6;
        color: white;
    }
    .block-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .block-row {
        border: 1px solid #e5e7eb;
        border-radius: 0.375rem;
        padding: 0.75rem;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    .block-row header {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        font-size: 0.875rem;
    }
    .badge {
        background: #e5e7eb;
        padding: 0.125rem 0.5rem;
        border-radius: 0.25rem;
        font-weight: 600;
    }
    .id {
        color: #6b7280;
        font-family: monospace;
    }
    .actions {
        margin-left: auto;
        display: flex;
        gap: 0.25rem;
    }
    .actions button {
        background: none;
        border: 1px solid #d1d5db;
        padding: 0.125rem 0.5rem;
        cursor: pointer;
        border-radius: 0.25rem;
    }
    .actions button:hover {
        background: #fee2e2;
    }
    .preview {
        border: 1px dashed #d1d5db;
        padding: 1rem;
        border-radius: 0.375rem;
    }
    .muted {
        color: #9ca3af;
        font-style: italic;
    }
    input,
    textarea,
    select {
        padding: 0.375rem 0.5rem;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        font-family: inherit;
        font-size: 0.95rem;
        width: 100%;
    }
</style>
