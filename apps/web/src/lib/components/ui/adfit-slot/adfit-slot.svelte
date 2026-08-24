<script lang="ts">
    /**
     * 카카오 애드핏 광고 슬롯
     * GAM이 빈 슬롯일 때 폴백으로 사용
     *
     * audit P1-C (5/22 미팅 직결): SDK 로드 status 별 Dantry 이벤트 송신.
     * - success / failed / timeout 분리 → fill rate 정확도 ↑
     */
    import { onMount, onDestroy, tick } from 'svelte';
    import { loadAdfitSDK, renderAdfitAd, destroyAdfitAd } from '$lib/utils/adfit-loader.js';
    import { trackAdEvent } from '$lib/services/ad-telemetry.js';
    import type { AdfitUnit } from '$lib/config/ad-config.js';

    interface Props {
        unit: AdfitUnit;
        id: string;
        /** GAM position 라벨 (텔레메트리 분류용) */
        position?: string;
    }

    let { unit, id, position }: Props = $props();

    let ready = $state(false);
    let destroyed = false;
    const containerId = `adfit-${id}`;

    /**
     * ⛔ **카카오 애드핏은 한 페이지에 같은 `data-ad-unit` 을 두 번 허용하지 않는다.**
     *    콘솔에 `[ad-fit-web] 광고 data-ad-unit 은 유일한 값이어야 합니다.` 가
     *    페이지마다 여러 번 찍혔다(2026-08-24 실사용자 로그).
     *
     *    원인은 설정이다. `ADFIT_FALLBACK_MAP` 은 12개 GAM 포지션을 **6개 유닛**에 매핑하는데,
     *    `board-list-infeed`·`comment-infeed` 는 **한 페이지에 여러 번 반복**되는 슬롯이다.
     *    GAM 이 비면 그것들이 전부 같은 애드핏 유닛으로 폴백해 중복이 된다.
     *
     *    ⚠️ 그냥 두면 애드핏이 예외를 던지고, 그 예외가 카카오 에러 수집기
     *    (`aem-kakao-collector.onkakao.net`)를 **429 가 날 때까지** 두들긴다.
     *
     *    → **먼저 잡은 슬롯만 렌더한다.** 중복은 어차피 애드핏이 안 그리므로 잃는 수익이 없다.
     */
    const claimed: Set<string> = ((
        globalThis as unknown as { __adfitClaimed?: Set<string> }
    ).__adfitClaimed ??= new Set<string>());

    /** 실제로 잡은 유닛. ⛔ 반납할 때 이 값을 써야 한다 — prop 이 바뀌어도 잡은 것을 놓는다. */
    let claimedUnit: string | null = null;

    onMount(async () => {
        // ⛔ 반드시 **await 이전**에 잡는다. await 뒤로 미루면 두 슬롯이 같이 통과한다.
        //    onMount 콜백은 마운트 플러시에서 동기적으로 실행되므로 여기까지는 경합이 없다.
        if (claimed.has(unit.unitId)) {
            // 무엇이 얼마나 겹치는지 알아야 매핑을 고칠 수 있다.
            trackAdEvent('ad_fallback_duplicate_unit', {
                ad_unit: unit.unitId,
                position: position ?? '',
                reason: 'duplicate'
            });
            return;
        }
        claimed.add(unit.unitId);
        claimedUnit = unit.unitId;

        const status = await loadAdfitSDK();
        if (destroyed) return;

        // P1-C: SDK 로드 결과를 Dantry 로 보고
        const eventName =
            status === 'success'
                ? 'ad_fallback_success'
                : status === 'timeout'
                  ? 'ad_fallback_timeout'
                  : 'ad_fallback_failed';
        trackAdEvent(eventName, {
            ad_unit: unit.unitId,
            position: position ?? '',
            reason: status
        });

        // success 가 아니면 ins 렌더 의미 없음 (SDK 함수 부재)
        if (status !== 'success') return;

        ready = true;
        // ins 엘리먼트가 DOM에 렌더링된 후 명시적으로 SDK에 알림
        await tick();
        if (!destroyed) {
            renderAdfitAd(containerId);
        }
    });

    onDestroy(() => {
        destroyed = true;
        // ⛔ 반납을 빼먹으면 SPA 이동 후 그 유닛이 영영 안 나온다.
        if (claimedUnit) {
            claimed.delete(claimedUnit);
            claimedUnit = null;
        }
        destroyAdfitAd(containerId);
    });
</script>

{#if ready}
    <div class="flex justify-center">
        <ins
            class="kakao_ad_area"
            style="display:none;"
            data-ad-unit={unit.unitId}
            data-ad-width={String(unit.width)}
            data-ad-height={String(unit.height)}
        ></ins>
    </div>
{/if}
