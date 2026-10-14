<script lang="ts">
    import { onMount } from 'svelte';
    import WikiContent from './wiki-content.svelte';
    import type { WikiFormat } from '$lib/wiki/render';

    interface Props {
        value: string;
        contentType?: WikiFormat;
        path?: string;
        placeholder?: string;
        existingWikilinkPaths?: string[];
        onChange?: (v: string) => void;
    }

    let {
        value = $bindable(''),
        contentType = 'markdown',
        path = '',
        placeholder,
        existingWikilinkPaths = [],
        onChange
    }: Props = $props();

    const sourcePlaceholder = $derived(
        placeholder ??
            (contentType === 'html'
                ? 'HTML 원문을 편집하세요. 태그와 표 구조를 유지해주세요.'
                : '마크다운으로 작성하세요. 위키링크는 [[문서명]] 형식입니다.')
    );

    let textareaEl: HTMLTextAreaElement | undefined = $state();
    let showPreview = $state(false);
    let ready = $state(false);
    onMount(() => {
        ready = true;
    });
    const existingSet = $derived(
        existingWikilinkPaths.length ? new Set(existingWikilinkPaths) : undefined
    );
    function update(v: string) {
        value = v;
        onChange?.(v);
    }

    function insertAtCursor(before: string, after = before, placeholderText = '') {
        if (!textareaEl || contentType === 'html' || textareaEl.matches(':disabled')) return;
        const start = textareaEl.selectionStart;
        const end = textareaEl.selectionEnd;
        const sel = value.slice(start, end) || placeholderText;
        const newVal = value.slice(0, start) + before + sel + after + value.slice(end);
        update(newVal);
        setTimeout(() => {
            textareaEl?.focus();
            textareaEl?.setSelectionRange(
                start + before.length,
                start + before.length + sel.length
            );
        }, 0);
    }

    const buttons = [
        { label: 'B', title: '굵게 (Ctrl+B)', click: () => insertAtCursor('**', '**', '굵게') },
        { label: 'I', title: '기울임 (Ctrl+I)', click: () => insertAtCursor('_', '_', '기울임') },
        { label: 'H2', title: '제목', click: () => insertAtCursor('## ', '', '제목') },
        { label: 'H3', title: '소제목', click: () => insertAtCursor('### ', '', '소제목') },
        {
            label: '🔗',
            title: '링크',
            click: () => insertAtCursor('[', '](https://)', '링크 텍스트')
        },
        { label: '[[ ]]', title: '위키링크', click: () => insertAtCursor('[[', ']]', '문서명') },
        { label: '• 목록', title: '글머리 기호', click: () => insertAtCursor('- ', '', '항목') },
        {
            label: '표',
            title: '표 삽입',
            click: () => insertAtCursor('\n| 헤더1 | 헤더2 |\n|---|---|\n| ', ' |\n', '내용')
        },
        { label: '🖼', title: '이미지', click: () => insertAtCursor('![', '](https://)', 'alt') },
        {
            label: '```',
            title: '코드 블록',
            click: () => insertAtCursor('\n```\n', '\n```\n', '코드')
        },
        { label: '⎯', title: '구분선', click: () => insertAtCursor('\n---\n', '', '') }
    ];

    function onKeyDown(e: KeyboardEvent) {
        if (contentType === 'html') return;
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
            const k = e.key.toLowerCase();
            if (k === 'b') {
                e.preventDefault();
                insertAtCursor('**', '**', '굵게');
            } else if (k === 'i') {
                e.preventDefault();
                insertAtCursor('_', '_', '기울임');
            }
        }
    }
</script>

<div class="md-editor">
    <div class="md-toolbar">
        <button
            type="button"
            class="md-tool preview-toggle"
            onclick={() => (showPreview = !showPreview)}
            >{showPreview ? '원문 편집' : '미리보기'}</button
        >
        {#if contentType !== 'html'}
            {#each buttons as b (b.label)}
                <button type="button" class="md-tool" title={b.title} onclick={b.click}>
                    {b.label}
                </button>
            {/each}
        {/if}
    </div>
    <div class="md-split" class:show-preview={showPreview}>
        <textarea
            id="wiki-content-source"
            disabled={!ready}
            aria-label="문서 내용"
            bind:this={textareaEl}
            class="md-textarea"
            placeholder={sourcePlaceholder}
            {value}
            oninput={(e) => update(e.currentTarget.value)}
            onkeydown={onKeyDown}
            spellcheck="false"
        ></textarea>
        <div class="md-preview">
            {#if value}
                <WikiContent content={value} {contentType} {path} existingPaths={existingSet} />
            {:else}
                <p class="md-preview-empty">미리보기는 여기에 표시됩니다.</p>
            {/if}
        </div>
    </div>
</div>

<style>
    .md-editor {
        display: flex;
        flex-direction: column;
        border: 1px solid var(--border, #e5e7eb);
        border-radius: 0.5rem;
        overflow: hidden;
    }
    .md-toolbar {
        display: flex;
        flex-wrap: wrap;
        gap: 0.25rem;
        padding: 0.4rem 0.5rem;
        background: var(--muted, #f8fafc);
        border-bottom: 1px solid var(--border, #e5e7eb);
    }
    .md-tool {
        padding: 0.25rem 0.6rem;
        background: var(--background, white);
        color: var(--foreground, #0f172a);
        border: 1px solid var(--border, #d1d5db);
        border-radius: 0.25rem;
        font-size: 0.8rem;
        cursor: pointer;
        line-height: 1.2;
    }
    .md-tool:hover {
        background: var(--primary, #3366cc);
        color: white;
        border-color: var(--primary, #3366cc);
    }
    .md-split {
        display: grid;
        grid-template-columns: 1fr 1fr;
        min-height: 480px;
        max-height: 70vh;
    }
    .md-textarea {
        width: 100%;
        resize: none;
        padding: 0.75rem 1rem;
        border: 0;
        outline: 0;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.875rem;
        line-height: 1.6;
        border-right: 1px solid var(--border, #e5e7eb);
        background: var(--background, #fafbfc);
        color: var(--foreground, #0f172a);
    }
    .md-preview {
        padding: 0.5rem 1rem;
        overflow-y: auto;
        background: var(--background, white);
        color: var(--foreground, #0f172a);
    }
    .md-preview-empty {
        color: var(--muted-foreground, #6b7280);
        font-size: 0.85rem;
        font-style: italic;
    }
    .md-preview :global(a.wiki-link) {
        color: var(--primary, #3366cc);
        text-decoration: none;
    }
    .md-preview :global(a.wiki-link:hover) {
        text-decoration: underline;
    }
    .md-preview :global(a.wiki-link.red-link) {
        color: #b91c1c;
    }
    .preview-toggle {
        display: none;
    }
    @media (max-width: 768px) {
        .preview-toggle {
            display: block;
        }
        .show-preview .md-textarea {
            display: none;
        }
        .show-preview .md-preview {
            display: block;
        }
        .md-split {
            grid-template-columns: 1fr;
        }
        .md-preview {
            display: none;
        }
    }
</style>
