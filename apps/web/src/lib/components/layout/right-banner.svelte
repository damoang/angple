<script lang="ts">
    import { onMount } from 'svelte';
    import ImageBanner from '$lib/components/ui/image-banner/image-banner.svelte';

    // AdSense 설정 (ang-gnu 동일)
    const ADSENSE_VERTICAL_SLOT = '1774011047'; // DA_Vertical_Banner_02 (160×600)

    // TOP 버튼 표시 여부
    let showTopButton = $state(false);

    function handleScroll() {
        showTopButton = window.scrollY > 300;
    }

    function scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    onMount(() => {
        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    });
</script>

<!-- 오른쪽 윙 배너 -->
<div class="flex w-[160px] flex-col items-center justify-center gap-2">
    <ImageBanner
        position="wing-right"
        width="160px"
        height="600px"
        fallbackToAdsense={true}
        adsenseSlot={ADSENSE_VERTICAL_SLOT}
        adsenseFormat="vertical"
    />
</div>

<!-- TOP 버튼 - 오른쪽 하단 -->
{#if showTopButton}
    <div class="fixed right-6 z-40" style="bottom: 24px;">
        <button
            onclick={scrollToTop}
            class="group flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all duration-300 hover:bg-blue-700"
            aria-label="페이지 상단으로 이동"
        >
            <svg
                class="h-5 w-5 transform transition-transform group-hover:-translate-y-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                />
            </svg>
        </button>
    </div>
{/if}
