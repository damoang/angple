<script lang="ts">
    /**
     * Muzia 광고 슬롯 — 카카오 애드핏 + 구글 애드센스
     * - 초기 로드 시 min-height로 공간 확보 (CLS/깜빡임 방지)
     * - 30초마다 광고 리프레시
     */
    import { browser } from '$app/environment';
    import { onMount } from 'svelte';

    interface Props {
        position: 'leaderboard' | 'content' | 'sidebar' | 'left-wing' | 'right-wing' | 'mobile-bottom';
        strategy?: 'kakao-only' | 'adsense-only' | 'fallback' | 'rotate' | 'auto';
        ratio?: number;
        class?: string;
    }

    const { position, strategy = 'auto', ratio = 50, class: className = '' }: Props = $props();

    const ADSENSE_CLIENT = 'ca-pub-2456249131797827';
    const ADSENSE_APPROVAL_DATE = '2026-04-12';
    const REFRESH_INTERVAL = 30000; // 30초

    const AD_CONFIG: Record<string, {
        kakao: { unit: string; width: number; height: number };
        adsense: { slot: string; format: string };
    }> = {
        leaderboard: {
            kakao: { unit: 'DAN-1ji7auwb2addc', width: 728, height: 90 },
            adsense: { slot: '7466402991', format: 'horizontal' },
        },
        content: {
            kakao: { unit: 'DAN-1h82kvvvd6alv', width: 300, height: 250 },
            adsense: { slot: '7466402991', format: 'rectangle' },
        },
        sidebar: {
            kakao: { unit: 'DAN-P6m7sqPyMNOFUWQd', width: 250, height: 250 },
            adsense: { slot: '7466402991', format: 'rectangle' },
        },
        'left-wing': {
            kakao: { unit: 'DAN-trtmw7twmjhv', width: 160, height: 600 },
            adsense: { slot: '7466402991', format: 'vertical' },
        },
        'right-wing': {
            kakao: { unit: 'DAN-tofp4ts9th0k', width: 160, height: 600 },
            adsense: { slot: '7466402991', format: 'vertical' },
        },
        'mobile-bottom': {
            kakao: { unit: 'DAN-r3uIPALR2P7oBL1f', width: 320, height: 50 },
            adsense: { slot: '7466402991', format: 'horizontal' },
        },
    };

    let hidden = $state(false);
    let adContainer: HTMLDivElement;

    // 모듈 레벨 스크립트 로딩
    let kakaoLoaded = false;
    let kakaoLoading: Promise<void> | null = null;
    let adsenseLoaded = false;
    let adsenseLoading: Promise<void> | null = null;

    function loadKakaoScript(): Promise<void> {
        if (kakaoLoaded) return Promise.resolve();
        if (kakaoLoading) return kakaoLoading;
        kakaoLoading = new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = '//t1.daumcdn.net/kas/static/ba.min.js';
            s.async = true;
            s.onload = () => { kakaoLoaded = true; resolve(); };
            s.onerror = () => resolve();
            document.head.appendChild(s);
        });
        return kakaoLoading;
    }

    function loadAdsenseScript(): Promise<void> {
        if (adsenseLoaded) return Promise.resolve();
        if (adsenseLoading) return adsenseLoading;
        adsenseLoading = new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
            s.async = true;
            s.crossOrigin = 'anonymous';
            s.onload = () => { adsenseLoaded = true; resolve(); };
            s.onerror = () => resolve();
            document.head.appendChild(s);
        });
        return adsenseLoading;
    }

    function resolveStrategy(): 'kakao-only' | 'adsense-only' | 'fallback' | 'rotate' {
        if (strategy !== 'auto') return strategy as any;
        return new Date() < new Date(ADSENSE_APPROVAL_DATE) ? 'kakao-only' : 'fallback';
    }

    function pickFirstNetwork(resolved: string): 'kakao' | 'adsense' {
        if (resolved === 'kakao-only') return 'kakao';
        if (resolved === 'adsense-only') return 'adsense';
        if (resolved === 'rotate') return Math.random() * 100 < ratio ? 'adsense' : 'kakao';
        return 'adsense';
    }

    async function renderKakao(): Promise<boolean> {
        const config = AD_CONFIG[position].kakao;
        await loadKakaoScript();
        if (!adContainer) return false;

        // 기존 ins 제거 후 새로 생성
        adContainer.innerHTML = '';
        const ins = document.createElement('ins');
        ins.className = 'kakao_ad_area';
        ins.style.display = 'none';
        ins.setAttribute('data-ad-unit', config.unit);
        ins.setAttribute('data-ad-width', String(config.width));
        ins.setAttribute('data-ad-height', String(config.height));
        adContainer.appendChild(ins);

        try { (window as any).kakaoAdfit?.init?.(); } catch {}

        return new Promise((resolve) => {
            setTimeout(() => resolve(ins.offsetHeight > 0), 3000);
        });
    }

    async function renderAdsense(): Promise<boolean> {
        const config = AD_CONFIG[position].adsense;
        await loadAdsenseScript();
        if (!adContainer) return false;

        adContainer.innerHTML = '';
        const ins = document.createElement('ins');
        ins.className = 'adsbygoogle';
        ins.style.display = 'block';
        ins.setAttribute('data-ad-client', ADSENSE_CLIENT);
        ins.setAttribute('data-ad-slot', config.slot);
        ins.setAttribute('data-ad-format', 'auto');
        ins.setAttribute('data-full-width-responsive', 'true');
        adContainer.appendChild(ins);

        try { ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({}); } catch {}

        return new Promise((resolve) => {
            setTimeout(() => {
                const status = ins.getAttribute('data-ad-status');
                resolve(status !== 'unfilled' && ins.offsetHeight > 0);
            }, 3000);
        });
    }

    async function loadAd() {
        if (!browser || !adContainer) return;

        const resolved = resolveStrategy();
        const first = pickFirstNetwork(resolved);

        const renderFn = first === 'kakao' ? renderKakao : renderAdsense;
        const filled = await renderFn();
        if (filled) return;

        // 폴백
        if (resolved === 'kakao-only' || resolved === 'adsense-only') {
            hidden = true;
            return;
        }

        const fallbackFn = first === 'kakao' ? renderAdsense : renderKakao;
        const fallbackFilled = await fallbackFn();
        if (!fallbackFilled) hidden = true;
    }

    onMount(() => {
        if (!browser) return;

        // 최초 로드
        loadAd();

        // 30초마다 리프레시 (광고 교체)
        const interval = setInterval(() => {
            if (adContainer && !hidden) loadAd();
        }, REFRESH_INTERVAL);

        return () => clearInterval(interval);
    });

    const config = AD_CONFIG[position];
</script>

{#if !hidden}
    <div class="muzia-ad-slot flex items-center justify-center overflow-hidden {className}"
         class:my-4={!['sidebar', 'left-wing', 'right-wing', 'mobile-bottom'].includes(position)}
         class:mt-4={position === 'sidebar'}
         style="min-height:{config.kakao.height}px;max-width:100%"
         bind:this={adContainer}>
    </div>
{/if}
