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
    import { SpoilerInline } from '$lib/components/features/editor/spoiler-mark';
    import { watchCommentInput, stopWatch } from '$lib/services/comment-input-telemetry';
    import MannerTip from '$lib/components/features/editor/manner-tip.svelte';
    import Bold from '@lucide/svelte/icons/bold';
    import Italic from '@lucide/svelte/icons/italic';
    import EyeOff from '@lucide/svelte/icons/eye-off';

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
    /** 이 에디터에서 첫 글자를 입력했는가 — 작성 매너 풍선 발화 신호 */
    let hasTyped = $state(false);
    let editor: Editor | null = null;
    let isBold = $state(false);
    let isItalic = $state(false);
    let isSpoiler = $state(false);

    // #13669 — 앱(웹뷰)에서 지연로딩된 에디터에 프로그래밍 방식으로 focus 가 넘어오면,
    // 브라우저의 "포커스된 입력을 키보드 위로 스크롤" 휴리스틱이 발동하지 않아 입력창이
    // 소프트 키보드 뒤에 잔류한다. focus 시 입력창을 키보드 위로 직접 스크롤해 보정한다.
    // - browser(클라이언트)에서만 실행(onFocus 는 DOM 이벤트라 항상 클라이언트).
    // - visualViewport 가 있으면(모바일/웹뷰) 가시영역 기준으로 판단, 없으면 innerHeight 폴백.
    // - 이미 가시영역 안이면 스크롤하지 않는다 → 데스크톱·비키보드 환경에서 무해(불필요한 점프 없음).
    // - 키보드가 뒤늦게 올라와 뷰포트가 줄어드는 웹뷰를 위해 resize 1회만 추가 보정(자기해제).
    function scrollEditorAboveKeyboard(): void {
        if (typeof window === 'undefined' || !editorElement) return;
        const el = editorElement;
        const vv = window.visualViewport;

        const doScroll = () => {
            const rect = el.getBoundingClientRect();
            const visibleBottom = vv ? vv.height : window.innerHeight;
            // 입력창 하단이 가시영역 안이고 상단이 위로 잘리지 않았으면 이미 보이는 것 → 스크롤 안 함.
            if (rect.bottom <= visibleBottom && rect.top >= 0) return;
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        };

        // 포커스 직후 레이아웃 안정 후 1회 보정.
        requestAnimationFrame(doScroll);

        // 키보드가 늦게 올라와 visualViewport 가 줄어드는 순간 한 번 더 보정한다.
        // 첫 resize 에서 스스로 해제하고, 키보드가 안 올라오는 환경(데스크톱)에서도
        // 1초 뒤 반드시 해제해 리스너가 누적되지 않게 한다.
        if (vv) {
            const onResize = () => {
                vv.removeEventListener('resize', onResize);
                doScroll();
            };
            vv.addEventListener('resize', onResize);
            setTimeout(() => vv.removeEventListener('resize', onResize), 1000);
        }
    }

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
                // #12439: 댓글 자동 링크에 시각 표시 강제 — 사용자가 selected text 에
                // URL 을 paste 했을 때 링크화된 텍스트가 외형 변화 없이 들어가는 케이스를 차단.
                Link.configure({
                    openOnClick: false,
                    HTMLAttributes: {
                        class: 'text-primary underline decoration-primary/60 underline-offset-2',
                        'data-comment-autolink': 'true'
                    }
                }),
                Placeholder.configure({ placeholder }),
                Mention.configure({
                    HTMLAttributes: { class: 'mention' },
                    suggestion: mentionSuggestion
                }),
                // 부분(인라인) 스포일러 — 본문 에디터와 동일. 댓글 렌더는 이미 dm-spoiler
                // 클릭 공개를 지원한다(comment-list.svelte).
                SpoilerInline
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
                // 첫 글자가 들어온 순간 작성 매너 풍선을 띄운다(하루 1회, 글쓰기와 공유).
                // ProseMirror 트랜잭션 중 $state 를 바꾸면 state_unsafe_mutation 이 나므로
                // 아래 onTransaction 과 같은 규약으로 트랜잭션 밖에서 처리한다.
                if (!hasTyped && !e.isEmpty) {
                    setTimeout(() => (hasTyped = true), 0);
                }
            },
            onFocus: () => {
                // #12939/#13045 — 작성 중 키보드가 내려가는 현상 진단.
                // 포커스 중에만 관측하고, 이상 이탈일 때만 1회 전송한다(평상시 비용 0).
                if (editorElement) watchCommentInput(editorElement);
                // #13669 — 프로그래밍 focus 시 입력창을 소프트 키보드 위로 스크롤(작성·수정 폼 공통).
                scrollEditorAboveKeyboard();
            },
            onTransaction: ({ editor: e }) => {
                // ProseMirror 트랜잭션은 Svelte 렌더/effect 중 동기 호출될 수 있어, 여기서
                // $state 를 직접 변이하면 state_unsafe_mutation 발생(/free·홈 다수). microtask 로
                // 반응 컨텍스트 밖에서 갱신한다(툴바 표시는 사실상 즉시).
                const b = e.isActive('bold');
                const i = e.isActive('italic');
                const s = e.isActive('spoilerInline');
                queueMicrotask(() => {
                    isBold = b;
                    isItalic = i;
                    isSpoiler = s;
                });
            }
        });
    });

    $effect(() => {
        editor?.setEditable(!disabled);
    });

    onDestroy(() => {
        stopWatch();
        editor?.destroy();
    });

    function toggleBold(): void {
        editor?.chain().focus().toggleBold().run();
    }

    function toggleItalic(): void {
        editor?.chain().focus().toggleItalic().run();
    }

    function toggleSpoiler(): void {
        editor?.chain().focus().toggleSpoilerInline().run();
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
        editor?.commands.unsetLink();
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
        <button
            type="button"
            class="hover:bg-accent rounded p-1 transition-colors {isSpoiler
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground'}"
            onclick={toggleSpoiler}
            title="모자이크 — 선택한 부분을 가립니다 (읽는 쪽에서 클릭으로 공개)"
            {disabled}
        >
            <EyeOff class="size-3.5" />
        </button>
    </div>
    <!--
        작성 매너 풍선 — 첫 글자 입력 시 댓글 입력창 위에 잠깐 떠오른다(하루 1회).
        relative 래퍼가 기준점. absolute + pointer-events-none 이라 레이아웃도
        클릭도 방해하지 않는다.
    -->
    <div class="relative">
        <MannerTip show={hasTyped} placement="above" scope="comment" />
        <div bind:this={editorElement}></div>
    </div>
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
        font-size: var(--editor-font-size, 1rem);
        line-height: 1.6;
    }

    /* 인라인 스포일러 — 에디터에선 가리지 않고 "표시만"(작성 중 읽어야 하므로).
       본문 에디터(tiptap-editor.svelte)와 동일한 점선 테두리+옅은 배경으로,
       모바일에서도 적용 여부가 한눈에 보이게 한다. 뷰의 실제 가림은
       comment-list(.comment-body)·markdown(.prose)에 별도. */
    .comment-editor :global(.tiptap span.dm-spoiler) {
        background: color-mix(in srgb, currentColor 12%, transparent);
        outline: 1px dashed color-mix(in srgb, currentColor 45%, transparent);
        outline-offset: 1px;
        border-radius: 3px;
    }
</style>
