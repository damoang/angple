<script lang="ts">
    import { customizerStore } from '$lib/stores/admin-customizer.svelte';
    import { fly } from 'svelte/transition';
    import Save from '@lucide/svelte/icons/save';
    import Undo2 from '@lucide/svelte/icons/undo-2';
    import CustomizerHeader from './customizer-header.svelte';
    import HeaderMenuSection from './sections/header-menu-section.svelte';
    import SidebarMenuSection from './sections/sidebar-menu-section.svelte';
    import MegaMenuSection from './sections/mega-menu-section.svelte';
    import WidgetsSection from './sections/widgets-section.svelte';

    const isOpen = $derived(customizerStore.isOpen);
    const activeSection = $derived(customizerStore.activeSection);
    const isSaving = $derived(customizerStore.isSaving);
    const hasChanges = $derived(customizerStore.hasChanges);

    function handleBackdropClick() {
        customizerStore.close();
    }

    async function handleSave() {
        await customizerStore.saveAll();
    }

    function handleDiscard() {
        if (confirm('변경사항을 취소하시겠습니까?')) {
            customizerStore.discardAll();
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape' && isOpen) {
            customizerStore.close();
        }
    }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if isOpen}
    <!-- Backdrop -->
    <button
        type="button"
        class="fixed inset-0 z-[59] bg-black/20 backdrop-blur-[1px] md:block"
        onclick={handleBackdropClick}
        aria-label="커스터마이저 닫기"
        tabindex="-1"
    ></button>

    <!-- 패널 -->
    <div
        class="bg-background border-border fixed right-0 top-0 z-[60] flex h-full w-full flex-col border-l shadow-xl md:w-[380px]"
        transition:fly={{ x: 380, duration: 300, opacity: 1 }}
    >
        <!-- 헤더 + 탭 -->
        <CustomizerHeader />

        <!-- 섹션 콘텐츠 -->
        <div class="flex-1 overflow-y-auto">
            {#if activeSection === 'header'}
                <HeaderMenuSection />
            {:else if activeSection === 'sidebar'}
                <SidebarMenuSection />
            {:else if activeSection === 'mega'}
                <MegaMenuSection />
            {:else if activeSection === 'widgets'}
                <WidgetsSection />
            {/if}
        </div>

        <!-- 하단 액션 바 -->
        <div class="border-border flex items-center gap-2 border-t px-4 py-3">
            <button
                type="button"
                onclick={handleDiscard}
                disabled={!hasChanges}
                class="hover:bg-muted flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
                <Undo2 class="h-4 w-4" />
                취소
            </button>
            <button
                type="button"
                onclick={handleSave}
                disabled={!hasChanges || isSaving}
                class="bg-primary text-primary-foreground hover:bg-primary/90 flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
                <Save class="h-4 w-4" />
                {isSaving ? '저장 중...' : '저장'}
            </button>
        </div>
    </div>
{/if}
