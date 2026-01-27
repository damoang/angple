<script lang="ts">
    import { menuStore } from '$lib/stores/menu-store.svelte';
    import { MENU_ICONS, type Menu, type UpdateMenuRequest } from '$lib/types/menu';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Switch } from '$lib/components/ui/switch';
    import * as Dialog from '$lib/components/ui/dialog';
    import * as Select from '$lib/components/ui/select';
    import { Loader2, Trash2 } from '@lucide/svelte/icons';

    interface Props {
        open: boolean;
        menu: Menu | null;
        onClose: () => void;
    }

    let { open = $bindable(), menu, onClose }: Props = $props();

    // 폼 상태 (menu가 변경될 때 초기화)
    let title = $state('');
    let url = $state('');
    let icon = $state('');
    let shortcut = $state('');
    let description = $state('');
    let target = $state('_self');
    let showInHeader = $state(false);
    let showInSidebar = $state(true);
    let isActive = $state(true);
    let isSubmitting = $state(false);

    // menu가 변경되면 폼 초기화
    $effect(() => {
        if (menu) {
            title = menu.title;
            url = menu.url;
            icon = menu.icon || '';
            shortcut = menu.shortcut || '';
            description = menu.description || '';
            target = menu.target || '_self';
            showInHeader = menu.show_in_header;
            showInSidebar = menu.show_in_sidebar;
            isActive = menu.is_active;
        }
    });

    async function handleSubmit() {
        if (!menu || !title.trim() || !url.trim()) {
            return;
        }

        isSubmitting = true;
        try {
            const request: UpdateMenuRequest = {
                title: title.trim(),
                url: url.trim(),
                icon: icon || undefined,
                shortcut: shortcut || undefined,
                description: description || undefined,
                target,
                show_in_header: showInHeader,
                show_in_sidebar: showInSidebar,
                is_active: isActive
            };

            await menuStore.updateMenu(menu.id, request);
            onClose();
        } catch (error) {
            console.error('메뉴 수정 실패:', error);
        } finally {
            isSubmitting = false;
        }
    }

    async function handleDelete() {
        if (!menu) return;

        if (confirm(`"${menu.title}" 메뉴를 삭제하시겠습니까? 하위 메뉴도 함께 삭제됩니다.`)) {
            isSubmitting = true;
            try {
                await menuStore.deleteMenu(menu.id);
                onClose();
            } catch (error) {
                console.error('메뉴 삭제 실패:', error);
            } finally {
                isSubmitting = false;
            }
        }
    }

    function handleOpenChange(isOpen: boolean) {
        open = isOpen;
        if (!isOpen) {
            onClose();
        }
    }
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
    <Dialog.Content class="sm:max-w-[500px]">
        <Dialog.Header>
            <Dialog.Title>메뉴 수정</Dialog.Title>
            <Dialog.Description>
                메뉴 정보를 수정합니다.
            </Dialog.Description>
        </Dialog.Header>

        {#if menu}
            <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
                <div class="grid gap-4">
                    <!-- 제목 -->
                    <div class="grid gap-2">
                        <Label for="edit-title">제목 *</Label>
                        <Input
                            id="edit-title"
                            bind:value={title}
                            placeholder="메뉴 제목"
                            required
                        />
                    </div>

                    <!-- URL -->
                    <div class="grid gap-2">
                        <Label for="edit-url">URL *</Label>
                        <Input
                            id="edit-url"
                            bind:value={url}
                            placeholder="/path 또는 https://..."
                            required
                        />
                    </div>

                    <!-- 아이콘 -->
                    <div class="grid gap-2">
                        <Label for="edit-icon">아이콘</Label>
                        <Select.Root type="single" bind:value={icon}>
                            <Select.Trigger class="w-full">
                                {icon || '아이콘 선택 (선택사항)'}
                            </Select.Trigger>
                            <Select.Content class="max-h-60">
                                <Select.Item value="">없음</Select.Item>
                                {#each MENU_ICONS as iconName}
                                    <Select.Item value={iconName}>{iconName}</Select.Item>
                                {/each}
                            </Select.Content>
                        </Select.Root>
                    </div>

                    <!-- 단축키 -->
                    <div class="grid gap-2">
                        <Label for="edit-shortcut">단축키</Label>
                        <Input
                            id="edit-shortcut"
                            bind:value={shortcut}
                            placeholder="예: Ctrl+M"
                        />
                    </div>

                    <!-- 설명 -->
                    <div class="grid gap-2">
                        <Label for="edit-description">설명</Label>
                        <Input
                            id="edit-description"
                            bind:value={description}
                            placeholder="메뉴 설명 (툴팁으로 표시)"
                        />
                    </div>

                    <!-- 타겟 -->
                    <div class="grid gap-2">
                        <Label for="edit-target">링크 열기</Label>
                        <Select.Root type="single" bind:value={target}>
                            <Select.Trigger class="w-full">
                                {target === '_blank' ? '새 탭에서 열기' : '현재 탭에서 열기'}
                            </Select.Trigger>
                            <Select.Content>
                                <Select.Item value="_self">현재 탭에서 열기</Select.Item>
                                <Select.Item value="_blank">새 탭에서 열기</Select.Item>
                            </Select.Content>
                        </Select.Root>
                    </div>

                    <!-- 토글 옵션 -->
                    <div class="space-y-3">
                        <div class="flex items-center justify-between">
                            <Label for="edit-show-header">헤더에 표시</Label>
                            <Switch id="edit-show-header" bind:checked={showInHeader} />
                        </div>
                        <div class="flex items-center justify-between">
                            <Label for="edit-show-sidebar">사이드바에 표시</Label>
                            <Switch id="edit-show-sidebar" bind:checked={showInSidebar} />
                        </div>
                        <div class="flex items-center justify-between">
                            <Label for="edit-is-active">활성화</Label>
                            <Switch id="edit-is-active" bind:checked={isActive} />
                        </div>
                    </div>
                </div>

                <Dialog.Footer class="flex justify-between">
                    <Button
                        type="button"
                        variant="destructive"
                        onclick={handleDelete}
                        disabled={isSubmitting}
                    >
                        <Trash2 class="mr-2 h-4 w-4" />
                        삭제
                    </Button>
                    <div class="flex gap-2">
                        <Button type="button" variant="outline" onclick={() => handleOpenChange(false)}>
                            취소
                        </Button>
                        <Button type="submit" disabled={isSubmitting || !title.trim() || !url.trim()}>
                            {#if isSubmitting}
                                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                            {/if}
                            저장
                        </Button>
                    </div>
                </Dialog.Footer>
            </form>
        {/if}
    </Dialog.Content>
</Dialog.Root>
