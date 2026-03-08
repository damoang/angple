<script lang="ts">
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import { uiSettingsStore, type ShortcutButtonSize } from '$lib/stores/ui-settings.svelte';
    import { boardFavoritesStore } from '$lib/stores/board-favorites.svelte';
    import Home from '@lucide/svelte/icons/house';
    import RefreshCw from '@lucide/svelte/icons/refresh-cw';
    import ArrowUp from '@lucide/svelte/icons/arrow-up';
    import ArrowDown from '@lucide/svelte/icons/arrow-down';

    const SIZE_MAP: Record<ShortcutButtonSize, string> = {
        small: '2rem',
        medium: '2.5rem',
        large: '3rem'
    };

    const ICON_SIZE_MAP: Record<ShortcutButtonSize, string> = {
        small: 'h-3.5 w-3.5',
        medium: 'h-4 w-4',
        large: 'h-5 w-5'
    };

    let hidden = $state(false);

    function handleFocusIn(e: FocusEvent) {
        const el = e.target;
        if (el instanceof HTMLElement) {
            const tag = el.tagName;
            if (
                tag === 'INPUT' ||
                tag === 'TEXTAREA' ||
                tag === 'SELECT' ||
                el.contentEditable === 'true'
            ) {
                hidden = true;
            }
        }
    }

    function handleFocusOut() {
        setTimeout(() => {
            hidden = false;
        }, 0);
    }

    onMount(() => {
        document.addEventListener('focusin', handleFocusIn);
        document.addEventListener('focusout', handleFocusOut);
        return () => {
            document.removeEventListener('focusin', handleFocusIn);
            document.removeEventListener('focusout', handleFocusOut);
        };
    });

    let iconSize = $derived(ICON_SIZE_MAP[uiSettingsStore.shortcutButtonSize]);
    let btnSize = $derived(SIZE_MAP[uiSettingsStore.shortcutButtonSize]);
    let favorites = $derived(boardFavoritesStore.normalSlots.slice(0, 5));
</script>

{#if browser && uiSettingsStore.showShortcutButtons && !hidden}
    <nav
        class="border-border bg-background/95 fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border px-2 py-1.5 shadow-lg backdrop-blur-sm"
        aria-label="단축 버튼"
    >
        <!-- 고정 버튼: 홈 -->
        <button
            type="button"
            class="shortcut-btn"
            style="width:{btnSize};height:{btnSize}"
            title="홈"
            onclick={() => goto('/')}
        >
            <Home class={iconSize} />
        </button>

        <!-- 고정 버튼: 새로고침 -->
        <button
            type="button"
            class="shortcut-btn"
            style="width:{btnSize};height:{btnSize}"
            title="새로고침"
            onclick={() => location.reload()}
        >
            <RefreshCw class={iconSize} />
        </button>

        <!-- 고정 버튼: 위로 -->
        <button
            type="button"
            class="shortcut-btn"
            style="width:{btnSize};height:{btnSize}"
            title="위로"
            onclick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
            <ArrowUp class={iconSize} />
        </button>

        <!-- 고정 버튼: 아래로 -->
        <button
            type="button"
            class="shortcut-btn"
            style="width:{btnSize};height:{btnSize}"
            title="아래로"
            onclick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
        >
            <ArrowDown class={iconSize} />
        </button>

        <!-- 즐겨찾기 (최대 5개) -->
        {#if favorites.length > 0}
            <span class="bg-border mx-0.5 h-4 w-px"></span>
            {#each favorites as { slot, entry } (slot)}
                <button
                    type="button"
                    class="shortcut-btn"
                    style="width:{btnSize};height:{btnSize}"
                    title={entry.title}
                    onclick={() => goto(`/${entry.boardId}`)}
                >
                    <span class="text-[10px] font-bold leading-none"
                        >{slot === 10 ? '0' : slot}</span
                    >
                </button>
            {/each}
        {/if}
    </nav>
{/if}

<style>
    .shortcut-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 9999px;
        border: none;
        background: transparent;
        color: var(--foreground);
        cursor: pointer;
        transition: background-color 0.15s;
        flex-shrink: 0;
    }

    .shortcut-btn:hover {
        background-color: var(--accent, rgba(0, 0, 0, 0.06));
    }

    .shortcut-btn:active {
        background-color: var(--accent, rgba(0, 0, 0, 0.1));
    }
</style>
