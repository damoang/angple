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

<!--
  ⛔ 이 래퍼는 **마운트 후에만** 나간다. SSR 로 내보내면 차단기가 하이드레이션 **전에**
     지워서 Svelte 5 가 트리 전체를 버린다 — 페이지가 통째로 CSR 재마운트되고 글쓰기 버튼
     먹통·깜빡임·로그인 오표시가 난다(2026-08-25 실측: 같은 기전으로 글 상세 실패율
     18.23% → 광고 칸을 SSR 에서 빼서 0.10%, PR #2218).

  ⛔ **안쪽만 감싸면 안 된다.** 종전엔 이 div 가 SSR 에 **자식 없는 빈 껍데기**로 나갔고
     (`<div class="adsense-multiplex … "></div>`, min-height 300px), 그게 정확히 #2189 가
     저지른 실수의 모양이다 — `<ins>` 만 빼고 껍데기를 남겨 효과가 **0** 이었다.

  ⛔ **이름 바꾸기로는 안 된다.** 사이트 지정 규칙은 이름을 안 본다(`dm-` 접두로 이미
     실패했다). 8/25 실제로 지워진 것도 난독화된 `dm-clip-wrapper` 였다.
     방향은 「차단을 뚫는다」가 아니라 **「지워져도 멀쩡하다」** 이다.

  ⛔ 자리예약은 이 div 가 SSR 에 없으므로 **부모가 진다** —
     `[postId]/+page.svelte` 의 `.dm-mplex-reserve`. 여기로 되돌리지 마라.
-->
{#if ready && !suppressAds}
    <div class="dm-mplex-frame {className}">
        <ins
            bind:this={insEl}
            class="adsbygoogle"
            style="display:block"
            data-ad-format="autorelaxed"
            data-ad-client={ADSENSE_CLIENT}
            data-ad-slot={ADSENSE_SLOT}
        ></ins>
    </div>
{/if}

<style>
    .dm-mplex-frame {
        overflow: hidden;
    }
</style>
