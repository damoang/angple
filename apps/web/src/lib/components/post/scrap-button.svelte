<script lang="ts">
    /**
     * 스크랩(북마크) 토글 버튼
     * g5_scrap 테이블 직접 연동
     */
    import { Button } from '$lib/components/ui/button/index.js';
    import Bookmark from '@lucide/svelte/icons/bookmark';

    interface Props {
        boardId: string;
        postId: string | number;
        initialScrapped?: boolean;
        size?: 'default' | 'sm' | 'lg' | 'icon';
        variant?: 'default' | 'outline' | 'ghost';
    }

    let {
        boardId,
        postId,
        initialScrapped = false,
        size = 'icon',
        variant = 'ghost'
    }: Props = $props();

    let scrapped = $state(initialScrapped);
    let loading = $state(false);

    async function toggleScrap() {
        if (loading) return;
        loading = true;
        try {
            if (scrapped) {
                const res = await fetch('/api/scraps', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ boardId, postId: String(postId) })
                });
                if (res.ok) scrapped = false;
            } else {
                const res = await fetch('/api/scraps', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ boardId, postId: String(postId) })
                });
                if (res.ok) scrapped = true;
            }
        } catch (err) {
            console.error('스크랩 토글 실패:', err);
        } finally {
            loading = false;
        }
    }
</script>

<Button
    {variant}
    {size}
    onclick={toggleScrap}
    disabled={loading}
    aria-label={scrapped ? '스크랩 해제' : '스크랩'}
    aria-pressed={scrapped}
    class={scrapped ? 'text-yellow-500 hover:text-yellow-600' : ''}
>
    <Bookmark class="h-4 w-4" fill={scrapped ? 'currentColor' : 'none'} />
    {#if size !== 'icon'}
        <span class="ml-1.5">{scrapped ? '스크랩됨' : '스크랩'}</span>
    {/if}
</Button>
