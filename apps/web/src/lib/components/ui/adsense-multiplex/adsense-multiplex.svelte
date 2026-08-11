<script lang="ts">
    /**
     * AdSense Multiplex (autorelaxed) 광고 컴포넌트
     * 댓글 인피드 등에서 사용하는 추천 콘텐츠형 광고
     */
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { page } from '$app/stores';

    /** 성인 키워드 글/차단 작가 글 상세 페이지에서는 AdSense Multiplex 광고를 숨김 */
    const suppressAds = $derived(
        !!($page as any).data?.post?.is_adult || !!($page as any).data?.post?.suppress_ads
    );

    interface Props {
        class?: string;
    }

    let { class: className = '' }: Props = $props();

    const ADSENSE_CLIENT = 'ca-pub-6922133409882969';
    const ADSENSE_SLOT = '3037103743';

    let ready = $state(false);
    let insEl: HTMLElement | null = null;
    let destroyed = false;

    onMount(() => {
        if (!browser) return;

        const existingScript = document.querySelector('script[src*="adsbygoogle.js"]');
        if (!existingScript) {
            const script = document.createElement('script');
            script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
            script.async = true;
            script.crossOrigin = 'anonymous';
            script.onload = () => {
                if (destroyed) return;
                ready = true;
                pushAd();
            };
            document.head.appendChild(script);
        } else {
            ready = true;
            pushAd();
        }
    });

    onDestroy(() => {
        destroyed = true;
    });

    function pushAd() {
        requestAnimationFrame(() => {
            if (destroyed) return;
            if (!insEl || !document.body.contains(insEl)) return;
            try {
                ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
            } catch {
                // AdSense push failed silently
            }
        });
    }
</script>

<div class="adsense-multiplex {className}" class:is-reserved={!suppressAds}>
    {#if ready && !suppressAds}
        <ins
            bind:this={insEl}
            class="adsbygoogle"
            style="display:block"
            data-ad-format="autorelaxed"
            data-ad-client={ADSENSE_CLIENT}
            data-ad-slot={ADSENSE_SLOT}
        ></ins>
    {/if}
</div>

<style>
    .adsense-multiplex {
        overflow: hidden;
    }

    /*
     * 높이 예약 — CLS 방지.
     *
     * 종전엔 스크립트 로드(`ready`) 전까지 래퍼 높이가 0 이었다가 autorelaxed
     * 크리에이티브가 들어오면서 수백 px 로 뛰어, 이 아래의 "최근 글" 목록 전체를
     * 밀어냈다(2026-08-11 감사: 글 상세 CLS 0.111 의 주요 기여분).
     *
     * 미충전 시 빈 공백이 남지 않도록 AdSense 가 부여하는
     * `data-ad-status="unfilled"` 를 만나면 예약을 해제한다.
     * 광고가 숨겨지는 글(성인/차단 작가)에는 애초에 예약하지 않는다.
     */
    .adsense-multiplex.is-reserved {
        min-height: 300px;
        contain: layout;
    }

    .adsense-multiplex.is-reserved:has(ins[data-ad-status='unfilled']) {
        min-height: 0;
    }
</style>
