<script lang="ts">
    import { menuStore } from '$lib/stores/menu-store.svelte';
    import { MENU_ICONS, type CreateMenuRequest } from '$lib/types/menu';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import { Switch } from '$lib/components/ui/switch';
    import * as Dialog from '$lib/components/ui/dialog';
    import * as Select from '$lib/components/ui/select';
    import { Loader2 } from '@lucide/svelte/icons';

    interface Props {
        open: boolean;
        parentId: number | null;
        onSuccess: () => void;
    }

    let { open = $bindable(), parentId, onSuccess }: Props = $props();

    // 폼 상태
    let title = $state('');
    let url = $state('');
    let icon = $state('');
    let target = $state('_self');
    let showInHeader = $state(false);
    let showInSidebar = $state(true);
    let isActive = $state(true);
    let isSubmitting = $state(false);

    function resetForm() {
        title = '';
        url = '';
        icon = '';
        target = '_self';
        showInHeader = false;
        showInSidebar = true;
        isActive = true;
    }

    async function handleSubmit() {
        if (!title.trim() || !url.trim()) {
            return;
        }

        isSubmitting = true;
        try {
            const request: CreateMenuRequest = {
                parent_id: parentId,
                title: title.trim(),
                url: url.trim(),
                icon: icon || undefined,
                target,
                show_in_header: showInHeader,
                show_in_sidebar: showInSidebar,
                view_level: 0,
                is_active: isActive
            };

            await menuStore.createMenu(request);
            resetForm();
            onSuccess();
        } catch (error) {
            console.error('메뉴 생성 실패:', error);
        } finally {
            isSubmitting = false;
        }
    }

    function handleOpenChange(isOpen: boolean) {
        open = isOpen;
        if (!isOpen) {
            resetForm();
        }
    }
</script>

<Dialog.Root {open} onOpenChange={handleOpenChange}>
    <Dialog.Content class="sm:max-w-[500px]">
        <Dialog.Header>
            <Dialog.Title>
                {parentId ? '하위 메뉴 추가' : '새 메뉴 추가'}
            </Dialog.Title>
            <Dialog.Description>
                메뉴 정보를 입력하세요. 제목과 URL은 필수입니다.
            </Dialog.Description>
        </Dialog.Header>

        <form
            onsubmit={(e) => {
                e.preventDefault();
                handleSubmit();
            }}
            class="space-y-4"
        >
            <div class="grid gap-4">
                <!-- 제목 -->
                <div class="grid gap-2">
                    <Label for="title">제목 *</Label>
                    <Input id="title" bind:value={title} placeholder="메뉴 제목" required />
                </div>

                <!-- URL -->
                <div class="grid gap-2">
                    <Label for="url">URL *</Label>
                    <Input
                        id="url"
                        bind:value={url}
                        placeholder="/path 또는 https://..."
                        required
                    />
                </div>

                <!-- 아이콘 -->
                <div class="grid gap-2">
                    <Label for="icon">아이콘</Label>
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

                <!-- 타겟 -->
                <div class="grid gap-2">
                    <Label for="target">링크 열기</Label>
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
                        <Label for="show-header">헤더에 표시</Label>
                        <Switch id="show-header" bind:checked={showInHeader} />
                    </div>
                    <div class="flex items-center justify-between">
                        <Label for="show-sidebar">사이드바에 표시</Label>
                        <Switch id="show-sidebar" bind:checked={showInSidebar} />
                    </div>
                    <div class="flex items-center justify-between">
                        <Label for="is-active">활성화</Label>
                        <Switch id="is-active" bind:checked={isActive} />
                    </div>
                </div>
            </div>

            <Dialog.Footer>
                <Button type="button" variant="outline" onclick={() => handleOpenChange(false)}>
                    취소
                </Button>
                <Button type="submit" disabled={isSubmitting || !title.trim() || !url.trim()}>
                    {#if isSubmitting}
                        <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                    {/if}
                    추가
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>
