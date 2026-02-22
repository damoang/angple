<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import Smile from '@lucide/svelte/icons/smile';
    import ImageIcon from '@lucide/svelte/icons/image';
    import Film from '@lucide/svelte/icons/film';
    import Space from '@lucide/svelte/icons/space';
    import EmoticonPicker from './emoticon-picker.svelte';
    import TenorGifPicker from './tenor-gif-picker.svelte';

    interface Props {
        onInsertText: (text: string) => void;
        onSelectImage: () => void;
        disabled?: boolean;
        boardId?: string;
    }

    let { onInsertText, onSelectImage, disabled = false, boardId }: Props = $props();

    let showEmoticonPicker = $state(false);
    let showGifPicker = $state(false);

    function insertBlankComment(): void {
        // U+2800 Braille Pattern Blank - 시각적으로 빈 문자
        onInsertText('\u2800');
    }

    function handleInsertEmoticon(text: string): void {
        onInsertText(text);
    }

    function handleInsertGif(url: string): void {
        onInsertText(url);
    }
</script>

<div class="flex items-center gap-1">
    <!-- 이모티콘 버튼 -->
    <div class="relative">
        <Button
            type="button"
            variant="ghost"
            size="sm"
            onclick={() => (showEmoticonPicker = !showEmoticonPicker)}
            {disabled}
            class="h-8 px-2"
            title="이모티콘"
        >
            <Smile class="h-4 w-4" />
            <span class="ml-1 text-xs">이모티콘</span>
        </Button>
        {#if showEmoticonPicker}
            <!-- 외부 클릭으로 닫기 -->
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="fixed inset-0 z-40"
                onclick={() => (showEmoticonPicker = false)}
                onkeydown={(e) => e.key === 'Escape' && (showEmoticonPicker = false)}
            ></div>
            <div class="absolute bottom-full left-0 z-50 mb-1">
                <EmoticonPicker
                    onInsertEmoticon={handleInsertEmoticon}
                    onClose={() => (showEmoticonPicker = false)}
                />
            </div>
        {/if}
    </div>

    <!-- GIF 버튼 -->
    <Button
        type="button"
        variant="ghost"
        size="sm"
        onclick={() => (showGifPicker = true)}
        {disabled}
        class="h-8 px-2"
        title="GIF"
    >
        <Film class="h-4 w-4" />
        <span class="ml-1 text-xs">GIF</span>
    </Button>

    <!-- 사진 버튼 -->
    <Button
        type="button"
        variant="ghost"
        size="sm"
        onclick={onSelectImage}
        {disabled}
        class="h-8 px-2"
        title="사진"
    >
        <ImageIcon class="h-4 w-4" />
        <span class="ml-1 text-xs">사진</span>
    </Button>

    <!-- 빈댓글 버튼 -->
    <Button
        type="button"
        variant="ghost"
        size="sm"
        onclick={insertBlankComment}
        {disabled}
        class="h-8 px-2"
        title="빈댓글"
    >
        <Space class="h-4 w-4" />
        <span class="ml-1 text-xs">빈댓글</span>
    </Button>
</div>

<!-- Tenor GIF 다이얼로그 -->
<TenorGifPicker
    bind:open={showGifPicker}
    onInsertGif={handleInsertGif}
    onClose={() => (showGifPicker = false)}
/>
