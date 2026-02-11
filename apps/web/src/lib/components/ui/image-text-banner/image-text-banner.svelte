<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';

    interface Props {
        position?: string;
        class?: string;
    }

    let { position = 'list-inline', class: className = '' }: Props = $props();

    // 직접홍보 게시글 타입
    interface PromotionPost {
        wrId: number;
        subject: string;
        imageUrl: string;
        linkUrl: string;
        advertiserName: string;
        memberId: string;
        pinToTop: boolean;
        createdAt: string;
    }

    interface BannerItem {
        id: string;
        imageUrl: string;
        linkUrl: string;
        altText: string;
        target: string;
    }

    let banners = $state<BannerItem[]>([]);
    let loading = $state(true);

    // 샘플 데이터 (API 실패 시 폴백)
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
            const response = await fetch('/api/ads/promotion-posts');
            const result = await response.json();

            const posts: PromotionPost[] = result.data?.posts || [];

            // 이미지 있는 게시글만 필터링, 최대 4개
            const withImage = posts.filter((p) => p.imageUrl).slice(0, 4);

            if (withImage.length > 0) {
                banners = withImage.map((p) => ({
                    id: String(p.wrId),
                    imageUrl: p.imageUrl,
                    linkUrl: p.linkUrl,
                    altText: p.subject,
                    target: '_blank'
                }));
            } else {
                banners = sampleBanners;
            }
        } catch (error) {
            console.warn('Image-text banner fetch error:', error);
            banners = sampleBanners;
        } finally {
            loading = false;
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
