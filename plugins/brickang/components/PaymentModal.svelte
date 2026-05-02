<!--
  PaymentModal.svelte
  - 등급 선택 → 수량 → 메시지 (익명은 비활성) → PG 선택 → /orders/start
  - SDK/redirect 처리 후 콜백에서 /orders/confirm
  - 익명/일반/은/금 등급은 KRW PG (Toss/Naver) 만 노출, PayPal 은 1000원 이상에서만.
-->
<script lang="ts">
    import { brickStore } from '../stores/brick.svelte.js';
    import { paymentStore } from '../stores/payment.svelte.js';
    import BrickCard from './BrickCard.svelte';

    interface Props {
        buildingId: number;
        open: boolean;
        onclose?: () => void;
        oncomplete?: (
            bricks: Array<{ id: number; position: { x: number; y: number; z: number } }>
        ) => void;
    }
    let { buildingId, open = $bindable(false), onclose, oncomplete }: Props = $props();

    let provider = $state<'toss' | 'naver' | 'paypal'>('toss');
    let busy = $state(false);

    let allowedProviders = $derived.by(() => {
        const types = brickStore.selected;
        if (!types) return ['toss', 'naver'] as const;
        const list: Array<'toss' | 'naver' | 'paypal'> = ['toss', 'naver'];
        if (types.price_krw >= 1000) list.push('paypal');
        return list;
    });

    async function handlePay() {
        const sel = brickStore.selected;
        if (!sel) return;
        busy = true;
        try {
            const start = await paymentStore.start({
                brick_type: sel.slug,
                quantity: brickStore.quantity,
                message: sel.is_anonymous ? null : brickStore.message,
                building_id: buildingId,
                provider,
                returnUrl: `${window.location.origin}/brickang/payment/return`,
                cancelUrl: `${window.location.origin}/brickang/payment/cancel`
            });

            if (start.payment.redirectUrl) {
                window.location.href = start.payment.redirectUrl;
                return;
            }

            // SDK 방식 PG (Toss 등) — 실제 SDK 호출은 PG별로 구현. 여기서는 디버그 로그만.
            console.info('[brickang/payment] sdkParams:', start.payment.sdkParams);

            // 데모용: confirm 도 즉시 호출 (실제로는 PG 콜백 후 호출됨)
            // sandbox 환경에서만 적용. 운영 통합 시 실제 콜백 라우트(/brickang/payment/return) 에서 처리.
            const confirm = await paymentStore.confirm({
                order_uid: start.order_uid,
                pg_order_id: start.payment.pgOrderId,
                amount: start.amount
            });
            oncomplete?.(confirm.bricks);
            open = false;
            onclose?.();
        } catch (err) {
            console.error('[brickang/payment] failed:', err);
        } finally {
            busy = false;
        }
    }
</script>

{#if open}
    <div class="modal-backdrop" role="presentation" onclick={() => onclose?.()}>
        <div
            class="modal"
            role="dialog"
            aria-modal="true"
            aria-label="브릭앙 결제"
            onclick={(e) => e.stopPropagation()}
        >
            <h2 class="modal__title">벽돌 등급 선택</h2>
            <div class="modal__cards">
                {#each brickStore.brickTypes as t (t.id)}
                    <BrickCard
                        brickType={t}
                        selected={brickStore.selectedSlug === t.slug}
                        onselect={(slug) => brickStore.select(slug)}
                    />
                {/each}
            </div>

            {#if brickStore.selected}
                <div class="modal__row">
                    <label for="qty">수량 (1~100)</label>
                    <input
                        id="qty"
                        type="number"
                        min="1"
                        max="100"
                        value={brickStore.quantity}
                        oninput={(e) =>
                            brickStore.setQuantity(Number((e.target as HTMLInputElement).value))}
                    />
                </div>

                <div class="modal__row">
                    <label for="msg">메시지 (최대 100자)</label>
                    <input
                        id="msg"
                        type="text"
                        maxlength="100"
                        value={brickStore.message}
                        disabled={brickStore.selected.is_anonymous}
                        placeholder={brickStore.selected.is_anonymous
                            ? '익명 등급은 메시지를 남길 수 없습니다'
                            : '응원 메시지를 남겨보세요'}
                        oninput={(e) => brickStore.setMessage((e.target as HTMLInputElement).value)}
                    />
                </div>

                <div class="modal__row">
                    <span>결제수단</span>
                    <div class="modal__providers">
                        {#each allowedProviders as p (p)}
                            <button
                                type="button"
                                class:active={provider === p}
                                onclick={() => (provider = p)}
                            >
                                {p}
                            </button>
                        {/each}
                    </div>
                </div>

                <div class="modal__total">
                    합계: {brickStore.totalAmountKrw.toLocaleString()} 원
                </div>

                <div class="modal__actions">
                    <button type="button" onclick={() => onclose?.()} disabled={busy}>취소</button>
                    <button type="button" onclick={handlePay} disabled={busy}>
                        {busy ? '결제 중…' : '결제하기'}
                    </button>
                </div>

                {#if paymentStore.error}
                    <p class="modal__error">{paymentStore.error}</p>
                {/if}
            {/if}
        </div>
    </div>
{/if}

<style>
    .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
    }
    .modal {
        background: #fff;
        padding: 1.5rem;
        border-radius: 8px;
        width: 90vw;
        max-width: 600px;
        max-height: 90vh;
        overflow-y: auto;
    }
    .modal__title {
        margin-top: 0;
    }
    .modal__cards {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin: 1rem 0;
    }
    .modal__row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
    }
    .modal__row label,
    .modal__row span {
        min-width: 100px;
        font-weight: 500;
    }
    .modal__row input {
        flex: 1;
        padding: 0.4rem 0.6rem;
        border: 1px solid #ccc;
        border-radius: 4px;
    }
    .modal__providers {
        display: flex;
        gap: 0.5rem;
    }
    .modal__providers button {
        padding: 0.4rem 0.8rem;
        border: 1px solid #ccc;
        background: #fff;
        border-radius: 4px;
        cursor: pointer;
    }
    .modal__providers button.active {
        background: #2962ff;
        color: #fff;
        border-color: #2962ff;
    }
    .modal__total {
        text-align: right;
        font-size: 1.2rem;
        font-weight: 600;
        margin: 1rem 0;
    }
    .modal__actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
    }
    .modal__actions button {
        padding: 0.5rem 1rem;
        cursor: pointer;
    }
    .modal__error {
        color: #c00;
        margin-top: 0.5rem;
    }
</style>
