<script lang="ts">
    /**
     * 앙지도 상세 단일 핀 미니맵.
     *
     * 좌표가 있는 글에만 렌더된다(부모에서 가드 — 좌표 없으면 이 컴포넌트를 아예 mount
     * 하지 않아 빈 지도 박스가 안 뜬다). 단일 핀 + 줌 16, 클릭 시 원본 지도 링크로.
     *
     * SSR 안전이 핵심 함정: Leaflet 은 브라우저 전용(window 참조)이라 정적 import 금지.
     * 뷰포트 진입 시(IntersectionObserver)에만 동적 import 하고, 지도 컨테이너도
     * {#if} 로 클라이언트에서만 mount 한다. (angmap-pin-map.svelte 패턴과 동일.)
     *
     * ⛔ 글로벌 원칙: 좌표 범위·초기 뷰 어디에도 국가를 가정하지 않는다 — 좌표만 본다.
     */
    import { onMount, onDestroy, tick } from 'svelte';
    import { browser } from '$app/environment';
    import MapPin from '@lucide/svelte/icons/map-pin';
    import ExternalLink from '@lucide/svelte/icons/external-link';
    import type { Map as LeafletMap } from 'leaflet';
    import { ANGMAP_TILE_PROVIDER, ANGMAP_TILE_PROVIDERS } from './angmap-map-provider.js';

    let {
        lat,
        lng,
        name = null,
        mapUrl = null
    }: {
        lat: number;
        lng: number;
        name?: string | null;
        /** 클릭 시 이동할 원본 지도 링크(글의 지도 URL). 없으면 지도 클릭 비활성. */
        mapUrl?: string | null;
    } = $props();

    /** 상세 진입 시 뷰포트에 들어올 때까지 로드 지연할 줌 레벨(단일 핀이라 근접). */
    const DETAIL_ZOOM = 16;

    let mapContainer = $state<HTMLDivElement | null>(null);
    let sentinel = $state<HTMLDivElement | null>(null);
    let mounted = $state(false);
    let loading = $state(false);
    let failed = $state(false);

    let map: LeafletMap | null = null;
    let leafletPromise: Promise<typeof import('leaflet')> | null = null;
    let observer: IntersectionObserver | null = null;

    function loadLeaflet(): Promise<typeof import('leaflet')> {
        if (!leafletPromise) {
            leafletPromise = Promise.all([
                import('leaflet'),
                // Leaflet CSS 도 뷰포트 진입 시에만 로드 (vite 가 청크로 처리)
                import('leaflet/dist/leaflet.css')
            ]).then(([mod]) => mod);
        }
        return leafletPromise;
    }

    function initMap(leaflet: typeof import('leaflet')): void {
        if (map || !mapContainer) return;
        const L = leaflet;
        const tile = ANGMAP_TILE_PROVIDERS[ANGMAP_TILE_PROVIDER];

        map = L.map(mapContainer, {
            center: [lat, lng],
            zoom: DETAIL_ZOOM,
            scrollWheelZoom: false,
            // 단일 핀 미니맵 — 부가 컨트롤 최소화
            zoomControl: true,
            attributionControl: true
        });
        L.tileLayer(tile.urlTemplate, {
            attribution: tile.attribution,
            maxZoom: tile.maxZoom
        }).addTo(map);

        const marker = L.circleMarker([lat, lng], {
            radius: 9,
            weight: 2,
            color: '#be123c',
            fillColor: '#f43f5e',
            fillOpacity: 0.8
        }).addTo(map);
        if (name) marker.bindTooltip(name, { permanent: false, direction: 'top' });
    }

    async function activate(): Promise<void> {
        if (!browser || mounted) return;
        mounted = true;
        loading = true;
        failed = false;
        try {
            const leaflet = await loadLeaflet();
            await tick(); // {#if mounted} 컨테이너 mount 대기
            if (!mapContainer) return;
            initMap(leaflet);
        } catch (err) {
            console.error('[angmap place map] init failed:', err);
            failed = true;
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        if (!browser || !sentinel) return;
        // 뷰포트 진입 시에만 Leaflet 로드 (상세 진입 즉시 로드하지 않음)
        if (typeof IntersectionObserver === 'undefined') {
            void activate();
            return;
        }
        observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        void activate();
                        observer?.disconnect();
                        observer = null;
                        break;
                    }
                }
            },
            { rootMargin: '200px' }
        );
        observer.observe(sentinel);
    });

    onDestroy(() => {
        observer?.disconnect();
        observer = null;
        map?.remove();
        map = null;
    });
</script>

<div class="mb-4" bind:this={sentinel}>
    <div class="mb-1.5 flex items-center justify-between gap-2">
        <span class="text-foreground flex items-center gap-1.5 text-sm font-semibold">
            <MapPin class="text-primary h-4 w-4" />
            {name || '위치'}
        </span>
        {#if mapUrl}
            <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
            >
                원본 지도
                <ExternalLink class="h-3 w-3" />
            </a>
        {/if}
    </div>

    {#if failed}
        <div
            class="border-border text-muted-foreground flex h-40 items-center justify-center rounded-lg border text-sm"
        >
            지도를 불러오지 못했습니다.
        </div>
    {:else}
        <!-- z-0 스택 컨텍스트: Leaflet 내부 z-index 가 사이트 헤더/드롭다운을 덮지 않게 -->
        <div class="relative z-0">
            {#if mounted}
                <div
                    bind:this={mapContainer}
                    class="border-border h-48 w-full rounded-lg border sm:h-64"
                ></div>
            {:else}
                <div class="border-border h-48 w-full rounded-lg border sm:h-64"></div>
            {/if}
            {#if loading}
                <div
                    class="bg-background/60 absolute inset-0 flex items-center justify-center rounded-lg"
                >
                    <span class="text-muted-foreground text-sm">지도 불러오는 중...</span>
                </div>
            {/if}
        </div>
        {#if mapUrl}
            <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="text-muted-foreground hover:text-foreground mt-1 block text-right text-xs transition-colors"
            >
                지도에서 길찾기 →
            </a>
        {/if}
    {/if}
</div>
