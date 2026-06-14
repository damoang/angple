<script lang="ts">
    import { Markdown } from '$lib/components/ui/markdown/index.js';

    interface Props {
        value: string;
        placeholder?: string;
        existingWikilinkPaths?: string[];
        onChange?: (v: string) => void;
    }

    let {
        value = $bindable(''),
        placeholder = '마크다운으로 작성하세요. 위키링크는 [[문서명]] 형식입니다.',
        existingWikilinkPaths = [],
        onChange
    }: Props = $props();

    let preview = $state(value);
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let textareaEl: HTMLTextAreaElement | undefined = $state();

    const existingSet = $derived(new Set(existingWikilinkPaths));

    function encodePath(p: string): string {
        const trimmed = p.replace(/^\/+/, '');
        return '/' + trimmed.split('/').map(encodeURIComponent).join('/');
    }

    // 미리보기 단계의 [[..]] 변환 — 메인 페이지 transformWikilinks 와 동일 로직
    function transform(content: string): string {
        if (!content) return content;
        const placeholders: string[] = [];
        let stripped = content.replace(/```[\s\S]*?```|`[^`\n]+`/g, (m) => {
            placeholders.push(m);
            return `\x00CODE${placeholders.length - 1}\x00`;
        });
        stripped = stripped.replace(
            /\[\[([^\]\n|]+?)(?:\|([^\]\n]+))?\]\]/g,
            (full, raw: string, label?: string) => {
                const trimmed = raw.trim();
                if (!trimmed) return full;
                const path = trimmed.startsWith('/') ? trimmed : '/' + trimmed;
                const display = (label?.trim() || trimmed.replace(/^\//, '').replace(/_/g, ' '))
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                const exists = existingSet.has(path);
                const href = encodePath(path);
                const cls = exists ? 'wiki-link' : 'wiki-link red-link';
                return `<a class="${cls}" href="${href}">${display}</a>`;
            }
        );
        return stripped.replace(/\x00CODE(\d+)\x00/g, (_, i) => placeholders[parseInt(i, 10)]);
    }

    function update(v: string) {
        value = v;
        onChange?.(v);
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            preview = transform(v);
        }, 150);
    }

    function insertAtCursor(before: string, after = before, placeholderText = '') {
        if (!textareaEl) return;
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
        {#each buttons as b (b.label)}
            <button type="button" class="md-tool" title={b.title} onclick={b.click}>
                {b.label}
            </button>
        {/each}
    </div>
    <div class="md-split">
        <textarea
            bind:this={textareaEl}
            class="md-textarea"
            {placeholder}
            {value}
            oninput={(e) => update(e.currentTarget.value)}
            onkeydown={onKeyDown}
            spellcheck="false"
        ></textarea>
        <div class="md-preview">
            {#if preview}
                <Markdown content={preview} />
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
        background: white;
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
        background: #fafbfc;
        color: var(--foreground, #0f172a);
    }
    .md-preview {
        padding: 0.5rem 1rem;
        overflow-y: auto;
        background: white;
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
    @media (max-width: 768px) {
        .md-split {
            grid-template-columns: 1fr;
        }
        .md-preview {
            display: none;
        }
    }
</style>
