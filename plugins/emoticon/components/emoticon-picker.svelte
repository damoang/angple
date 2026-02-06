<!--
  이모티콘 피커 컴포넌트
  에디터 툴바에 표시되는 드롭다운 피커
  @param onselect - 이모티콘 선택 시 콜백 ({emo:filename:width} 코드 전달)
-->
<script lang="ts">
    import { fetchPacks, fetchPackItems } from '../lib/api';
    import { buildEmoticonCode } from '../lib/api';
    import type { EmoticonPack, EmoticonItem } from '../lib/types';
    import EmoticonImage from './emoticon-image.svelte';

    interface Props {
        onselect?: (code: string) => void;
    }

    let { onselect }: Props = $props();

    let isOpen = $state(false);
    let packs = $state<EmoticonPack[]>([]);
    let activePack = $state<EmoticonPack | null>(null);
    let items = $state<EmoticonItem[]>([]);
    let loading = $state(false);
    let error = $state('');

    async function loadPacks() {
        if (packs.length > 0) return;
        loading = true;
        error = '';
        try {
            packs = await fetchPacks();
            if (packs.length > 0) {
                await selectPack(packs[0]);
            }
        } catch (e) {
            error = '팩 목록을 불러올 수 없습니다';
        } finally {
            loading = false;
        }
    }

    async function selectPack(pack: EmoticonPack) {
        activePack = pack;
        loading = true;
        error = '';
        try {
            items = await fetchPackItems(pack.slug);
        } catch (e) {
            error = '이모티콘을 불러올 수 없습니다';
            items = [];
        } finally {
            loading = false;
        }
    }

    function handleSelect(item: EmoticonItem) {
        const code = buildEmoticonCode(item.filename, activePack?.default_width ?? 50);
        onselect?.(code);
        isOpen = false;
    }

    function togglePicker() {
        isOpen = !isOpen;
        if (isOpen) {
            loadPacks();
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
            isOpen = false;
        }
    }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="emoticon-picker-wrapper">
    <button
        type="button"
        class="emoticon-picker-trigger"
        onclick={togglePicker}
        title="이모티콘"
        aria-expanded={isOpen}
    >
        😀
    </button>

    {#if isOpen}
        <div class="emoticon-picker-dropdown" role="dialog" aria-label="이모티콘 선택">
            <!-- 카테고리 탭 -->
            {#if packs.length > 0}
                <div class="emoticon-tabs" role="tablist">
                    {#each packs as pack (pack.id)}
                        <button
                            type="button"
                            class="emoticon-tab"
                            class:active={activePack?.id === pack.id}
                            onclick={() => selectPack(pack)}
                            role="tab"
                            aria-selected={activePack?.id === pack.id}
                        >
                            {pack.name}
                        </button>
                    {/each}
                </div>
            {/if}

            <!-- 이모티콘 그리드 -->
            <div class="emoticon-grid" role="tabpanel">
                {#if loading}
                    <div class="emoticon-loading">불러오는 중...</div>
                {:else if error}
                    <div class="emoticon-error">{error}</div>
                {:else if items.length === 0}
                    <div class="emoticon-empty">이모티콘이 없습니다</div>
                {:else}
                    {#each items as item (item.id)}
                        <EmoticonImage
                            filename={item.filename}
                            width={40}
                            onclick={() => handleSelect(item)}
                        />
                    {/each}
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    .emoticon-picker-wrapper {
        position: relative;
        display: inline-block;
    }

    .emoticon-picker-trigger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 6px;
        background: var(--bg, #fff);
        cursor: pointer;
        font-size: 18px;
        transition: background-color 0.15s;
    }

    .emoticon-picker-trigger:hover {
        background-color: var(--hover-bg, #f1f5f9);
    }

    .emoticon-picker-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        z-index: 1000;
        width: 340px;
        max-height: 400px;
        margin-top: 4px;
        border: 1px solid var(--border-color, #e2e8f0);
        border-radius: 8px;
        background: var(--bg, #fff);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        overflow: hidden;
    }

    .emoticon-tabs {
        display: flex;
        gap: 0;
        padding: 4px 4px 0;
        border-bottom: 1px solid var(--border-color, #e2e8f0);
        overflow-x: auto;
        scrollbar-width: thin;
    }

    .emoticon-tab {
        flex-shrink: 0;
        padding: 6px 12px;
        border: none;
        border-bottom: 2px solid transparent;
        background: none;
        cursor: pointer;
        font-size: 13px;
        color: var(--text-muted, #64748b);
        white-space: nowrap;
        transition:
            color 0.15s,
            border-color 0.15s;
    }

    .emoticon-tab:hover {
        color: var(--text, #1e293b);
    }

    .emoticon-tab.active {
        color: var(--primary, #3b82f6);
        border-bottom-color: var(--primary, #3b82f6);
    }

    .emoticon-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 2px;
        padding: 8px;
        max-height: 320px;
        overflow-y: auto;
    }

    .emoticon-loading,
    .emoticon-error,
    .emoticon-empty {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-height: 80px;
        font-size: 13px;
        color: var(--text-muted, #64748b);
    }

    .emoticon-error {
        color: var(--error, #ef4444);
    }
</style>
