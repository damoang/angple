<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { Editor } from '@tiptap/core';
    import StarterKit from '@tiptap/starter-kit';
    import Link from '@tiptap/extension-link';
    import Image from '@tiptap/extension-image';
    import Placeholder from '@tiptap/extension-placeholder';
    import Underline from '@tiptap/extension-underline';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle,
        DialogFooter
    } from '$lib/components/ui/dialog/index.js';

    // 아이콘
    import Bold from '@lucide/svelte/icons/bold';
    import Italic from '@lucide/svelte/icons/italic';
    import UnderlineIcon from '@lucide/svelte/icons/underline';
    import Strikethrough from '@lucide/svelte/icons/strikethrough';
    import List from '@lucide/svelte/icons/list';
    import ListOrdered from '@lucide/svelte/icons/list-ordered';
    import Quote from '@lucide/svelte/icons/quote';
    import Code from '@lucide/svelte/icons/code';
    import Heading1 from '@lucide/svelte/icons/heading-1';
    import Heading2 from '@lucide/svelte/icons/heading-2';
    import Heading3 from '@lucide/svelte/icons/heading-3';
    import LinkIcon from '@lucide/svelte/icons/link';
    import ImageIcon from '@lucide/svelte/icons/image';
    import Undo from '@lucide/svelte/icons/undo';
    import Redo from '@lucide/svelte/icons/redo';
    import Minus from '@lucide/svelte/icons/minus';

    interface Props {
        content?: string;
        placeholder?: string;
        disabled?: boolean;
        onUpdate?: (html: string) => void;
        class?: string;
    }

    let {
        content = '',
        placeholder = '내용을 입력하세요...',
        disabled = false,
        onUpdate,
        class: className = ''
    }: Props = $props();

    let editorElement: HTMLDivElement;
    let editor: Editor | null = $state(null);

    // 툴바 상태 (reactive하게 추적)
    let isActive = $state({
        bold: false,
        italic: false,
        underline: false,
        strike: false,
        h1: false,
        h2: false,
        h3: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        link: false
    });

    let canUndo = $state(false);
    let canRedo = $state(false);

    // 링크 다이얼로그
    let showLinkDialog = $state(false);
    let linkUrl = $state('');
    let linkText = $state('');

    // 이미지 다이얼로그
    let showImageDialog = $state(false);
    let imageUrl = $state('');
    let imageAlt = $state('');

    function updateActiveState(): void {
        if (!editor) return;

        isActive = {
            bold: editor.isActive('bold'),
            italic: editor.isActive('italic'),
            underline: editor.isActive('underline'),
            strike: editor.isActive('strike'),
            h1: editor.isActive('heading', { level: 1 }),
            h2: editor.isActive('heading', { level: 2 }),
            h3: editor.isActive('heading', { level: 3 }),
            bulletList: editor.isActive('bulletList'),
            orderedList: editor.isActive('orderedList'),
            blockquote: editor.isActive('blockquote'),
            codeBlock: editor.isActive('codeBlock'),
            link: editor.isActive('link')
        };

        canUndo = editor.can().undo();
        canRedo = editor.can().redo();
    }

    onMount(() => {
        editor = new Editor({
            element: editorElement,
            extensions: [
                StarterKit.configure({
                    heading: {
                        levels: [1, 2, 3]
                    }
                }),
                Link.configure({
                    openOnClick: false,
                    HTMLAttributes: {
                        class: 'text-primary underline'
                    }
                }),
                Image.configure({
                    HTMLAttributes: {
                        class: 'max-w-full rounded-lg'
                    }
                }),
                Placeholder.configure({
                    placeholder
                }),
                Underline
            ],
            content,
            editable: !disabled,
            onUpdate: ({ editor: ed }) => {
                onUpdate?.(ed.getHTML());
                updateActiveState();
            },
            onSelectionUpdate: () => {
                updateActiveState();
            },
            onTransaction: () => {
                updateActiveState();
            }
        });

        updateActiveState();
    });

    onDestroy(() => {
        if (editor) {
            editor.destroy();
        }
    });

    // 에디터 disabled 상태 변경 감지
    $effect(() => {
        if (editor) {
            editor.setEditable(!disabled);
        }
    });

    // 툴바 버튼 클릭 핸들러
    function toggleBold(): void {
        editor?.chain().focus().toggleBold().run();
    }

    function toggleItalic(): void {
        editor?.chain().focus().toggleItalic().run();
    }

    function toggleUnderline(): void {
        editor?.chain().focus().toggleUnderline().run();
    }

    function toggleStrike(): void {
        editor?.chain().focus().toggleStrike().run();
    }

    function toggleHeading(level: 1 | 2 | 3): void {
        editor?.chain().focus().toggleHeading({ level }).run();
    }

    function toggleBulletList(): void {
        editor?.chain().focus().toggleBulletList().run();
    }

    function toggleOrderedList(): void {
        editor?.chain().focus().toggleOrderedList().run();
    }

    function toggleBlockquote(): void {
        editor?.chain().focus().toggleBlockquote().run();
    }

    function toggleCodeBlock(): void {
        editor?.chain().focus().toggleCodeBlock().run();
    }

    function setHorizontalRule(): void {
        editor?.chain().focus().setHorizontalRule().run();
    }

    function undo(): void {
        editor?.chain().focus().undo().run();
    }

    function redo(): void {
        editor?.chain().focus().redo().run();
    }

    // 링크 삽입
    function openLinkDialog(): void {
        const previousUrl = editor?.getAttributes('link').href || '';
        const selection = editor?.state.selection;
        const selectedText =
            selection && !selection.empty
                ? editor?.state.doc.textBetween(selection.from, selection.to, '')
                : '';

        linkUrl = previousUrl;
        linkText = selectedText || '';
        showLinkDialog = true;
    }

    function insertLink(): void {
        if (!linkUrl) {
            showLinkDialog = false;
            return;
        }

        // URL이 http로 시작하지 않으면 https 추가
        const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;

        if (linkText && editor?.state.selection.empty) {
            // 선택 영역이 없고 텍스트가 있으면 텍스트와 함께 링크 삽입
            editor?.chain().focus().insertContent(`<a href="${url}">${linkText}</a>`).run();
        } else {
            // 선택 영역이 있으면 해당 텍스트에 링크 적용
            editor?.chain().focus().setLink({ href: url }).run();
        }

        showLinkDialog = false;
        linkUrl = '';
        linkText = '';
    }

    function removeLink(): void {
        editor?.chain().focus().unsetLink().run();
        showLinkDialog = false;
    }

    // 이미지 삽입
    function openImageDialog(): void {
        imageUrl = '';
        imageAlt = '';
        showImageDialog = true;
    }

    function insertImage(): void {
        if (!imageUrl) {
            showImageDialog = false;
            return;
        }

        editor
            ?.chain()
            .focus()
            .setImage({ src: imageUrl, alt: imageAlt || '' })
            .run();

        showImageDialog = false;
        imageUrl = '';
        imageAlt = '';
    }

    // 버튼 공통 클래스
    function getButtonClass(active: boolean): string {
        return active ? 'bg-muted' : '';
    }

    // HTML 내용 가져오기 (외부에서 호출용)
    export function getContent(): string {
        return editor?.getHTML() || '';
    }

    // HTML 내용 설정 (외부에서 호출용)
    export function setContent(html: string): void {
        editor?.commands.setContent(html);
    }
</script>

<div class="tiptap-editor border-input rounded-md border {className}">
    <!-- 툴바 -->
    <div
        class="border-border bg-muted/50 flex flex-wrap items-center gap-1 border-b p-2"
        role="toolbar"
        aria-label="텍스트 편집 도구"
    >
        <!-- 실행 취소/다시 실행 -->
        <div class="flex items-center gap-0.5">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={undo}
                disabled={disabled || !canUndo}
                class="h-8 w-8 p-0"
                title="실행 취소"
            >
                <Undo class="h-4 w-4" />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={redo}
                disabled={disabled || !canRedo}
                class="h-8 w-8 p-0"
                title="다시 실행"
            >
                <Redo class="h-4 w-4" />
            </Button>
        </div>

        <div class="bg-border mx-1 h-6 w-px" role="separator"></div>

        <!-- 헤딩 -->
        <div class="flex items-center gap-0.5">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={() => toggleHeading(1)}
                {disabled}
                class="h-8 w-8 p-0 {getButtonClass(isActive.h1)}"
                title="제목 1"
            >
                <Heading1 class="h-4 w-4" />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={() => toggleHeading(2)}
                {disabled}
                class="h-8 w-8 p-0 {getButtonClass(isActive.h2)}"
                title="제목 2"
            >
                <Heading2 class="h-4 w-4" />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={() => toggleHeading(3)}
                {disabled}
                class="h-8 w-8 p-0 {getButtonClass(isActive.h3)}"
                title="제목 3"
            >
                <Heading3 class="h-4 w-4" />
            </Button>
        </div>

        <div class="bg-border mx-1 h-6 w-px" role="separator"></div>

        <!-- 텍스트 스타일 -->
        <div class="flex items-center gap-0.5">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={toggleBold}
                {disabled}
                class="h-8 w-8 p-0 {getButtonClass(isActive.bold)}"
                title="굵게 (Ctrl+B)"
            >
                <Bold class="h-4 w-4" />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={toggleItalic}
                {disabled}
                class="h-8 w-8 p-0 {getButtonClass(isActive.italic)}"
                title="기울임 (Ctrl+I)"
            >
                <Italic class="h-4 w-4" />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={toggleUnderline}
                {disabled}
                class="h-8 w-8 p-0 {getButtonClass(isActive.underline)}"
                title="밑줄 (Ctrl+U)"
            >
                <UnderlineIcon class="h-4 w-4" />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={toggleStrike}
                {disabled}
                class="h-8 w-8 p-0 {getButtonClass(isActive.strike)}"
                title="취소선"
            >
                <Strikethrough class="h-4 w-4" />
            </Button>
        </div>

        <div class="bg-border mx-1 h-6 w-px" role="separator"></div>

        <!-- 목록 -->
        <div class="flex items-center gap-0.5">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={toggleBulletList}
                {disabled}
                class="h-8 w-8 p-0 {getButtonClass(isActive.bulletList)}"
                title="글머리 기호 목록"
            >
                <List class="h-4 w-4" />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={toggleOrderedList}
                {disabled}
                class="h-8 w-8 p-0 {getButtonClass(isActive.orderedList)}"
                title="번호 매기기 목록"
            >
                <ListOrdered class="h-4 w-4" />
            </Button>
        </div>

        <div class="bg-border mx-1 h-6 w-px" role="separator"></div>

        <!-- 블록 요소 -->
        <div class="flex items-center gap-0.5">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={toggleBlockquote}
                {disabled}
                class="h-8 w-8 p-0 {getButtonClass(isActive.blockquote)}"
                title="인용문"
            >
                <Quote class="h-4 w-4" />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={toggleCodeBlock}
                {disabled}
                class="h-8 w-8 p-0 {getButtonClass(isActive.codeBlock)}"
                title="코드 블록"
            >
                <Code class="h-4 w-4" />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={setHorizontalRule}
                {disabled}
                class="h-8 w-8 p-0"
                title="가로줄"
            >
                <Minus class="h-4 w-4" />
            </Button>
        </div>

        <div class="bg-border mx-1 h-6 w-px" role="separator"></div>

        <!-- 미디어 -->
        <div class="flex items-center gap-0.5">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={openLinkDialog}
                {disabled}
                class="h-8 w-8 p-0 {getButtonClass(isActive.link)}"
                title="링크 삽입"
            >
                <LinkIcon class="h-4 w-4" />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={openImageDialog}
                {disabled}
                class="h-8 w-8 p-0"
                title="이미지 삽입"
            >
                <ImageIcon class="h-4 w-4" />
            </Button>
        </div>
    </div>

    <!-- 에디터 영역 -->
    <div class="tiptap-content min-h-[300px] p-4" bind:this={editorElement}></div>
</div>

<!-- 링크 다이얼로그 -->
<Dialog bind:open={showLinkDialog}>
    <DialogContent class="sm:max-w-md">
        <DialogHeader>
            <DialogTitle>링크 삽입</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
            <div class="space-y-2">
                <label for="link-url" class="text-sm font-medium">URL</label>
                <Input
                    id="link-url"
                    type="url"
                    bind:value={linkUrl}
                    placeholder="https://example.com"
                />
            </div>
            <div class="space-y-2">
                <label for="link-text" class="text-sm font-medium">표시 텍스트 (선택사항)</label>
                <Input id="link-text" type="text" bind:value={linkText} placeholder="링크 텍스트" />
            </div>
        </div>
        <DialogFooter class="flex gap-2">
            {#if isActive.link}
                <Button type="button" variant="destructive" onclick={removeLink}>링크 제거</Button>
            {/if}
            <Button type="button" variant="outline" onclick={() => (showLinkDialog = false)}>
                취소
            </Button>
            <Button type="button" onclick={insertLink}>삽입</Button>
        </DialogFooter>
    </DialogContent>
</Dialog>

<!-- 이미지 다이얼로그 -->
<Dialog bind:open={showImageDialog}>
    <DialogContent class="sm:max-w-md">
        <DialogHeader>
            <DialogTitle>이미지 삽입</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
            <div class="space-y-2">
                <label for="image-url" class="text-sm font-medium">이미지 URL</label>
                <Input
                    id="image-url"
                    type="url"
                    bind:value={imageUrl}
                    placeholder="https://example.com/image.jpg"
                />
            </div>
            <div class="space-y-2">
                <label for="image-alt" class="text-sm font-medium">대체 텍스트 (선택사항)</label>
                <Input id="image-alt" type="text" bind:value={imageAlt} placeholder="이미지 설명" />
            </div>
        </div>
        <DialogFooter>
            <Button type="button" variant="outline" onclick={() => (showImageDialog = false)}>
                취소
            </Button>
            <Button type="button" onclick={insertImage}>삽입</Button>
        </DialogFooter>
    </DialogContent>
</Dialog>

<style>
    /* TipTap 에디터 기본 스타일 */
    :global(.tiptap-content .tiptap) {
        outline: none;
        min-height: 250px;
    }

    :global(.tiptap-content .tiptap p.is-editor-empty:first-child::before) {
        color: var(--muted-foreground);
        content: attr(data-placeholder);
        float: left;
        height: 0;
        pointer-events: none;
    }

    /* 헤딩 스타일 */
    :global(.tiptap-content .tiptap h1) {
        font-size: 2rem;
        font-weight: 700;
        margin-top: 1.5rem;
        margin-bottom: 0.75rem;
    }

    :global(.tiptap-content .tiptap h2) {
        font-size: 1.5rem;
        font-weight: 600;
        margin-top: 1.25rem;
        margin-bottom: 0.5rem;
    }

    :global(.tiptap-content .tiptap h3) {
        font-size: 1.25rem;
        font-weight: 600;
        margin-top: 1rem;
        margin-bottom: 0.5rem;
    }

    /* 문단 스타일 */
    :global(.tiptap-content .tiptap p) {
        margin-bottom: 0.75rem;
    }

    /* 목록 스타일 */
    :global(.tiptap-content .tiptap ul) {
        list-style-type: disc;
        padding-left: 1.5rem;
        margin-bottom: 0.75rem;
    }

    :global(.tiptap-content .tiptap ol) {
        list-style-type: decimal;
        padding-left: 1.5rem;
        margin-bottom: 0.75rem;
    }

    :global(.tiptap-content .tiptap li) {
        margin-bottom: 0.25rem;
    }

    /* 인용문 스타일 */
    :global(.tiptap-content .tiptap blockquote) {
        border-left: 4px solid var(--border);
        padding-left: 1rem;
        margin-left: 0;
        margin-bottom: 0.75rem;
        font-style: italic;
        color: var(--muted-foreground);
    }

    /* 코드 블록 스타일 */
    :global(.tiptap-content .tiptap pre) {
        background-color: var(--muted);
        border-radius: 0.375rem;
        padding: 1rem;
        margin-bottom: 0.75rem;
        overflow-x: auto;
    }

    :global(.tiptap-content .tiptap code) {
        font-family: ui-monospace, SFMono-Regular, 'SF Mono', Consolas, 'Liberation Mono', Menlo,
            monospace;
        font-size: 0.875rem;
    }

    /* 인라인 코드 */
    :global(.tiptap-content .tiptap p code) {
        background-color: var(--muted);
        padding: 0.125rem 0.375rem;
        border-radius: 0.25rem;
    }

    /* 수평선 스타일 */
    :global(.tiptap-content .tiptap hr) {
        border: none;
        border-top: 1px solid var(--border);
        margin: 1.5rem 0;
    }

    /* 이미지 스타일 */
    :global(.tiptap-content .tiptap img) {
        max-width: 100%;
        height: auto;
        margin: 0.75rem 0;
    }

    /* 링크 스타일 */
    :global(.tiptap-content .tiptap a) {
        color: var(--primary);
        text-decoration: underline;
    }

    :global(.tiptap-content .tiptap a:hover) {
        opacity: 0.8;
    }
</style>
