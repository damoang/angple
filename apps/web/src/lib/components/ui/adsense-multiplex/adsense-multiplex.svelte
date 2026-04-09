<script lang="ts">
    /**
     * AdSense Multiplex (autorelaxed) 광고 컴포넌트
     * 댓글 인피드 등에서 사용하는 추천 콘텐츠형 광고
     */
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';

    interface Props {
        class?: string;
    }

    let { class: className = '' }: Props = $props();

    const ADSENSE_CLIENT = 'ca-pub-5124617752473025';
    const ADSENSE_SLOT = '3075504524';

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
    {#if ready}
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
