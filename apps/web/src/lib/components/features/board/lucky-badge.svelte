<script lang="ts">
    // 럭키 당첨 🍀 뱃지: 글/댓글에 럭키 당첨(포인트·경험치)이 있으면 작성자 옆에 표시.
    // 모든 이용자에게 보인다(홍보용). amount·exp 가 둘 다 0 이하이거나 없으면 아무것도 렌더하지 않는다.
    import { formatLuckyBadge } from '$lib/utils/lucky-badge';

    interface Props {
        /** 당첨 포인트 */
        amount: number;
        /** 당첨 경험치 */
        exp?: number;
    }

    let { amount, exp = 0 }: Props = $props();

    const label = $derived(formatLuckyBadge(amount, exp));
</script>

{#if label}
    <span
        class="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        title="럭키 당첨"
    >
        {label}
    </span>
{/if}
