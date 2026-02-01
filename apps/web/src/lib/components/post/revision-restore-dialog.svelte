<script lang="ts">
    /**
     * 버전 복원 확인 다이얼로그
     */
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import RotateCcw from '@lucide/svelte/icons/rotate-ccw';

    interface Props {
        open: boolean;
        version: number;
        onConfirm: () => Promise<void> | void;
        onCancel: () => void;
    }

    let { open = $bindable(), version, onConfirm, onCancel }: Props = $props();

    let confirming = $state(false);

    async function handleConfirm() {
        confirming = true;
        try {
            await onConfirm();
            open = false;
        } finally {
            confirming = false;
        }
    }
</script>

<Dialog.Root bind:open>
    <Dialog.Content class="sm:max-w-md">
        <Dialog.Header>
            <Dialog.Title>버전 복원 확인</Dialog.Title>
            <Dialog.Description>
                v{version} 버전으로 게시물을 복원하시겠습니까? 현재 내용은 새로운 수정 이력으로 저장됩니다.
            </Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer>
            <Button variant="outline" onclick={onCancel} disabled={confirming}>취소</Button>
            <Button onclick={handleConfirm} disabled={confirming}>
                <RotateCcw class="mr-1.5 h-4 w-4" />
                {confirming ? '복원 중...' : '복원'}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
