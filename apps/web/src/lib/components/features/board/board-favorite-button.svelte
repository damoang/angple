<script lang="ts">
    /**
     * 게시판 즐겨찾기(단축키) 등록/해제 버튼
     * 게시판 목록 헤더에 별 아이콘으로 표시
     */
    import { Button } from '$lib/components/ui/button/index.js';
    import Star from '@lucide/svelte/icons/star';
    import {
        boardFavoritesStore,
        slotLabel,
        type SlotNumber
    } from '$lib/stores/board-favorites.svelte';
    import { toast } from 'svelte-sonner';

    interface Props {
        boardId: string;
        boardTitle: string;
    }

    let { boardId, boardTitle }: Props = $props();

    const registeredSlot = $derived(boardFavoritesStore.findSlot(boardId));
    const isFavorite = $derived(registeredSlot !== null);

    function toggle() {
        if (isFavorite) {
            const slot = registeredSlot as SlotNumber;
            const label = slotLabel(slot);
            boardFavoritesStore.removeSlot(slot);
            toast.success(`즐겨찾기 '${label}' 해제됨`);
        } else {
            const slot = boardFavoritesStore.addAuto(boardId, boardTitle);
            if (slot !== null) {
                const label = slotLabel(slot);
                toast.success(`즐겨찾기 '${label}'에 등록됨`);
            } else {
                toast.error('즐겨찾기 슬롯이 모두 사용 중입니다');
            }
        }
    }
</script>

<Button
    variant="ghost"
    size="icon"
    onclick={toggle}
    aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 등록'}
    aria-pressed={isFavorite}
    title={isFavorite
        ? `즐겨찾기 '${slotLabel(registeredSlot!)}' (클릭하여 해제)`
        : '이 게시판을 즐겨찾기에 등록'}
    class="h-8 w-8 {isFavorite
        ? 'text-yellow-500 hover:text-yellow-600'
        : 'text-muted-foreground hover:text-yellow-500'}"
>
    <Star class="h-4 w-4" fill={isFavorite ? 'currentColor' : 'none'} />
</Button>
