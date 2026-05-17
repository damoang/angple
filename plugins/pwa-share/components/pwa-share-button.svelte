<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import Share2 from '@lucide/svelte/icons/share-2';
    import Link from '@lucide/svelte/icons/link';
    // svelte-sonner 는 plugin 경로에서 Rollup 이 resolve 못 함 → 단순 alert 로 대체.
    import { trackEvent } from '$lib/services/ga4.js';
    import {
        shareToFacebook,
        shareToX,
        shareToKakao,
        shareToNaverBand,
        shareToNaver,
        shareToPinterest,
        shareToTumblr,
        copyUrl
    } from '$lib/utils/share.js';

    let isStandalone = $state(false);
    let open = $state(false);

    onMount(() => {
        if (typeof window === 'undefined') return;
        const mq = window.matchMedia('(display-mode: standalone)');
        const navStandalone = (navigator as Navigator & { standalone?: boolean }).standalone;
        isStandalone = mq.matches || navStandalone === true;
        const onChange = (e: MediaQueryListEvent) => {
            isStandalone = e.matches || navStandalone === true;
        };
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    });

    function getShareUrl(): string {
        return typeof window !== 'undefined' ? window.location.href : $page.url.href;
    }

    function getShareTitle(): string {
        return typeof document !== 'undefined' ? document.title : '다모앙';
    }

    function handleShare() {
        open = !open;
    }

    function handleClickOutside(e: MouseEvent) {
        const target = e.target as HTMLElement;
        if (!target.closest('.pwa-share-dropdown')) {
            open = false;
        }
    }

    async function handleCopyUrl() {
        const success = await copyUrl(getShareUrl());
        if (success) {
            trackEvent('share', { method: 'copy_url', source: 'pwa-header' });
            alert('주소가 복사되었습니다.');
        } else {
            alert('주소 복사에 실패했습니다.');
        }
        open = false;
    }

    async function handleKakao() {
        trackEvent('share', { method: 'kakao', source: 'pwa-header' });
        const success = await shareToKakao(getShareTitle(), getShareUrl());
        if (!success) {
            alert('카카오톡 공유를 불러올 수 없습니다.');
        }
        open = false;
    }

    function handlePlatform(platform: string) {
        trackEvent('share', { method: platform, source: 'pwa-header' });
        const url = getShareUrl();
        const title = getShareTitle();
        switch (platform) {
            case 'facebook':
                shareToFacebook(url);
                break;
            case 'x':
                shareToX(title, url);
                break;
            case 'band':
                shareToNaverBand(title, url);
                break;
            case 'naver':
                shareToNaver(title, url);
                break;
            case 'pinterest':
                shareToPinterest(url, title);
                break;
            case 'tumblr':
                shareToTumblr(url);
                break;
        }
        open = false;
    }

    const platforms = [
        { id: 'copy', label: 'URL 복사', color: '' },
        { id: 'kakao', label: '카카오톡', color: 'bg-[#FEE500]' },
        { id: 'x', label: 'X (Twitter)', color: 'bg-black dark:bg-white' },
        { id: 'facebook', label: 'Facebook', color: 'bg-[#1877F2]' },
        { id: 'band', label: 'Band', color: 'bg-[#06CF5E]' },
        { id: 'naver', label: '네이버', color: 'bg-[#03C75A]' },
        { id: 'pinterest', label: 'Pinterest', color: 'bg-[#E60023]' },
        { id: 'tumblr', label: 'Tumblr', color: 'bg-[#35465C]' }
    ] as const;
</script>

<!-- Svelte 5: <svelte:window> 는 top-level 만 허용 (block 안 금지). isStandalone 가
     false 일 때는 dropdown 자체가 미렌더라 handleClickOutside 호출돼도 open=false 라 noop. -->
<svelte:window onclick={handleClickOutside} />

{#if isStandalone}
    <div class="pwa-share-dropdown relative">
        <button
            type="button"
            onclick={handleShare}
            class="hover:bg-accent relative rounded-lg p-2 transition-all duration-200 ease-out"
            aria-label="공유하기"
            aria-expanded={open}
        >
            <span class="pointer-events-none absolute -inset-1"></span>
            <Share2 class="text-muted-foreground h-5 w-5" />
        </button>

        {#if open}
            <div
                class="bg-popover absolute right-0 top-full z-50 mt-1 w-44 rounded-md border p-1 shadow-md"
            >
                {#each platforms as platform (platform.id)}
                    <button
                        class="hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm"
                        onclick={() => {
                            if (platform.id === 'copy') handleCopyUrl();
                            else if (platform.id === 'kakao') handleKakao();
                            else handlePlatform(platform.id);
                        }}
                    >
                        {#if platform.id === 'copy'}
                            <Link class="h-4 w-4 shrink-0" />
                        {:else}
                            <span class="inline-block h-4 w-4 shrink-0 rounded-sm {platform.color}"
                            ></span>
                        {/if}
                        <span>{platform.label}</span>
                    </button>
                {/each}
            </div>
        {/if}
    </div>
{/if}
