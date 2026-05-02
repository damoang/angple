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

    onMount(async () => {
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
