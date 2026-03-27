<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { Editor } from '@tiptap/core';
    import StarterKit from '@tiptap/starter-kit';
    import BoldExtension from '@tiptap/extension-bold';
    import ItalicExtension from '@tiptap/extension-italic';
    import Image from '@tiptap/extension-image';
    import Link from '@tiptap/extension-link';
    import Placeholder from '@tiptap/extension-placeholder';
    import Mention from '@tiptap/extension-mention';
    import { mentionSuggestion } from '$lib/components/features/editor/mention-suggestion';
    import Bold from '@lucide/svelte/icons/bold';
    import Italic from '@lucide/svelte/icons/italic';

    interface Props {
        content?: string;
        placeholder?: string;
        disabled?: boolean;
        onUpdate?: (html: string) => void;
        onImagePaste?: (file: File) => void;
        onSubmitShortcut?: () => void;
        class?: string;
    }

    let {
        content = '',
        placeholder = '댓글을 입력하세요...',
        disabled = false,
        onUpdate,
        onImagePaste,
        onSubmitShortcut,
        class: className = ''
    }: Props = $props();

    let editorElement = $state<HTMLDivElement | null>(null);
    let editor: Editor | null = null;
    let isBold = $state(false);
    let isItalic = $state(false);

    onMount(() => {
        if (!editorElement) return;

        editor = new Editor({
            element: editorElement,
            extensions: [
                StarterKit.configure({
                    heading: false,
                    bulletList: false,
                    orderedList: false,
                    blockquote: false,
                    codeBlock: false,
                    code: false,
                    strike: false,
                    horizontalRule: false,
                    dropcursor: false,
                    gapcursor: false,
                    bold: false,
                    italic: false
                }),
                BoldExtension.extend({
                    addInputRules() {
                        return [];
                    }
                }),
                ItalicExtension.extend({
                    addInputRules() {
                        return [];
                    }
                }),
                Image.configure({ inline: true, allowBase64: false }),
                Link.configure({ openOnClick: false }),
                Placeholder.configure({ placeholder }),
                Mention.configure({
                    HTMLAttributes: { class: 'mention' },
                    suggestion: mentionSuggestion
                })
            ],
            content: content || '',
            editable: !disabled,
            editorProps: {
                attributes: {
                    class: 'prose-sm'
                },
                handleKeyDown: (_view, event) => {
                    if ((event.altKey || event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                        event.preventDefault();
                        onSubmitShortcut?.();
                        return true;
                    }
                    return false;
                },
                handlePaste: (_view, event) => {
                    const items = event.clipboardData?.items;
                    if (items) {
                        for (const item of items) {
                            if (item.type.startsWith('image/')) {
                                event.preventDefault();
                                const file = item.getAsFile();
                                if (file) onImagePaste?.(file);
                                return true;
                            }
                        }
                    }
                    return false;
                }
            },
            onUpdate: ({ editor: e }) => {
                onUpdate?.(e.getHTML());
            },
            onTransaction: ({ editor: e }) => {
                isBold = e.isActive('bold');
                isItalic = e.isActive('italic');
            }
        });
    });

    $effect(() => {
        editor?.setEditable(!disabled);
    });

    onDestroy(() => {
        editor?.destroy();
    });

    function toggleBold(): void {
        editor?.chain().focus().toggleBold().run();
    }

    function toggleItalic(): void {
        editor?.chain().focus().toggleItalic().run();
    }

    export function insertContent(text: string): void {
        if (!editor) return;
        editor.chain().focus().insertContent(text).run();
    }

    export function insertImage(src: string, alt?: string): void {
        if (!editor) return;
        editor
            .chain()
            .focus()
            .setImage({ src, alt: alt || '' })
            .run();
    }

    export function getHTML(): string {
        return editor?.getHTML() ?? '';
    }

    export function clear(): void {
        editor?.commands.clearContent(true);
    }

    export function focus(): void {
        editor?.commands.focus();
    }

    export function getImageCount(): number {
        if (!editor) return 0;
        let count = 0;
        editor.state.doc.descendants((node) => {
            if (node.type.name === 'image') count++;
        });
        return count;
    }
</script>

<div
    class="comment-editor border-border bg-background focus-within:border-primary focus-within:ring-primary rounded-lg border focus-within:ring-1 {className}"
>
    <div class="border-border flex items-center gap-0.5 border-b px-1.5 py-1">
        <button
            type="button"
            class="hover:bg-accent rounded p-1 transition-colors {isBold
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground'}"
            onclick={toggleBold}
            title="굵게 (Ctrl+B)"
            {disabled}
        >
            <Bold class="size-3.5" />
        </button>
        <button
            type="button"
            class="hover:bg-accent rounded p-1 transition-colors {isItalic
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground'}"
            onclick={toggleItalic}
            title="기울임 (Ctrl+I)"
            {disabled}
        >
            <Italic class="size-3.5" />
        </button>
    </div>
    <div bind:this={editorElement}></div>
</div>

<style>
    .comment-editor :global(.tiptap) {
        outline: none;
        padding: 0.5rem 0.75rem;
        min-height: 5rem;
        max-height: 40vh;
        overflow-y: auto;
        overflow-x: hidden;
        word-break: break-word;
        font-size: 0.9375rem;
        line-height: 1.6;
    }
</style>
