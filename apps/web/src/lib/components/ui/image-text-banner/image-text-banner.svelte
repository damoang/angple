<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';

    interface Props {
        position?: string;
        class?: string;
    }

    let { position = 'list-inline', class: className = '' }: Props = $props();

    // damoang-ads 배너 응답 타입
    interface ServedBanner {
        id: string;
        imageUrl: string;
        landingUrl: string;
        altText: string;
        target: string;
        trackingId: string;
    }

    interface BannerItem {
        id: string;
        imageUrl: string;
        linkUrl: string;
        altText: string;
        target: string;
        trackingId?: string;
    }

    let banners = $state<BannerItem[]>([]);
    let loading = $state(true);

    // 샘플 데이터 (API 실패 시 폴백 - side-image-text-banner 제외)
    const sampleBanners: BannerItem[] = [
        {
            id: '1',
            imageUrl: 'https://via.placeholder.com/280x80/e3f2fd/1976d2?text=AD+1',
            linkUrl: '#',
            altText: '광고 배너 1',
            target: '_blank'
        },
        {
            id: '2',
            imageUrl: 'https://via.placeholder.com/280x80/e8f5e9/388e3c?text=AD+2',
            linkUrl: '#',
            altText: '광고 배너 2',
            target: '_blank'
        },
        {
            id: '3',
            imageUrl: 'https://via.placeholder.com/280x80/fff3e0/f57c00?text=AD+3',
            linkUrl: '#',
            altText: '광고 배너 3',
            target: '_blank'
        },
        {
            id: '4',
            imageUrl: 'https://via.placeholder.com/280x80/fce4ec/c2185b?text=AD+4',
            linkUrl: '#',
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
            // damoang-ads API 호출 - 항상 4개 요청
            const response = await fetch(`/api/ads/banners?position=${position}&limit=4`);
            const result = await response.json();

            if (result.success && result.data?.banners?.length > 0) {
                banners = result.data.banners.map((b: ServedBanner) => ({
                    id: b.id,
                    imageUrl: b.imageUrl,
                    linkUrl: b.landingUrl,
                    altText: b.altText || '',
                    target: b.target || '_blank',
                    trackingId: b.trackingId
                }));
            } else {
                // side-image-text-banner는 빈 상태 유지, 다른 위치는 샘플 표시
                banners = position === 'side-image-text-banner' ? [] : sampleBanners;
            }
        } catch (error) {
            console.warn('Image-text banner fetch error:', error);
            // side-image-text-banner는 빈 상태 유지, 다른 위치는 샘플 표시
            banners = position === 'side-image-text-banner' ? [] : sampleBanners;
        } finally {
            loading = false;
        }
    }

    // 4칸 슬롯 배열 생성 (side-image-text-banner용)
    const slots = $derived(() => {
        if (position !== 'side-image-text-banner') return null;
        const result: (BannerItem | null)[] = [null, null, null, null];
        banners.slice(0, 4).forEach((b, i) => {
            result[i] = b;
        });
        return result;
    });
</script>

<div class="image-text-banner {className}" data-position={position}>
    {#if loading}
        <!-- 로딩 스켈레톤: 항상 4개 그리드 -->
        <div class="grid grid-cols-2 gap-2">
            {#each [1, 2, 3, 4] as idx (idx)}
                <div
                    class="animate-pulse rounded-lg border-2 border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800"
                >
                    <div
                        class="{position === 'side-image-text-banner' ? 'h-[60px]' : 'h-[80px]'} bg-slate-200 dark:bg-slate-700"
                    ></div>
                    <div class="p-1.5">
                        <div class="mx-auto h-2.5 w-2/3 rounded bg-slate-200 dark:bg-slate-600"></div>
                    </div>
                </div>
            {/each}
        </div>
    {:else if position === 'side-image-text-banner'}
        <!-- 사이드바: 항상 4칸 그리드 (공실 포함) -->
        <div class="grid grid-cols-2 gap-2">
            {#each slots() || [null, null, null, null] as slot, idx (idx)}
                {#if slot}
                    <!-- 배너가 있는 슬롯 -->
                    <article
                        class="overflow-hidden rounded-lg border-2 border-blue-100 bg-white transition-transform hover:-translate-y-0.5 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500"
                    >
                        <a
                            href={slot.linkUrl}
                            target={slot.target || '_blank'}
                            rel="nofollow noopener"
                            class="block"
                        >
                            {#if slot.imageUrl}
                                <figure class="m-0">
                                    <img
                                        src={slot.imageUrl}
                                        alt={slot.altText || '광고'}
                                        class="h-[60px] w-full object-cover"
                                        loading="lazy"
                                    />
                                    <figcaption
                                        class="truncate bg-white px-2 py-1 text-center text-[10px] text-blue-600 dark:bg-slate-800 dark:text-blue-400"
                                    >
                                        {slot.altText || '광고'}
                                    </figcaption>
                                </figure>
                            {:else}
                                <div
                                    class="flex h-[60px] items-center justify-center bg-slate-50 p-2 dark:bg-slate-700"
                                >
                                    <span
                                        class="text-center text-[10px] text-blue-600 dark:text-blue-400"
                                    >
                                        {slot.altText || '광고'}
                                    </span>
                                </div>
                            {/if}
                        </a>
                    </article>
                {:else}
                    <!-- 공실 슬롯 -->
                    <a
                        href="mailto:ads@damoang.net"
                        class="flex h-[78px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 transition-colors hover:border-blue-400 hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:border-blue-500 dark:hover:bg-slate-700"
                    >
                        <span class="text-[10px] font-medium text-slate-400 dark:text-slate-500"
                            >광고 문의</span
                        >
                    </a>
                {/if}
            {/each}
        </div>
    {:else if banners.length > 0}
        <!-- 기본: 4개 그리드 -->
        <div class="grid grid-cols-2 gap-2">
            {#each banners.slice(0, 4) as banner (banner.id)}
                <article
                    class="overflow-hidden rounded-lg border-2 border-blue-100 bg-white transition-transform hover:-translate-y-0.5 hover:border-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-blue-500"
                >
                    <a
                        href={banner.linkUrl}
                        target={banner.target || '_blank'}
                        rel="nofollow noopener"
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
