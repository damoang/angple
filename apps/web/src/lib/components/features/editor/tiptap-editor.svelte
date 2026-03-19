<script lang="ts">
    import { onMount, onDestroy, tick } from 'svelte';
    import { Editor } from '@tiptap/core';
    import StarterKit from '@tiptap/starter-kit';
    import BoldExtension from '@tiptap/extension-bold';
    import ItalicExtension from '@tiptap/extension-italic';
    import Link from '@tiptap/extension-link';
    import { LinkedImage } from './linked-image.js';
    import Placeholder from '@tiptap/extension-placeholder';
    import Underline from '@tiptap/extension-underline';
    import Mention from '@tiptap/extension-mention';
    import { Table } from '@tiptap/extension-table';
    import { TableRow } from '@tiptap/extension-table-row';
    import { TableHeader } from '@tiptap/extension-table-header';
    import { TableCell } from '@tiptap/extension-table-cell';
    import { Youtube } from '@tiptap/extension-youtube';
    import { CharacterCount } from '@tiptap/extension-character-count';
    import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
    import { common, createLowlight } from 'lowlight';
    import { mentionSuggestion } from './mention-suggestion.js';
    import {
        SlashCommand,
        createSlashCommandItems,
        type SlashCommandItem
    } from './slash-command.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import {
        Dialog,
        DialogContent,
        DialogHeader,
        DialogTitle,
        DialogFooter
    } from '$lib/components/ui/dialog/index.js';
    import { marked } from 'marked';
    import TurndownService from 'turndown';
    import { isImageFile } from '$lib/utils/image-convert.js';

    const lowlight = createLowlight(common);
    const turndown = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced'
    });

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
    import TableIcon from '@lucide/svelte/icons/table';
    import YoutubeIcon from '@lucide/svelte/icons/youtube';
    import Upload from '@lucide/svelte/icons/upload';
    import Columns from '@lucide/svelte/icons/columns-3';
    import Rows from '@lucide/svelte/icons/rows-3';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import PilcrowIcon from '@lucide/svelte/icons/pilcrow';
    import FileCodeIcon from '@lucide/svelte/icons/file-code';
    import HashIcon from '@lucide/svelte/icons/hash';
    import SmileIcon from '@lucide/svelte/icons/smile';
    import type { Component } from 'svelte';

    interface Props {
        content?: string;
        placeholder?: string;
        disabled?: boolean;
        onUpdate?: (html: string) => void;
        onImageUpload?: (file: File) => Promise<string | null>;
        class?: string;
    }

    let {
        content = '',
        placeholder = '/ 를 눌러 이미지와 앙티콘을 추가하세요',
        disabled = false,
        onUpdate,
        onImageUpload,
        class: className = ''
    }: Props = $props();

    let isUploading = $state(false);

    // 에디터 모드 (WYSIWYG, Markdown, HTML)
    type EditorMode = 'wysiwyg' | 'markdown' | 'html';
    let editorMode = $state<EditorMode>('wysiwyg');
    let rawContent = $state(''); // 마크다운/HTML 직접 편집용

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

    // 이미지 링크 다이얼로그
    let showImageLinkDialog = $state(false);
    let imageLinkUrl = $state('');

    // 이미지 다이얼로그
    let showImageDialog = $state(false);
    let imageUrl = $state('');
    let imageAlt = $state('');

    // YouTube 다이얼로그
    let showYoutubeDialog = $state(false);
    let youtubeUrl = $state('');

    // 테이블 메뉴
    let showTableMenu = $state(false);

    // 앙티콘 피커
    let showEmoticonPicker = $state(false);
    let EmoticonPickerComponent = $state<Component<{
        onInsertEmoticon: (text: string) => void;
        onClose: () => void;
    }> | null>(null);

    // 글자 수
    let charCount = $state(0);
    let wordCount = $state(0);

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
                    },
                    codeBlock: false, // CodeBlockLowlight로 대체
                    bold: false, // 마크다운 input rule 제거 위해 별도 추가
                    italic: false // *^^* 등 입력 시 이탤릭 자동변환 방지
                }),
                // Bold/Italic: 툴바 기능은 유지, 마크다운 자동변환(**bold**, *italic*)만 비활성화
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
                Link.configure({
                    openOnClick: false,
                    HTMLAttributes: {
                        class: 'text-primary underline'
                    }
                }),
                LinkedImage.configure({
                    inline: false,
                    allowBase64: true,
                    HTMLAttributes: {
                        class: 'max-w-full rounded-lg'
                    }
                }),
                Placeholder.configure({
                    placeholder
                }),
                Underline,
                Mention.configure({
                    HTMLAttributes: {
                        class: 'mention-node text-primary font-medium'
                    },
                    suggestion: mentionSuggestion,
                    renderText({ node }) {
                        return `@${node.attrs.label ?? node.attrs.id}`;
                    }
                }),
                Table.configure({
                    resizable: true,
                    HTMLAttributes: {
                        class: 'tiptap-table'
                    }
                }),
                TableRow,
                TableHeader,
                TableCell,
                Youtube.configure({
                    HTMLAttributes: {
                        class: 'tiptap-youtube'
                    },
                    inline: false
                }),
                CharacterCount,
                CodeBlockLowlight.configure({
                    lowlight,
                    HTMLAttributes: {
                        class: 'tiptap-code-block'
                    }
                }),
                SlashCommand.configure({
                    suggestion: {
                        items: ({ query }: { query: string }): SlashCommandItem[] => {
                            const allItems = createSlashCommandItems({
                                onImageUpload: () => openImageDialog(),
                                onEmoticon: () => toggleEmoticonPicker(),
                                onYoutube: () => openYoutubeDialog()
                            });
                            if (!query) return allItems;
                            const q = query.toLowerCase();
                            return allItems.filter(
                                (item) =>
                                    item.title.toLowerCase().includes(q) ||
                                    item.description.toLowerCase().includes(q)
                            );
                        }
                    }
                })
            ],
            content,
            editable: !disabled,
            onUpdate: ({ editor: ed }) => {
                onUpdate?.(ed.getHTML());
                updateActiveState();
                updateCounts(ed);
            },
            onSelectionUpdate: () => {
                updateActiveState();
            },
            onTransaction: () => {
                setTimeout(() => updateActiveState(), 0);
            }
        });

        updateActiveState();
        updateCounts(editor);
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

    // content prop 변경 감지 (edit mode에서 비동기 로드 시)
    // 이전 content 값을 추적 (일반 변수로 - $state 아님)
    let lastLoadedContent = '';
    let isSettingContent = false;

    $effect(() => {
        if (!editor) return;
        const c = content ?? '';
        if (!c || c === lastLoadedContent) return;

        // 에디터에 이미 사용자 입력이 있으면 덮어쓰지 않음
        const currentHtml = editor.getHTML();
        const editorHasContent =
            currentHtml !== '' && currentHtml !== '<p></p>' && currentHtml !== lastLoadedContent;
        if (editorHasContent && lastLoadedContent !== '') {
            lastLoadedContent = c;
            return;
        }

        // 비동기 로드된 content를 에디터에 반영
        isSettingContent = true;
        editor.commands.setContent(c);
        isSettingContent = false;
        lastLoadedContent = c;
    });

    // 이미지 파일 업로드 처리 (커서 위치에 삽입)
    async function handleImageFile(file: File): Promise<void> {
        if (!onImageUpload || !editor) return;
        if (!isImageFile(file)) return;

        isUploading = true;
        try {
            const imageUrl = await onImageUpload(file);
            if (imageUrl) {
                editor.chain().focus().setImage({ src: imageUrl }).run();
            }
        } catch (err) {
            console.error('Image upload failed:', err);
        } finally {
            isUploading = false;
        }
    }

    // 특정 위치에 이미지 삽입 (드래그 앤 드롭용)
    async function handleImageFileAtPosition(file: File, pos: number): Promise<void> {
        if (!onImageUpload || !editor) return;
        if (!isImageFile(file)) return;

        isUploading = true;
        try {
            const imageUrl = await onImageUpload(file);
            if (imageUrl) {
                // 특정 위치에 이미지 삽입 (기존 내용 유지)
                editor
                    .chain()
                    .insertContentAt(pos, { type: 'image', attrs: { src: imageUrl } })
                    .run();
            }
        } catch (err) {
            console.error('Image upload failed:', err);
        } finally {
            isUploading = false;
        }
    }

    // 드래그 앤 드롭 핸들러 (드롭 위치에 이미지/동영상 삽입)
    async function handleDrop(e: DragEvent): Promise<void> {
        if (!onImageUpload || disabled || !editor) return;

        const files = e.dataTransfer?.files;
        if (!files?.length) return;

        const mediaFiles = Array.from(files).filter(
            (f) => isImageFile(f) || f.type.startsWith('video/')
        );
        if (mediaFiles.length > 0) {
            e.preventDefault();
            e.stopImmediatePropagation();

            // 드롭 위치에서 에디터 좌표 계산
            const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
            const insertPos = pos?.pos ?? editor.state.selection.from;

            for (let i = 0; i < mediaFiles.length; i++) {
                const file = mediaFiles[i];
                if (file.type.startsWith('video/')) {
                    isUploading = true;
                    try {
                        const videoUrl = await onImageUpload(file);
                        if (videoUrl) {
                            editor
                                .chain()
                                .focus()
                                .insertContentAt(insertPos + i, {
                                    type: 'paragraph',
                                    content: []
                                })
                                .insertContent(
                                    `<video src="${videoUrl}" controls playsinline preload="metadata" style="max-width:100%;border-radius:8px;"></video>`
                                )
                                .run();
                        }
                    } catch (err) {
                        console.error('Video upload failed:', err);
                    } finally {
                        isUploading = false;
                    }
                } else {
                    await handleImageFileAtPosition(file, insertPos + i);
                }
            }
        }
    }

    // 붙여넣기 핸들러
    function handlePaste(e: ClipboardEvent): void {
        if (!onImageUpload || disabled) return;

        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (
                item.type.startsWith('image/') ||
                item.type === 'image/heic' ||
                item.type === 'image/heif'
            ) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) handleImageFile(file);
                break;
            }
        }
    }

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
        if (!editor) return;
        // 다중 블록 선택 시 현재 커서 위치의 블록만 변환
        const { from, to } = editor.state.selection;
        if (from !== to) {
            const resolved = editor.state.doc.resolve(from);
            const blockEnd = resolved.end();
            editor
                .chain()
                .focus()
                .setTextSelection({ from, to: Math.min(to, blockEnd) })
                .toggleHeading({ level })
                .run();
        } else {
            editor.chain().focus().toggleHeading({ level }).run();
        }
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
        // 이미지가 선택된 경우 이미지 링크 다이얼로그 열기
        if (editor?.isActive('image')) {
            const imgAttrs = editor.getAttributes('image');
            imageLinkUrl = imgAttrs.href || '';
            showImageLinkDialog = true;
            return;
        }

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

    // 이미지 링크 삽입
    function insertImageLink(): void {
        if (!imageLinkUrl || !editor) {
            showImageLinkDialog = false;
            return;
        }
        const url =
            imageLinkUrl.startsWith('http') || imageLinkUrl.startsWith('tel:')
                ? imageLinkUrl
                : `https://${imageLinkUrl}`;
        editor.chain().focus().updateAttributes('image', { href: url, linkTarget: '_blank' }).run();
        showImageLinkDialog = false;
        imageLinkUrl = '';
    }

    function removeImageLink(): void {
        editor?.chain().focus().updateAttributes('image', { href: null, linkTarget: null }).run();
        showImageLinkDialog = false;
        imageLinkUrl = '';
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

    // 다이얼로그에서 파일 선택 시 이미지 업로드 (복수 선택 지원)
    async function handleImageFileFromDialog(e: Event): Promise<void> {
        const input = e.currentTarget as HTMLInputElement;
        const files = input.files;
        if (!files?.length) return;

        for (const file of Array.from(files)) {
            if (isImageFile(file)) {
                await handleImageFile(file);
            }
        }

        showImageDialog = false;
        input.value = '';
    }

    // 다이얼로그 드래그앤드롭 상태
    let imageDialogDragOver = $state(false);

    // 다이얼로그 내 드래그앤드롭 이미지 업로드
    async function handleImageDialogDrop(e: DragEvent): Promise<void> {
        e.preventDefault();
        imageDialogDragOver = false;
        const files = e.dataTransfer?.files;
        if (!files?.length) return;

        for (const file of Array.from(files)) {
            if (isImageFile(file)) {
                await handleImageFile(file);
            }
        }

        showImageDialog = false;
    }

    // 테이블 관련
    function insertTable(): void {
        editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        showTableMenu = false;
    }

    function addColumnAfter(): void {
        editor?.chain().focus().addColumnAfter().run();
    }

    function addRowAfter(): void {
        editor?.chain().focus().addRowAfter().run();
    }

    function deleteColumn(): void {
        editor?.chain().focus().deleteColumn().run();
    }

    function deleteRow(): void {
        editor?.chain().focus().deleteRow().run();
    }

    function deleteTable(): void {
        editor?.chain().focus().deleteTable().run();
        showTableMenu = false;
    }

    // YouTube / 동영상 삽입
    function openYoutubeDialog(): void {
        youtubeUrl = '';
        showYoutubeDialog = true;
    }

    function insertYoutube(): void {
        if (!youtubeUrl) {
            showYoutubeDialog = false;
            return;
        }
        editor?.chain().focus().setYoutubeVideo({ src: youtubeUrl }).run();
        showYoutubeDialog = false;
        youtubeUrl = '';
    }

    // 앙티콘 피커
    async function toggleEmoticonPicker(): Promise<void> {
        if (!EmoticonPickerComponent) {
            const mod = await import('../board/emoticon-picker.svelte');
            EmoticonPickerComponent = mod.default;
        }
        showEmoticonPicker = !showEmoticonPicker;
    }

    function handleInsertEmoticon(text: string): void {
        if (!editor) return;
        const match = text.match(/^\{emo:([^}]+)\}$/);
        if (match) {
            editor
                .chain()
                .focus()
                .setImage({ src: `/emoticons/${match[1]}`, alt: match[1] })
                .run();
        } else {
            editor.chain().focus().insertContent(text).run();
        }
        showEmoticonPicker = false;
    }

    // 동영상 파일 업로드 헬퍼
    async function insertVideoFile(file: File): Promise<void> {
        if (!onImageUpload || !editor) return;

        isUploading = true;
        try {
            const videoUrl = await onImageUpload(file);
            if (videoUrl) {
                editor
                    .chain()
                    .focus()
                    .insertContent(
                        `<video src="${videoUrl}" controls playsinline preload="metadata" style="max-width:100%;border-radius:8px;"></video>`
                    )
                    .run();
            }
        } catch (err) {
            console.error('Video upload failed:', err);
        } finally {
            isUploading = false;
        }
    }

    // 동영상 다이얼로그에서 파일 선택 (복수 지원)
    async function handleVideoFileFromDialog(e: Event): Promise<void> {
        const input = e.currentTarget as HTMLInputElement;
        const files = input.files;
        if (!files?.length) return;

        for (const file of Array.from(files)) {
            if (file.type.startsWith('video/')) {
                await insertVideoFile(file);
            }
        }

        showYoutubeDialog = false;
        input.value = '';
    }

    // 동영상 다이얼로그 드래그앤드롭 상태
    let videoDialogDragOver = $state(false);

    // 동영상 다이얼로그 내 드래그앤드롭
    async function handleVideoDialogDrop(e: DragEvent): Promise<void> {
        e.preventDefault();
        videoDialogDragOver = false;
        const files = e.dataTransfer?.files;
        if (!files?.length) return;

        for (const file of Array.from(files)) {
            if (file.type.startsWith('video/')) {
                await insertVideoFile(file);
            }
        }

        showYoutubeDialog = false;
    }

    // 글자 수 업데이트
    function updateCounts(ed: Editor | null): void {
        if (!ed) return;
        charCount = ed.storage.characterCount?.characters() ?? 0;
        wordCount = ed.storage.characterCount?.words() ?? 0;
    }

    // 버튼 공통 클래스
    function getButtonClass(active: boolean): string {
        return active ? 'bg-muted' : '';
    }

    // 에디터 모드 전환
    async function switchMode(newMode: EditorMode): Promise<void> {
        if (newMode === editorMode) return;

        if (editorMode === 'wysiwyg') {
            // WYSIWYG → 다른 모드
            const html = editor?.getHTML() || '';
            if (newMode === 'markdown') {
                rawContent = turndown.turndown(html);
            } else {
                rawContent = html;
            }
        } else if (newMode === 'wysiwyg') {
            // 다른 모드 → WYSIWYG
            let html = rawContent;
            if (editorMode === 'markdown') {
                html = await marked.parse(rawContent);
            }
            // 먼저 모드 변경하여 hidden 해제
            editorMode = newMode;
            // DOM 업데이트 대기
            await tick();
            // visible 상태에서 content 설정
            editor?.commands.setContent(html);
            onUpdate?.(html);
            return;
        } else {
            // markdown ↔ html
            if (editorMode === 'markdown' && newMode === 'html') {
                rawContent = await marked.parse(rawContent);
            } else {
                rawContent = turndown.turndown(rawContent);
            }
        }

        editorMode = newMode;
    }

    // raw 콘텐츠 변경 시 부모에게 알림
    async function handleRawContentChange(): Promise<void> {
        if (editorMode === 'markdown') {
            // 마크다운을 HTML로 변환하여 부모에게 전달
            const html = await marked.parse(rawContent);
            onUpdate?.(html);
        } else if (editorMode === 'html') {
            onUpdate?.(rawContent);
        }
    }

    // HTML 내용 가져오기 (외부에서 호출용)
    export function getContent(): string {
        if (editorMode === 'wysiwyg') {
            return editor?.getHTML() || '';
        } else if (editorMode === 'markdown') {
            // 동기적으로 반환해야 하므로 marked.parseInline 사용
            return rawContent; // 마크다운 원본 반환 (필요시 변환)
        } else {
            return rawContent;
        }
    }

    // HTML 내용 설정 (외부에서 호출용)
    export function setContent(html: string): void {
        if (editorMode === 'wysiwyg') {
            editor?.commands.setContent(html);
        } else if (editorMode === 'markdown') {
            rawContent = turndown.turndown(html);
        } else {
            rawContent = html;
        }
    }
</script>

<div class="tiptap-editor border-input relative rounded-md border {className}">
    <!-- 툴바 -->
    <div
        class="border-border bg-muted/50 sticky top-[64px] z-30 flex flex-wrap items-center gap-1 rounded-t-md border-b p-2"
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
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={openYoutubeDialog}
                {disabled}
                class="h-8 w-8 p-0"
                title="YouTube 삽입"
            >
                <YoutubeIcon class="h-4 w-4" />
            </Button>
            <div class="relative">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onclick={toggleEmoticonPicker}
                    {disabled}
                    class="h-8 w-8 p-0"
                    title="앙티콘"
                >
                    <SmileIcon class="h-4 w-4" />
                </Button>
                {#if showEmoticonPicker && EmoticonPickerComponent}
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <div
                        class="fixed inset-0 z-40 bg-black/20 sm:bg-transparent"
                        onclick={() => (showEmoticonPicker = false)}
                        onkeydown={(e) => e.key === 'Escape' && (showEmoticonPicker = false)}
                    ></div>
                    <div
                        class="fixed inset-x-0 bottom-0 z-50 sm:absolute sm:inset-auto sm:bottom-full sm:right-0 sm:mb-2"
                    >
                        <EmoticonPickerComponent
                            onInsertEmoticon={handleInsertEmoticon}
                            onClose={() => (showEmoticonPicker = false)}
                        />
                    </div>
                {/if}
            </div>
        </div>

        <div class="bg-border mx-1 h-6 w-px" role="separator"></div>

        <!-- 테이블 -->
        <div class="relative flex items-center gap-0.5">
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onclick={() => (showTableMenu = !showTableMenu)}
                {disabled}
                class="h-8 w-8 p-0"
                title="테이블"
            >
                <TableIcon class="h-4 w-4" />
            </Button>
            {#if showTableMenu}
                <div
                    class="bg-popover border-border absolute left-0 top-full z-50 mt-1 rounded-md border p-2 shadow-md"
                >
                    <div class="flex flex-col gap-1">
                        <button
                            type="button"
                            class="hover:bg-accent flex items-center gap-2 rounded px-3 py-1.5 text-sm"
                            onclick={insertTable}
                        >
                            <TableIcon class="h-4 w-4" />
                            테이블 삽입 (3×3)
                        </button>
                        <button
                            type="button"
                            class="hover:bg-accent flex items-center gap-2 rounded px-3 py-1.5 text-sm"
                            onclick={addColumnAfter}
                        >
                            <Columns class="h-4 w-4" />
                            열 추가
                        </button>
                        <button
                            type="button"
                            class="hover:bg-accent flex items-center gap-2 rounded px-3 py-1.5 text-sm"
                            onclick={addRowAfter}
                        >
                            <Rows class="h-4 w-4" />
                            행 추가
                        </button>
                        <button
                            type="button"
                            class="hover:bg-accent flex items-center gap-2 rounded px-3 py-1.5 text-sm"
                            onclick={deleteColumn}
                        >
                            <Columns class="text-destructive h-4 w-4" />
                            열 삭제
                        </button>
                        <button
                            type="button"
                            class="hover:bg-accent flex items-center gap-2 rounded px-3 py-1.5 text-sm"
                            onclick={deleteRow}
                        >
                            <Rows class="text-destructive h-4 w-4" />
                            행 삭제
                        </button>
                        <hr class="border-border my-1" />
                        <button
                            type="button"
                            class="hover:bg-accent text-destructive flex items-center gap-2 rounded px-3 py-1.5 text-sm"
                            onclick={deleteTable}
                        >
                            <Trash2 class="h-4 w-4" />
                            테이블 삭제
                        </button>
                    </div>
                </div>
            {/if}
        </div>

        <div class="bg-border mx-1 h-6 w-px" role="separator"></div>

        <!-- 에디터 모드 전환 -->
        <div class="flex items-center gap-0.5">
            <Button
                type="button"
                variant={editorMode === 'wysiwyg' ? 'secondary' : 'ghost'}
                size="sm"
                onclick={() => switchMode('wysiwyg')}
                {disabled}
                class="h-8 px-2 text-xs"
                title="WYSIWYG 모드"
            >
                <PilcrowIcon class="mr-1 h-3 w-3" />
                편집
            </Button>
            <Button
                type="button"
                variant={editorMode === 'markdown' ? 'secondary' : 'ghost'}
                size="sm"
                onclick={() => switchMode('markdown')}
                {disabled}
                class="h-8 px-2 text-xs"
                title="마크다운 모드"
            >
                <HashIcon class="mr-1 h-3 w-3" />
                MD
            </Button>
            <Button
                type="button"
                variant={editorMode === 'html' ? 'secondary' : 'ghost'}
                size="sm"
                onclick={() => switchMode('html')}
                {disabled}
                class="h-8 px-2 text-xs"
                title="HTML 모드"
            >
                <FileCodeIcon class="mr-1 h-3 w-3" />
                HTML
            </Button>
        </div>
    </div>

    <!-- 에디터 영역 -->
    <!-- WYSIWYG: hidden 속성으로 표시/숨김 (DOM 유지 — TipTap 에디터가 참조하는 요소 파괴 방지) -->
    <div
        class="tiptap-content min-h-[300px] p-4"
        class:uploading={isUploading}
        hidden={editorMode !== 'wysiwyg'}
        bind:this={editorElement}
        ondrop={handleDrop}
        ondragover={(e) => e.preventDefault()}
        onpaste={handlePaste}
    ></div>
    {#if editorMode !== 'wysiwyg'}
        <!-- 마크다운/HTML 텍스트 에디터 -->
        <textarea
            class="bg-background text-foreground min-h-[300px] w-full resize-y p-4 font-mono text-sm focus:outline-none"
            bind:value={rawContent}
            oninput={handleRawContentChange}
            placeholder={editorMode === 'markdown'
                ? '마크다운을 입력하세요...\n\n# 제목\n**굵게** *기울임*\n- 목록'
                : 'HTML을 입력하세요...\n\n<h1>제목</h1>\n<p><strong>굵게</strong> <em>기울임</em></p>'}
            {disabled}
        ></textarea>
    {/if}
    {#if isUploading}
        <div class="absolute inset-0 flex items-center justify-center rounded-lg bg-black/20">
            <div class="bg-background rounded-md px-4 py-2 text-sm shadow-lg">
                이미지 업로드 중...
            </div>
        </div>
    {/if}

    <!-- 하단 상태바 -->
    <div
        class="border-border text-muted-foreground flex items-center justify-end border-t px-3 py-1 text-xs"
    >
        <span>{charCount}자 · {wordCount}단어</span>
    </div>
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

<!-- 이미지 링크 다이얼로그 -->
<Dialog bind:open={showImageLinkDialog}>
    <DialogContent class="sm:max-w-md">
        <DialogHeader>
            <DialogTitle>이미지 링크 설정</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
            <div class="space-y-2">
                <label for="image-link-url" class="text-sm font-medium">URL</label>
                <Input
                    id="image-link-url"
                    type="url"
                    bind:value={imageLinkUrl}
                    placeholder="https://example.com 또는 tel:010-1234-5678"
                />
                <p class="text-muted-foreground text-xs">이미지를 클릭하면 이 URL로 이동합니다</p>
            </div>
        </div>
        <DialogFooter class="flex gap-2">
            {#if editor?.getAttributes('image').href}
                <Button type="button" variant="destructive" onclick={removeImageLink}
                    >링크 제거</Button
                >
            {/if}
            <Button type="button" variant="outline" onclick={() => (showImageLinkDialog = false)}>
                취소
            </Button>
            <Button type="button" onclick={insertImageLink}>적용</Button>
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
            {#if onImageUpload}
                <div class="space-y-2">
                    <label class="text-sm font-medium">파일 업로드</label>
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <label
                        class="border-border hover:bg-muted/50 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors {imageDialogDragOver
                            ? 'border-primary bg-primary/10'
                            : ''}"
                        ondragover={(e) => {
                            e.preventDefault();
                            imageDialogDragOver = true;
                        }}
                        ondragleave={() => {
                            imageDialogDragOver = false;
                        }}
                        ondrop={handleImageDialogDrop}
                    >
                        <Upload class="text-muted-foreground h-8 w-8" />
                        <span class="text-muted-foreground text-sm"
                            >클릭 또는 드래그하여 이미지 선택</span
                        >
                        <span class="text-muted-foreground text-xs">여러 파일 선택 가능</span>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            class="hidden"
                            onchange={handleImageFileFromDialog}
                            disabled={isUploading}
                        />
                    </label>
                </div>
                <div class="relative">
                    <div class="absolute inset-0 flex items-center">
                        <span class="border-border w-full border-t"></span>
                    </div>
                    <div class="relative flex justify-center text-xs uppercase">
                        <span class="bg-background text-muted-foreground px-2">또는</span>
                    </div>
                </div>
            {/if}
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

<!-- 동영상 다이얼로그 -->
<Dialog bind:open={showYoutubeDialog}>
    <DialogContent class="sm:max-w-md">
        <DialogHeader>
            <DialogTitle>동영상 삽입</DialogTitle>
        </DialogHeader>
        <div class="space-y-4 py-4">
            {#if onImageUpload}
                <div class="space-y-2">
                    <label class="text-sm font-medium">동영상 파일 업로드</label>
                    <!-- svelte-ignore a11y_no_static_element_interactions -->
                    <label
                        class="border-border hover:bg-muted/50 flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors {videoDialogDragOver
                            ? 'border-primary bg-primary/10'
                            : ''}"
                        ondragover={(e) => {
                            e.preventDefault();
                            videoDialogDragOver = true;
                        }}
                        ondragleave={() => {
                            videoDialogDragOver = false;
                        }}
                        ondrop={handleVideoDialogDrop}
                    >
                        <Upload class="text-muted-foreground h-8 w-8" />
                        <span class="text-muted-foreground text-sm"
                            >클릭 또는 드래그하여 동영상 선택</span
                        >
                        <span class="text-muted-foreground text-xs"
                            >MP4, WebM, MOV (여러 파일 가능)</span
                        >
                        <input
                            type="file"
                            accept="video/*"
                            multiple
                            class="hidden"
                            onchange={handleVideoFileFromDialog}
                            disabled={isUploading}
                        />
                    </label>
                </div>
                <div class="relative">
                    <div class="absolute inset-0 flex items-center">
                        <span class="border-border w-full border-t"></span>
                    </div>
                    <div class="relative flex justify-center text-xs uppercase">
                        <span class="bg-background text-muted-foreground px-2">또는</span>
                    </div>
                </div>
            {/if}
            <div class="space-y-2">
                <label for="youtube-url" class="text-sm font-medium">YouTube URL</label>
                <Input
                    id="youtube-url"
                    type="url"
                    bind:value={youtubeUrl}
                    placeholder="https://www.youtube.com/watch?v=..."
                />
            </div>
        </div>
        <DialogFooter>
            <Button type="button" variant="outline" onclick={() => (showYoutubeDialog = false)}>
                취소
            </Button>
            <Button type="button" onclick={insertYoutube}>삽입</Button>
        </DialogFooter>
    </DialogContent>
</Dialog>

<style>
    /* TipTap 에디터 기본 스타일 */
    :global(.tiptap-content .tiptap) {
        outline: none;
        min-height: 250px;
        font-size: var(--editor-font-size, 1rem);
    }

    :global(.tiptap-content .tiptap p.is-editor-empty:first-child::before) {
        color: var(--muted-foreground);
        content: attr(data-placeholder);
        float: left;
        height: 0;
        pointer-events: none;
        white-space: pre-line;
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
        font-synthesis: style;
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

    /* 이미지 링크 표시 (에디터 내 링크 있는 이미지) */
    :global(.tiptap-content .tiptap a > img) {
        outline: 2px solid hsl(var(--primary) / 0.4);
        outline-offset: 2px;
        border-radius: 0.5rem;
    }

    /* 링크 스타일 */
    :global(.tiptap-content .tiptap a) {
        color: var(--primary);
        text-decoration: underline;
    }

    :global(.tiptap-content .tiptap a:hover) {
        opacity: 0.8;
    }

    /* 멘션 노드 스타일 */
    :global(.tiptap-content .tiptap .mention-node) {
        background-color: hsl(var(--primary) / 0.1);
        border-radius: 0.25rem;
        padding: 0.125rem 0.25rem;
        text-decoration: none;
    }

    /* 테이블 스타일 */
    :global(.tiptap-content .tiptap table) {
        border-collapse: collapse;
        width: 100%;
        margin: 1rem 0;
        overflow: hidden;
    }

    :global(.tiptap-content .tiptap th),
    :global(.tiptap-content .tiptap td) {
        border: 1px solid var(--border);
        padding: 0.5rem 0.75rem;
        min-width: 100px;
        vertical-align: top;
    }

    :global(.tiptap-content .tiptap th) {
        background-color: var(--muted);
        font-weight: 600;
        text-align: left;
    }

    :global(.tiptap-content .tiptap .selectedCell) {
        background-color: hsl(var(--primary) / 0.1);
    }

    :global(.tiptap-content .tiptap .column-resize-handle) {
        position: absolute;
        right: -2px;
        top: 0;
        bottom: -2px;
        width: 4px;
        background-color: hsl(var(--primary) / 0.5);
        pointer-events: none;
    }

    :global(.tiptap-content .tiptap .tableWrapper) {
        overflow-x: auto;
        margin: 1rem 0;
    }

    /* YouTube 임베드 스타일 */
    :global(.tiptap-content .tiptap .tiptap-youtube) {
        margin: 1rem 0;
    }

    :global(.tiptap-content .tiptap div[data-youtube-video]) {
        margin: 1rem 0;
    }

    :global(.tiptap-content .tiptap div[data-youtube-video] iframe) {
        border-radius: 0.5rem;
        max-width: 100%;
    }

    /* 코드 블록 구문 하이라이팅 */
    :global(.tiptap-content .tiptap pre.tiptap-code-block) {
        background-color: #1e1e2e;
        color: #cdd6f4;
        border-radius: 0.5rem;
        padding: 1rem;
        margin-bottom: 0.75rem;
        overflow-x: auto;
    }

    :global(.tiptap-content .tiptap pre.tiptap-code-block code) {
        color: inherit;
        background: none;
        padding: 0;
    }

    :global(.tiptap-content .tiptap .hljs-keyword) {
        color: #cba6f7;
    }
    :global(.tiptap-content .tiptap .hljs-string) {
        color: #a6e3a1;
    }
    :global(.tiptap-content .tiptap .hljs-comment) {
        color: #6c7086;
        font-style: italic;
        font-synthesis: style;
    }
    :global(.tiptap-content .tiptap .hljs-number) {
        color: #fab387;
    }
    :global(.tiptap-content .tiptap .hljs-function) {
        color: #89b4fa;
    }
    :global(.tiptap-content .tiptap .hljs-title) {
        color: #89b4fa;
    }
    :global(.tiptap-content .tiptap .hljs-params) {
        color: #f5c2e7;
    }
    :global(.tiptap-content .tiptap .hljs-built_in) {
        color: #f38ba8;
    }
    :global(.tiptap-content .tiptap .hljs-type) {
        color: #f9e2af;
    }
    :global(.tiptap-content .tiptap .hljs-attr) {
        color: #89dceb;
    }
    :global(.tiptap-content .tiptap .hljs-variable) {
        color: #cdd6f4;
    }
    :global(.tiptap-content .tiptap .hljs-operator) {
        color: #89dceb;
    }
    :global(.tiptap-content .tiptap .hljs-punctuation) {
        color: #bac2de;
    }
    :global(.tiptap-content .tiptap .hljs-meta) {
        color: #f38ba8;
    }
    :global(.tiptap-content .tiptap .hljs-tag) {
        color: #89b4fa;
    }
    :global(.tiptap-content .tiptap .hljs-name) {
        color: #89b4fa;
    }
    :global(.tiptap-content .tiptap .hljs-selector-class) {
        color: #a6e3a1;
    }
    :global(.tiptap-content .tiptap .hljs-selector-id) {
        color: #fab387;
    }
    :global(.tiptap-content .tiptap .hljs-literal) {
        color: #fab387;
    }
</style>
