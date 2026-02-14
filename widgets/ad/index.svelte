<script lang="ts">
    /**
     * 통합 광고 슬롯 위젯
     *
     * 메인 영역과 사이드바 모두 지원합니다.
     * slot과 settings에 따라 적절한 광고 형태를 렌더링합니다.
     */
    import { onMount } from 'svelte';
    import type { WidgetProps } from '$lib/types/widget-props';
    import { AdSlot } from '$lib/components/ui/ad-slot';
    import { DamoangBanner } from '$lib/components/ui/damoang-banner/index';
    import ImageTextBanner from '$lib/components/ui/image-text-banner/image-text-banner.svelte';

    let { config, slot, isEditMode = false }: WidgetProps = $props();

    const position = $derived((config.settings?.position as string) ?? 'index-custom');
    const height = $derived((config.settings?.height as string) ?? '90px');
    const adType = $derived((config.settings?.type as string) ?? 'image');

    const isSidebar = $derived(slot === 'sidebar');

    // 자체 광고를 사용하는 슬롯:
    // - index-head: 메인 페이지 추천글 위 (ads position: index-top)
    // - board-head: 게시판/글 최상단 (ads position: board-head)
    // 나머지 슬롯은 전부 GAM
    const SELF_AD_POSITIONS = ['index-head', 'board-head'];
    const useDamoangBanner = $derived(!isSidebar && SELF_AD_POSITIONS.includes(position));

    // 위젯 position → DamoangBanner position 매핑
    const WIDGET_TO_BANNER: Record<string, 'index' | 'board-list' | 'board-view'> = {
        'index-head': 'index',
        'board-head': 'board-list'
    };
    const bannerPosition = $derived(WIDGET_TO_BANNER[position] || 'board-list');

    // 사이드바 이미지 배너 상태
    interface SidebarBanner {
        imageUrl: string;
        landingUrl: string;
        altText: string;
        target: string;
    }
    let sidebarBanner = $state<SidebarBanner | null>(null);
    let sidebarLoading = $state(true);

    onMount(async () => {
        if (!isSidebar || adType !== 'image') {
            sidebarLoading = false;
            return;
        }
        try {
            const res = await fetch('/api/ads/banners?position=sidebar&limit=1');
            const result = await res.json();
            if (result.success && result.data?.banners?.length > 0) {
                const b = result.data.banners[0];
                sidebarBanner = {
                    imageUrl: b.imageUrl,
                    landingUrl: b.landingUrl,
                    altText: b.altText || '',
                    target: b.target || '_blank'
                };
            }
        } catch {
            /* 배너 로드 실패 시 GAM으로 폴백 */
        }
        sidebarLoading = false;
    });
</script>

{#if isSidebar}
    <!-- 사이드바 광고 -->
    <div>
        <div class="mb-2 flex items-center justify-between">
            <span class="text-xs font-medium text-slate-500">AD</span>
        </div>
        {#if adType === 'image'}
            {#if sidebarLoading}
                <div
                    class="animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
                    style="width: 280px; height: 140px;"
                ></div>
            {:else if sidebarBanner}
                <a
                    href={sidebarBanner.landingUrl}
                    target={sidebarBanner.target}
                    rel="nofollow noopener"
                    class="border-border block overflow-hidden rounded-xl border transition-opacity hover:opacity-90"
                    style="width: 280px; height: 140px;"
                >
                    <img
                        src={sidebarBanner.imageUrl}
                        alt={sidebarBanner.altText || '광고'}
                        style="width: 100%; height: 100%; object-fit: cover;"
                        loading="eager"
                    />
                </a>
            {:else}
                <AdSlot position="sidebar" height="250px" />
            {/if}
        {:else if adType === 'image-text'}
            <ImageTextBanner position="side-image-text-banner" />
        {:else}
            <AdSlot {position} height="250px" />
        {/if}
    </div>
{:else if useDamoangBanner}
    <!-- 메인 영역: 자체 광고 우선, GAM 폴백 -->
    <DamoangBanner
        position={bannerPosition}
        showCelebration={false}
        {height}
        gamPosition={position}
    />
{:else}
    <!-- 메인 영역 광고 (GAM) -->
    <AdSlot {position} {height} />
{/if}
