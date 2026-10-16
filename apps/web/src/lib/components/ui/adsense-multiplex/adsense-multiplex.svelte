<script lang="ts">
    /**
     * AdSense 글 상세 하단 광고 — 포맷 A/B 실험
     *
     * 배경(2026-10-16 조사):
     *   pub-6922 는 2026-08-08 부터 노출이 0 이다. 페이지뷰는 하루 25~35만으로 그대로인데
     *   노출만 끊겼다. 정책 위반·사이트 미승인·CSP·컨테이너 높이·JS 오류는 전부 배제했고,
     *   `/pagead/ads` 응답 바이트를 재 보면 요청은 정상인데 **응답이 비어 온다**.
     *     pub-2456 259x600  → 51,365 bytes (광고 있음)
     *     pub-6922 810x486  →    507 bytes (빈 응답)
     *   즉 구글이 이 퍼블리셔의 이 슬롯에 채울 광고를 주지 않는다.
     *
     *   후보가 두 개 남았다. ① ads.txt 누락(2026-10-16 10:51 수정됨, 재크롤 1일+ 소요)
     *   ② 멀티플렉스(autorelaxed) 포맷 자체의 낮은 fill.
     *   ②를 가르기 위해 **같은 자리에서 포맷만 바꿔** 응답을 비교한다.
     *
     * 실험 설계:
     *   한 번의 페이지 뷰마다 A(멀티플렉스) 또는 B(반응형 디스플레이)를 50:50 으로 고른다.
     *   슬롯 ID 가 다르므로 애드센스 보고서('광고 단위 기준')에서 자동으로 분리 집계된다.
     *   **광고 개수는 늘리지 않는다** — 둘 중 하나만 뜬다.
     *
     * 판정:
     *   B 만 채워지면 → 멀티플렉스 포맷 문제. 디스플레이로 교체한다.
     *   둘 다 안 채워지면 → 포맷 문제가 아니다. 계정/수요 쪽을 본다.
     *   둘 다 채워지면 → ads.txt 가 원인이었다(실험 기간 중 재크롤이 반영된 것). RPM 으로 승자를 고른다.
     *
     * 수동 확인: `?adab=multiplex` / `?adab=display` 로 변이를 고정할 수 있다.
     */
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { page } from '$app/stores';

    /** 성인 키워드 글/차단 작가 글 상세 페이지에서는 광고를 숨김 */
    const suppressAds = $derived(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 페이지마다 data 모양이 달라 공통 타입이 없다(post·user 가 있을 때만 읽는다)
        !!($page as any).data?.post?.is_adult || !!($page as any).data?.post?.suppress_ads
    );

    interface Props {
        class?: string;
    }

    let { class: className = '' }: Props = $props();

    const ADSENSE_CLIENT = 'ca-pub-6922133409882969';

    /** A: 기존 멀티플렉스(추천 콘텐츠형). 2026-06-18 생성 */
    const SLOT_MULTIPLEX = '3037103743';
    /** B: 반응형 디스플레이. 계정에 이미 있던 휴면 단위('수직형-반응형', 2024-07-26) 라 귀속이 깨끗하다 */
    const SLOT_DISPLAY = '3869864457';

    type Variant = 'multiplex' | 'display';

    let ready = $state(false);
    let variant = $state<Variant>('multiplex');
    let insEl: HTMLElement | null = null;
    let destroyed = false;

    function pickVariant(): Variant {
        const forced = $page.url.searchParams.get('adab');
        if (forced === 'multiplex' || forced === 'display') return forced;
        return Math.random() < 0.5 ? 'multiplex' : 'display';
    }

    onMount(() => {
        if (!browser) return;

        variant = pickVariant();

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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 외부 스크립트가 window 에 붙이는 전역이라 타입 선언이 없다
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
     그 규칙의 미충전 해제 셀렉터는 `ins[data-ad-status='unfilled']` 를 보므로
     A/B 두 변이 모두에 그대로 적용된다(둘 다 `ins.adsbygoogle` 이다).
-->
{#if ready && !suppressAds}
    <div class="dm-mplex-frame {className}" data-ad-variant={variant}>
        {#if variant === 'multiplex'}
            <ins
                bind:this={insEl}
                class="adsbygoogle"
                style="display:block"
                data-ad-format="autorelaxed"
                data-ad-client={ADSENSE_CLIENT}
                data-ad-slot={SLOT_MULTIPLEX}
            ></ins>
        {:else}
            <ins
                bind:this={insEl}
                class="adsbygoogle"
                style="display:block"
                data-ad-client={ADSENSE_CLIENT}
                data-ad-slot={SLOT_DISPLAY}
                data-ad-format="auto"
                data-full-width-responsive="true"
            ></ins>
        {/if}
    </div>
{/if}

<style>
    .dm-mplex-frame {
        overflow: hidden;
    }
</style>
