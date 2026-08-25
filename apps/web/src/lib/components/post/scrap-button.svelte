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
        /** true 면 모바일(<640px)에서 라벨을 숨기고 아이콘만 표시. 기본값 false=현행 유지. size!=='icon' 일 때만 라벨이 존재한다. */
        labelHiddenMobile?: boolean;
    }

    let {
        boardId,
        postId,
        initialScrapped = false,
        size = 'icon',
        variant = 'ghost',
        labelHiddenMobile = false
    }: Props = $props();

    let scrapped = $state(initialScrapped);
    let loading = $state(false);
    let userInteracted = $state(false);
    // bug/13722: userInteracted 가 글을 넘어가도 true 로 남아, 이전 글에서 스크랩한 상태(scrapped=true)가
    // 다음 글(SPA 이동)로 누수돼 '스크랩됨'이 잘못 표시됐다("되돌아가면 정상"=새 인스턴스로 리셋되던 것).
    // postId 가 바뀌면 조작 플래그를 리셋하고 새 글의 스크랩 상태로 동기화한다(인스턴스 재사용 대비).
    let syncedPostId: string | number | undefined = undefined;

    $effect(() => {
        if (syncedPostId !== postId) {
            syncedPostId = postId;
            userInteracted = false;
            scrapped = initialScrapped;
        } else if (!userInteracted) {
            // 같은 글에서 initialScrapped 가 늦게(SSR 스트리밍) 도착하면 동기화(사용자 조작 전만).
            scrapped = initialScrapped;
        }
    });

    async function toggleScrap() {
        if (loading) return;
        userInteracted = true;

        // Optimistic UI: 즉시 토글 → 실패 시 롤백
        const prev = scrapped;
        scrapped = !prev;
        loading = true;

        try {
            const res = await fetch('/api/scraps', {
                method: prev ? 'DELETE' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ boardId, postId: String(postId) })
            });
            if (!res.ok) {
                scrapped = prev; // 롤백
            }
        } catch (err) {
            console.error('스크랩 토글 실패:', err);
            scrapped = prev; // 롤백
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
    title={scrapped ? '스크랩 해제' : '스크랩'}
    aria-label={scrapped ? '스크랩 해제' : '스크랩'}
    aria-pressed={scrapped}
    class={scrapped ? 'text-yellow-500 hover:text-yellow-600' : ''}
>
    <Bookmark class="h-4 w-4" fill={scrapped ? 'currentColor' : 'none'} />
    {#if size !== 'icon'}
        <span class="ml-1.5 {labelHiddenMobile ? 'hidden sm:inline' : ''}"
            >{scrapped ? '스크랩됨' : '스크랩'}</span
        >
    {/if}
</Button>
