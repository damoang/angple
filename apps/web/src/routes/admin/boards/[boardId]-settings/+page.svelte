<script lang="ts">
    /**
     * 레거시 게시판 설정 페이지 → 종합 설정 페이지로 리다이렉트
     */
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';

    const boardId = $derived($page.params.boardId || '');

    onMount(() => {
        goto(`/admin/boards/${boardId}#display`, { replaceState: true });
    });
</script>

<div class="flex items-center justify-center py-24">
    <p class="text-muted-foreground text-sm">리다이렉트 중...</p>
</div>
