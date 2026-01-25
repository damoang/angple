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
        onConfirm: () => Promise<void>;
        isLoading?: boolean;
        trigger?: Snippet;
    }

    let {
        title = '삭제 확인',
        description = '정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
        onConfirm,
        isLoading = false,
        trigger
    }: Props = $props();

    let open = $state(false);

    async function handleConfirm(): Promise<void> {
        await onConfirm();
        open = false;
    }
</script>

<Dialog bind:open>
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
    <DialogContent>
        <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
            <Button variant="outline" onclick={() => (open = false)} disabled={isLoading}>
                취소
            </Button>
            <Button variant="destructive" onclick={handleConfirm} disabled={isLoading}>
                {#if isLoading}
                    삭제 중...
                {:else}
                    삭제
                {/if}
            </Button>
        </DialogFooter>
    </DialogContent>
</Dialog>
