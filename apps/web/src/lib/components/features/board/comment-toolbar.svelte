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
    }

    let { onInsertText, onSelectImage, onInsertEmoticon, disabled = false }: Props = $props();

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

<!--
    툴바 버튼은 모두 tabindex="-1" — 댓글 입력 후 Tab 을 누르면 이모티콘이 아니라
    '댓글 작성' 버튼으로 바로 가야 한다(#13092 회원 제보). 삽입 도구는 마우스·클릭
    전용이라 키보드 순회에서 빼도 기능 손실이 없고, 오히려 작성 흐름이 자연스러워진다.
-->
<div class="flex items-center gap-1">
    <!-- 이모티콘 버튼 -->
    <div class="relative">
        <Button
            type="button"
            variant="ghost"
            size="sm"
            onclick={toggleEmoticonPicker}
            {disabled}
            tabindex={-1}
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
        tabindex={-1}
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
        tabindex={-1}
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
        tabindex={-1}
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
