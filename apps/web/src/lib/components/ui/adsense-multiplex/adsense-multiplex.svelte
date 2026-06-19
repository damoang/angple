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

<div class="adsense-multiplex {className}">
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
</style>
