<script lang="ts">
    import {
        Dialog,
        DialogContent,
        DialogDescription,
        DialogFooter,
        DialogHeader,
        DialogTitle,
        DialogTrigger
    } from '$lib/components/ui/dialog/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import type { Snippet } from 'svelte';

    interface Props {
        title?: string;
        description?: string;
        /** `false` 를 돌려주면 대화상자를 닫지 않는다(그 사이 다른 대상으로 다시 열린 경우) */
        onConfirm: () => Promise<void | false>;
        isLoading?: boolean;
        trigger?: Snippet;
        /**
         * 외부에서 열고 닫을 때 `bind:open` 으로 쓴다. 바인딩하지 않으면 지금처럼
         * 트리거 버튼이 스스로 연다(글 삭제 사용처).
         */
        open?: boolean;
        /** false 면 트리거 버튼을 그리지 않는다 — 외부 제어(`bind:open`) 전용 */
        showTrigger?: boolean;
        confirmLabel?: string;
        loadingLabel?: string;
        confirmVariant?: 'destructive' | 'default';
        /** 확인 없이 닫혔을 때(취소 버튼·바깥 탭·Esc·X) 한 번 호출된다 */
        onCancel?: () => void;
    }

    let {
        title = '삭제 확인',
        description = '정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
        onConfirm,
        isLoading = false,
        trigger,
        open = $bindable(false),
        showTrigger = true,
        confirmLabel = '삭제',
        loadingLabel = '삭제 중...',
        confirmVariant = 'destructive',
        onCancel
    }: Props = $props();

    // 확인 처리 중에 바깥 탭으로 닫혀도 「취소」로 세지 않는다.
    let confirming = false;

    async function handleConfirm(): Promise<void> {
        confirming = true;
        try {
            const result = await onConfirm();
            if (result !== false) open = false;
        } finally {
            confirming = false;
        }
    }

    function handleCancel(): void {
        open = false;
        onCancel?.();
    }

    // bits-ui 는 사용자 조작(바깥 탭·Esc·X)으로 닫힐 때만 이 콜백을 부른다.
    // 위 handleCancel/handleConfirm 처럼 코드에서 open 을 바꾸면 불리지 않는다.
    function handleOpenChange(next: boolean): void {
        if (!next && !confirming) onCancel?.();
    }
</script>

<Dialog bind:open onOpenChange={handleOpenChange}>
    {#if showTrigger}
        <DialogTrigger>
            {#if trigger}
                {@render trigger()}
            {:else}
                <Button variant="destructive" size="sm">
                    <Trash2 class="mr-2 h-4 w-4" />
                    삭제
                </Button>
            {/if}
        </DialogTrigger>
    {/if}
    <DialogContent>
        <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
            <Button variant="outline" onclick={handleCancel} disabled={isLoading}>취소</Button>
            <Button variant={confirmVariant} onclick={handleConfirm} disabled={isLoading}>
                {#if isLoading}
                    {loadingLabel}
                {:else}
                    {confirmLabel}
                {/if}
            </Button>
        </DialogFooter>
    </DialogContent>
</Dialog>
