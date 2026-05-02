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
    import { brickangApi } from '../lib/api.js';
    import type { BrickDto, BuildingDto } from '../lib/api.js';

    interface Props {
        buildingId: number;
        open: boolean;
        building?: BuildingDto | null;
        bricks?: BrickDto[];
        onclose?: () => void;
        oncomplete?: (
            bricks: Array<{ id: number; position: { x: number; y: number; z: number } }>
        ) => void;
    }
    let {
        buildingId,
        open = $bindable(false),
        building = null,
        bricks = [],
        onclose,
        oncomplete
    }: Props = $props();

    let provider = $state<'toss' | 'naver' | 'paypal'>('toss');
    let busy = $state(false);

    // Phase 2: 자유 배치 (silver/gold/diamond)
    let isFreePlacement = $derived(
        brickStore.selected
            ? ['silver', 'gold', 'diamond'].includes(brickStore.selected.slug)
            : false
    );
    let lockId = $state<number | null>(null);
    let lockedPosition = $state<{ x: number; y: number; z: number } | null>(null);
    let lockExpiresAt = $state<number | null>(null);
    let lockCountdown = $state<number>(0);
    let placeMode = $state(false);
    let placeError = $state<string | null>(null);

    // 카운트다운 갱신 (1s)
    let countdownTimer: ReturnType<typeof setInterval> | null = null;
    $effect(() => {
        if (lockExpiresAt) {
            countdownTimer = setInterval(() => {
                const remain = Math.max(0, Math.floor((lockExpiresAt! - Date.now()) / 1000));
                lockCountdown = remain;
                if (remain <= 0) {
                    placeError = '위치 lock 이 만료되었습니다. 다시 선택해 주세요.';
                    lockId = null;
                    lockedPosition = null;
                    lockExpiresAt = null;
                    if (countdownTimer) clearInterval(countdownTimer);
                }
            }, 1000);
        }
        return () => {
            if (countdownTimer) clearInterval(countdownTimer);
        };
    });

    async function handlePositionPick(pos: { x: number; y: number; z: number }) {
        const sel = brickStore.selected;
        if (!sel) return;
        placeError = null;
        try {
            // 기존 lock 이 있으면 해제 (UI 상 다른 좌표로 다시 클릭한 경우)
            if (lockId) {
                try {
                    await brickangApi.releaseLock(lockId);
                } catch {
                    /* 무시 */
                }
            }
            const r = await brickangApi.acquireLock({
                building_id: buildingId,
                brick_type_slug: sel.slug,
                position: pos
            });
            lockId = r.lock_id;
            lockedPosition = r.position;
            lockExpiresAt = new Date(r.expires_at).getTime();
            placeMode = false;
        } catch (err) {
            const msg = (err as Error).message;
            if (msg.includes('409') || msg.includes('position_locked')) {
                placeError = '이 좌표는 다른 사용자가 선점했습니다. 다른 좌표를 선택해 주세요.';
            } else {
                placeError = msg;
            }
        }
    }

    async function handlePay() {
        const sel = brickStore.selected;
        if (!sel) return;
        if (isFreePlacement && !lockId) {
            placeError = '먼저 위치를 선택해 주세요.';
            return;
        }
        busy = true;
        try {
            const start = await paymentStore.start({
                brick_type: sel.slug,
                quantity: brickStore.quantity,
                message: sel.is_anonymous ? null : brickStore.message,
                building_id: buildingId,
                provider,
                returnUrl: `${window.location.origin}/brickang/payment/return`,
                cancelUrl: `${window.location.origin}/brickang/payment/cancel`,
                lock_id: isFreePlacement ? lockId : null,
                position: isFreePlacement ? lockedPosition : null
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
            if (confirm.lock_fallback) {
                placeError =
                    '선택한 위치 lock 이 만료되어 자동 배치되었습니다. 다음번엔 더 빨리 결제해 주세요.';
            }
            // lock 행은 confirm 단일 tx 안에서 삭제되므로 별도 release 불필요
            lockId = null;
            lockedPosition = null;
            lockExpiresAt = null;
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

                {#if isFreePlacement}
                    <div class="modal__row modal__free-placement">
                        <span>위치 선택</span>
                        <div class="free-info">
                            {#if lockedPosition}
                                <p class="locked">
                                    선택 좌표: ({lockedPosition.x}, {lockedPosition.y}, {lockedPosition.z})
                                    {#if lockCountdown > 0}
                                        <span class="countdown">남은 시간: {lockCountdown}초</span>
                                    {/if}
                                </p>
                            {:else}
                                <p class="hint">자유 배치 등급은 위치를 직접 선택해야 합니다.</p>
                            {/if}
                            <button
                                type="button"
                                class="place-btn"
                                onclick={() => (placeMode = !placeMode)}
                            >
                                {placeMode
                                    ? '위치 선택 종료'
                                    : lockedPosition
                                      ? '다시 선택'
                                      : '위치 선택'}
                            </button>
                        </div>
                    </div>

                    {#if placeMode && building}
                        {#await import('./BuildingViewer.svelte') then mod}
                            <mod.default
                                {building}
                                {bricks}
                                mode="place"
                                placingType={brickStore.selected.slug as
                                    | 'silver'
                                    | 'gold'
                                    | 'diamond'}
                                onPositionPick={handlePositionPick}
                            />
                        {/await}
                    {/if}

                    {#if placeError}
                        <p class="modal__error">{placeError}</p>
                    {/if}
                {/if}

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
    .modal__free-placement {
        align-items: flex-start;
    }
    .free-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .free-info .locked {
        margin: 0;
        color: #2962ff;
        font-weight: 500;
    }
    .free-info .countdown {
        margin-left: 8px;
        color: #c33;
        font-size: 0.9em;
    }
    .free-info .hint {
        margin: 0;
        color: #666;
        font-size: 0.9em;
    }
    .place-btn {
        align-self: flex-start;
        padding: 0.4rem 0.8rem;
        background: #2962ff;
        color: #fff;
        border: 0;
        border-radius: 4px;
        cursor: pointer;
    }
</style>
