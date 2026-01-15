<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';

    interface Props {
        position?: string;
        class?: string;
    }

    let { position = 'side-image-text-banner', class: className = '' }: Props = $props();

    const API_BASE = import.meta.env.VITE_ADS_API_URL || 'https://ads.damoang.net';

    interface BannerItem {
        id: string;
        imageUrl: string;
        landingUrl: string;
        altText: string;
        target: string;
        trackingId?: string;
    }

    let banners = $state<BannerItem[]>([]);
    let loading = $state(true);

    // 샘플 데이터 (API 연동 전 테스트용)
    const sampleBanners: BannerItem[] = [
        {
            id: '1',
            imageUrl: 'https://via.placeholder.com/280x80/e3f2fd/1976d2?text=AD+1',
            landingUrl: '#',
            altText: '광고 배너 1',
            target: '_blank'
        },
        {
            id: '2',
            imageUrl: 'https://via.placeholder.com/280x80/e8f5e9/388e3c?text=AD+2',
            landingUrl: '#',
            altText: '광고 배너 2',
            target: '_blank'
        },
        {
            id: '3',
            imageUrl: 'https://via.placeholder.com/280x80/fff3e0/f57c00?text=AD+3',
            landingUrl: '#',
            altText: '광고 배너 3',
            target: '_blank'
        },
        {
            id: '4',
            imageUrl: 'https://via.placeholder.com/280x80/fce4ec/c2185b?text=AD+4',
            landingUrl: '#',
            altText: '광고 배너 4',
            target: '_blank'
        }
    ];

    onMount(() => {
        fetchBanners();
    });

    async function fetchBanners() {
        if (!browser) return;

        try {
            const response = await fetch(
                `${API_BASE}/api/v1/serve/banners?position=${encodeURIComponent(position)}&limit=4`
            );
            const result = await response.json();

            if (result.success && result.data?.banners?.length > 0) {
                banners = result.data.banners.slice(0, 4);
            } else {
                // API에서 배너가 없으면 샘플 데이터 사용
                banners = sampleBanners;
            }
        } catch (error) {
            console.warn('Image-text banner fetch error:', error);
            // 에러 시 샘플 데이터 사용
            banners = sampleBanners;
        } finally {
            loading = false;
        }
    }

    function handleClick(banner: BannerItem) {
        if (banner.trackingId) {
            navigator.sendBeacon?.(
                `${API_BASE}/api/v1/track/click?tid=${banner.trackingId}&t=${Date.now()}`
            );
        }
    }
</script>

<div class="image-text-banner {className}" data-position={position}>
    {#if loading}
        <div class="grid grid-cols-2 gap-2">
            {#each [1, 2, 3, 4] as idx (idx)}
                <div
                    class="animate-pulse rounded-lg border-2 border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
                >
                    <div class="h-[80px] bg-slate-200 dark:bg-slate-700"></div>
                    <div class="p-2">
                        <div class="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-600"></div>
                    </div>
                </div>
            {/each}
        </div>
    {:else if banners.length > 0}
        <div class="grid grid-cols-2 gap-2">
            {#each banners.slice(0, 4) as banner (banner.id)}
                <article
                    class="overflow-hidden rounded-lg border-2 border-blue-100 bg-white transition-transform hover:-translate-y-0.5 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500"
                >
                    <a
                        href={banner.landingUrl}
                        target={banner.target || '_blank'}
                        rel="nofollow noopener"
                        onclick={() => handleClick(banner)}
                        class="block"
                    >
                        {#if banner.imageUrl}
                            <figure class="m-0">
                                <img
                                    src={banner.imageUrl}
                                    alt={banner.altText || '광고'}
                                    class="h-[80px] w-full object-cover"
                                    loading="lazy"
                                />
                                <figcaption
                                    class="truncate bg-white px-2 py-1.5 text-center text-xs text-blue-600 dark:bg-slate-800 dark:text-blue-400"
                                >
                                    {banner.altText || '광고'}
                                </figcaption>
                            </figure>
                        {:else}
                            <div
                                class="flex h-[80px] items-center justify-center bg-slate-50 p-2 dark:bg-slate-700"
                            >
                                <span class="text-center text-xs text-blue-600 dark:text-blue-400">
                                    {banner.altText || '광고'}
                                </span>
                            </div>
                        {/if}
                    </a>
                </article>
            {/each}
        </div>
    {:else}
        <!-- 빈 상태 -->
        <div
            class="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-center dark:border-slate-600 dark:bg-slate-800"
        >
            <span class="text-xs text-slate-400">광고 영역</span>
        </div>
    {/if}
</div>
