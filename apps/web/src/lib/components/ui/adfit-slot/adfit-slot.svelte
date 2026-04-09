<script lang="ts">
    /**
     * 카카오 애드핏 광고 슬롯
     * GAM이 빈 슬롯일 때 폴백으로 사용
     */
    import { onMount, onDestroy, tick } from 'svelte';
    import { loadAdfitSDK, renderAdfitAd, destroyAdfitAd } from '$lib/utils/adfit-loader.js';
    import type { AdfitUnit } from '$lib/config/ad-config.js';

    interface Props {
        unit: AdfitUnit;
        id: string;
    }

    let { unit, id }: Props = $props();

    let ready = $state(false);
    let destroyed = false;
    const containerId = `adfit-${id}`;

    onMount(async () => {
        await loadAdfitSDK();
        if (destroyed) return;
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
