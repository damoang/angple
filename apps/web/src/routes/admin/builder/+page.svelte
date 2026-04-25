<script lang="ts">
    import Editor from '$lib/builder/editor.svelte';
    import Renderer from '$lib/builder/renderer.svelte';
    import type { BuilderContent } from '$lib/builder/types.js';
    import { BUILDER_SCHEMA_VERSION } from '$lib/builder/types.js';

    let { data } = $props();

    let content = $state<BuilderContent>(data.initialContent);
    let saving = $state(false);
    let lastSavedAt = $state<string | null>(null);
    let saveError = $state<string | null>(null);

    async function save() {
        saving = true;
        saveError = null;
        try {
            const blocksJSON = JSON.stringify({
                schema_version: BUILDER_SCHEMA_VERSION,
                blocks: content.blocks
            });

            const response = await fetch(
                `/api/v1/admin/sites/${data.siteId}/content/${encodeURIComponent(data.contentKey)}`,
                {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        schema_version: BUILDER_SCHEMA_VERSION,
                        blocks: blocksJSON
                    })
                }
            );

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text}`);
            }
            lastSavedAt = new Date().toLocaleTimeString();
        } catch (err) {
            saveError = err instanceof Error ? err.message : String(err);
        } finally {
            saving = false;
        }
    }
</script>

<svelte:head>
    <title>Builder PoC | Admin</title>
</svelte:head>

<div class="builder-page">
    <header>
        <h1>빌더 PoC</h1>
        <p class="meta">
            site_id=<code>{data.siteId}</code> / content_key=<code>{data.contentKey}</code>
        </p>
        <div class="actions">
            <button onclick={save} disabled={saving}>
                {saving ? '저장 중…' : '저장'}
            </button>
            {#if lastSavedAt}<span class="ok">저장됨 ({lastSavedAt})</span>{/if}
            {#if saveError}<span class="err">실패: {saveError}</span>{/if}
        </div>
    </header>

    <section class="editor-pane">
        <h2>편집</h2>
        <Editor initial={data.initialContent} onChange={(c) => (content = c)} />
    </section>

    <section class="preview-pane">
        <h2>SSR 미리보기</h2>
        <div class="preview-frame">
            <Renderer {content} />
        </div>
    </section>
</div>

<style>
    .builder-page {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        padding: 1rem;
        max-width: 1100px;
        margin: 0 auto;
    }
    header {
        border-bottom: 1px solid #e5e7eb;
        padding-bottom: 1rem;
    }
    header h1 {
        font-size: 1.5rem;
        font-weight: 700;
        margin: 0;
    }
    .meta {
        font-size: 0.875rem;
        color: #6b7280;
        margin: 0.25rem 0;
    }
    .meta code {
        background: #f3f4f6;
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
    }
    .actions {
        margin-top: 0.5rem;
        display: flex;
        gap: 0.75rem;
        align-items: center;
    }
    .actions button {
        padding: 0.5rem 1rem;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 0.375rem;
        cursor: pointer;
        font-weight: 600;
    }
    .actions button:disabled {
        background: #9ca3af;
    }
    .ok {
        color: #059669;
        font-size: 0.875rem;
    }
    .err {
        color: #dc2626;
        font-size: 0.875rem;
    }
    section h2 {
        font-size: 1.125rem;
        font-weight: 600;
        margin: 0 0 0.5rem;
    }
    .preview-frame {
        border: 1px dashed #d1d5db;
        padding: 1rem;
        border-radius: 0.375rem;
        background: white;
    }
</style>
