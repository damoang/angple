<!--
    Phase B-1 매니저 권고 (4/30): 게시판 목록 N번째 row 상단 ATF 광고 slot.
    AdSense 정책: 광고와 콘텐츠 명확 구분 (border + "광고" 라벨 필수).
    노출 빈도: 5/12/19번째 row (광고 밀도 균형 — 매니저 권고에 따라 조정 가능).
-->
<script lang="ts">
    import AdSlot from '$lib/components/ui/ad-slot/ad-slot.svelte';

    interface Props {
        rowIndex: number;
    }

    let { rowIndex }: Props = $props();

    const showAd = $derived(rowIndex === 5 || rowIndex === 12 || rowIndex === 19);
</script>

{#if showAd}
    <div
        class="post-row-ad border-border/40 bg-muted/10 border-y border-dashed px-2 py-1"
        role="complementary"
        aria-label="광고"
    >
        <div class="text-muted-foreground/70 text-[10px] leading-none">광고</div>
        <AdSlot
            position="board-list-row-top"
            height="90px"
            slotKey={`board-list-row-${rowIndex}`}
        />
    </div>
{/if}
