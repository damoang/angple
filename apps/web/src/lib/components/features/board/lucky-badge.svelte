<script lang="ts">
    // 럭키 당첨 🍀 뱃지: 글/댓글에 럭키 포인트 당첨 금액이 있으면 작성자 옆에 표시.
    // 모든 이용자에게 보인다(홍보용). amount 가 0 이하이거나 없으면 아무것도 렌더하지 않는다.
    interface Props {
        amount: number;
    }

    let { amount }: Props = $props();
</script>

{#if amount > 0}
    <span
        class="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        title="럭키 포인트 당첨"
    >
        🍀{amount.toLocaleString()}p
    </span>
{/if}
