<script lang="ts">
    // 럭키 당첨 🍀 뱃지: 글/댓글에 럭키 당첨(포인트·경험치)이 있으면 작성자 옆에 표시.
    // 모든 이용자에게 보인다(홍보용). amount·exp 가 둘 다 0 이하이거나 없으면 아무것도 렌더하지 않는다.
    // 회차 당첨(tier 있음)이면 옆에 작은 라벨 「회차명 · 월/일 시:분」(KST)을 붙인다. 레거시는 배지만.
    import { formatLuckyBadge, formatLuckyMeta, formatLuckyTitle } from '$lib/utils/lucky-badge';

    interface Props {
        /** 당첨 포인트 */
        amount: number;
        /** 당첨 경험치 */
        exp?: number;
        /** 당첨 회차명. 레거시 당첨이면 없음 */
        tier?: string;
        /** 당첨 시각 (ISO, +09:00) */
        at?: string;
    }

    let { amount, exp = 0, tier, at }: Props = $props();

    const label = $derived(formatLuckyBadge(amount, exp));
    const meta = $derived(formatLuckyMeta(tier, at));
    const title = $derived(formatLuckyTitle(tier, at));
</script>

{#if label}
    <span
        class="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        {title}
    >
        {label}
    </span>
    {#if meta}
        <span class="text-muted-foreground text-[10px] leading-none" {title}>{meta}</span>
    {/if}
{/if}
