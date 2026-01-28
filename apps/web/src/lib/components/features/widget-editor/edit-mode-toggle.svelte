<script lang="ts">
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
    import { getUser } from '$lib/stores/auth.svelte';
    import Settings from '@lucide/svelte/icons/settings';
    import X from '@lucide/svelte/icons/x';
    import Save from '@lucide/svelte/icons/save';
    import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
    import { toast } from 'svelte-sonner';

    import AddWidgetDialog from './add-widget-dialog.svelte';

    // 사용자 정보
    const user = $derived(getUser());
    // TODO: 테스트 후 원복 필요
    const isAdmin = $derived(true || (user?.mb_level ?? 0) >= 10);

    // 스토어 상태
    const isEditMode = $derived(widgetLayoutStore.isEditMode);
    const isSaving = $derived(widgetLayoutStore.isSaving);
    const hasChanges = $derived(widgetLayoutStore.hasChanges);

    function handleToggle() {
        if (isEditMode) {
            // 편집 모드 종료
            if (hasChanges) {
                if (!confirm('저장하지 않은 변경사항이 있습니다. 정말 취소하시겠습니까?')) {
                    return;
                }
                widgetLayoutStore.exitEditMode(true); // 변경사항 취소
            } else {
                widgetLayoutStore.exitEditMode();
            }
        } else {
            widgetLayoutStore.enterEditMode();
        }
    }

    async function handleSave() {
        const success = await widgetLayoutStore.saveLayout();
        if (success) {
            toast.success('레이아웃이 저장되었습니다.');
        } else {
            toast.error('레이아웃 저장에 실패했습니다.');
        }
    }

    function handleDiscard() {
        if (confirm('변경사항을 취소하시겠습니까?')) {
            widgetLayoutStore.discardChanges();
        }
    }

    function handleReset() {
        if (confirm('기본 레이아웃으로 초기화하시겠습니까?')) {
            widgetLayoutStore.resetToDefault();
        }
    }
</script>

{#if isAdmin}
    {#if isEditMode}
        <!-- 편집 모드 툴바 -->
        <div
            class="bg-background border-border fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border px-4 py-2 shadow-lg"
        >
            <span class="text-muted-foreground mr-2 text-sm font-medium">편집 모드</span>

            <!-- 위젯 추가 -->
            <AddWidgetDialog />

            <!-- 기본 레이아웃 초기화 -->
            <button
                type="button"
                onclick={handleReset}
                class="hover:bg-muted rounded-full p-2 transition-colors"
                title="기본 레이아웃으로 초기화"
            >
                <RotateCcw class="h-4 w-4" />
            </button>

            <div class="bg-border h-6 w-px"></div>

            <!-- 취소 -->
            <button
                type="button"
                onclick={handleDiscard}
                class="hover:bg-muted rounded-md px-3 py-1.5 text-sm transition-colors"
                disabled={!hasChanges}
            >
                취소
            </button>

            <!-- 저장 -->
            <button
                type="button"
                onclick={handleSave}
                disabled={!hasChanges || isSaving}
                class="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            >
                <Save class="h-4 w-4" />
                {isSaving ? '저장 중...' : '저장'}
            </button>

            <!-- 닫기 -->
            <button
                type="button"
                onclick={handleToggle}
                class="hover:bg-muted ml-1 rounded-full p-2 transition-colors"
                title="편집 모드 종료"
            >
                <X class="h-4 w-4" />
            </button>
        </div>
    {:else}
        <!-- FAB 버튼 (편집 모드 진입) -->
        <button
            type="button"
            onclick={handleToggle}
            class="bg-primary text-primary-foreground hover:bg-primary/90 fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105"
            title="페이지 레이아웃 편집"
        >
            <Settings class="h-5 w-5" />
        </button>
    {/if}
{/if}
