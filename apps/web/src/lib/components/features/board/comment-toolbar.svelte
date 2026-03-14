<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import Smile from '@lucide/svelte/icons/smile';
    import ImageIcon from '@lucide/svelte/icons/image';
    import Film from '@lucide/svelte/icons/film';
    import Space from '@lucide/svelte/icons/space';
    import type { Component } from 'svelte';

    interface Props {
        onInsertText: (text: string) => void;
        onSelectImage: () => void;
        onInsertEmoticon?: (filename: string) => void;
        disabled?: boolean;
        boardId?: string;
    }

    let {
        onInsertText,
        onSelectImage,
        onInsertEmoticon,
        disabled = false,
        boardId
    }: Props = $props();

    let showEmoticonPicker = $state(false);
    let showGifPicker = $state(false);

    // 동적 로드 — 버튼 클릭 시에만 import
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let LazyEmoticonPicker = $state<Component<any> | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let LazyTenorGifPicker = $state<Component<any> | null>(null);

    function toggleEmoticonPicker(): void {
        if (showEmoticonPicker) {
            showEmoticonPicker = false;
            return;
        }
        if (!LazyEmoticonPicker) {
            import('./emoticon-picker.svelte').then((m) => {
                LazyEmoticonPicker = m.default;
                showEmoticonPicker = true;
            });
        } else {
            showEmoticonPicker = true;
        }
    }

    function openGifPicker(): void {
        if (!LazyTenorGifPicker) {
            import('./tenor-gif-picker.svelte').then((m) => {
                LazyTenorGifPicker = m.default;
                showGifPicker = true;
            });
        } else {
            showGifPicker = true;
        }
    }

    function insertBlankComment(): void {
        onInsertText('\u2800');
    }

    function handleInsertEmoticon(text: string): void {
        if (onInsertEmoticon) {
            const match = text.match(/^\{emo:([^}]+)\}$/);
            if (match) {
                onInsertEmoticon(match[1]);
                return;
            }
        }
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
            onclick={toggleEmoticonPicker}
            {disabled}
            class="h-8 px-2"
            title="이모티콘"
        >
            <Smile class="h-4 w-4" />
            <span class="ml-1 hidden text-xs sm:inline">이모티콘</span>
        </Button>
        {#if showEmoticonPicker && LazyEmoticonPicker}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div
                class="fixed inset-0 z-[9998] bg-black/20 sm:bg-transparent"
                onclick={() => (showEmoticonPicker = false)}
                onkeydown={(e) => e.key === 'Escape' && (showEmoticonPicker = false)}
            ></div>
            <div
                class="fixed inset-x-0 bottom-0 z-[9999] sm:fixed sm:inset-x-auto sm:bottom-4 sm:left-1/2 sm:-translate-x-1/2"
            >
                <LazyEmoticonPicker
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
        onclick={openGifPicker}
        {disabled}
        class="h-8 px-2"
        title="GIF"
    >
        <Film class="h-4 w-4" />
        <span class="ml-1 hidden text-xs sm:inline">GIF</span>
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
        <span class="ml-1 hidden text-xs sm:inline">사진</span>
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
        <span class="ml-1 hidden text-xs sm:inline">빈댓글</span>
    </Button>
</div>

<!-- Tenor GIF 다이얼로그 -->
{#if LazyTenorGifPicker}
    <LazyTenorGifPicker
        bind:open={showGifPicker}
        onInsertGif={handleInsertGif}
        onClose={() => (showGifPicker = false)}
    />
{/if}
