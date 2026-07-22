<script lang="ts">
    // 앙지도 목록 상단 접이식 핀맵.
    //
    // SSR 안전이 최대 함정: Leaflet 은 브라우저 전용(window 참조)이라
    // 정적 import 금지 — 펼칠 때만 동적 import 하고, 지도 컨테이너도
    // {#if expanded} 로 클라이언트에서만 mount 한다.
    // 핀 데이터는 /api/angmap/pins (angmap_places ok 행 + 글 제목) — 읽기 전용.
    import { onMount, onDestroy, tick } from 'svelte';
    import { browser } from '$app/environment';
    import MapPin from '@lucide/svelte/icons/map-pin';
    import ChevronDown from '@lucide/svelte/icons/chevron-down';
    import ExternalLink from '@lucide/svelte/icons/external-link';
    import type { Map as LeafletMap } from 'leaflet';
    import {
        ANGMAP_TILE_PROVIDER,
        ANGMAP_TILE_PROVIDERS,
        ANGMAP_DEFAULT_CENTER,
        ANGMAP_DEFAULT_ZOOM
    } from './angmap-map-provider.js';

    interface AngmapPin {
        id: number;
        title: string;
        name: string | null;
        lat: number;
        lng: number;
        provider: string;
    }

    const STORAGE_KEY = 'angmap_pinmap_expanded';

    // 기존 정적 배너의 지도 바로가기 링크는 컴팩트하게 유지
    const shortcutLinks = [
        { name: '카카오맵', url: 'https://map.kakao.com/' },
        { name: '네이버 지도', url: 'https://map.naver.com/' },
        { name: '구글 지도', url: 'https://www.google.com/maps' }
    ];

    let expanded = $state(false);
    let loading = $state(false);
    let failed = $state(false);
    let pins = $state<AngmapPin[] | null>(null);
    let mapContainer = $state<HTMLDivElement | null>(null);

    let map: LeafletMap | null = null;
    let leafletPromise: Promise<typeof import('leaflet')> | null = null;

    function loadLeaflet(): Promise<typeof import('leaflet')> {
        if (!leafletPromise) {
            leafletPromise = Promise.all([
                import('leaflet'),
                // Leaflet CSS 도 지도를 펼칠 때만 로드 (vite 가 청크로 처리)
                import('leaflet/dist/leaflet.css')
            ]).then(([mod]) => mod);
        }
        return leafletPromise;
    }

    async function loadPins(): Promise<AngmapPin[]> {
        if (pins) return pins;
        const res = await fetch('/api/angmap/pins');
        if (!res.ok) throw new Error(`pins fetch failed: ${res.status}`);
        const body = (await res.json()) as { pins?: AngmapPin[] };
        pins = body.pins ?? [];
        return pins;
    }

    function escapeHtml(s: string): string {
        return s
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function initMap(leaflet: typeof import('leaflet'), pinData: AngmapPin[]): void {
        if (map || !mapContainer) return;
        const L = leaflet;
        const tile = ANGMAP_TILE_PROVIDERS[ANGMAP_TILE_PROVIDER];

        // preferCanvas: 1.5k+ circleMarker 를 캔버스로 렌더 (DOM 마커 회피)
        map = L.map(mapContainer, { preferCanvas: true, scrollWheelZoom: false });
        L.tileLayer(tile.urlTemplate, {
            attribution: tile.attribution,
            maxZoom: tile.maxZoom
        }).addTo(map);

        if (pinData.length === 0) {
            map.setView(ANGMAP_DEFAULT_CENTER, ANGMAP_DEFAULT_ZOOM);
            return;
        }

        for (const pin of pinData) {
            const label = escapeHtml(pin.name || pin.title);
            const title = escapeHtml(pin.title);
            L.circleMarker([pin.lat, pin.lng], {
                radius: 7,
                weight: 2,
                color: '#be123c',
                fillColor: '#f43f5e',
                fillOpacity: 0.75
            })
                .bindPopup(
                    `<a href="/angmap/${pin.id}" style="font-weight:600">${label}</a>` +
                        (pin.name && pin.name !== pin.title
                            ? `<br><span style="font-size:12px;color:#666">${title}</span>`
                            : '')
                )
                .addTo(map);
        }

        const bounds = L.latLngBounds(pinData.map((p) => [p.lat, p.lng] as [number, number]));
        map.fitBounds(bounds.pad(0.15), { maxZoom: 15 });
    }

    async function expand(): Promise<void> {
        if (!browser) return;
        expanded = true;
        persist('1');
        loading = true;
        failed = false;
        try {
            const [leaflet, pinData] = await Promise.all([loadLeaflet(), loadPins()]);
            await tick(); // {#if expanded} 컨테이너 mount 대기
            if (!expanded || !mapContainer) return;
            initMap(leaflet, pinData);
        } catch (err) {
            console.error('[angmap pinmap] init failed:', err);
            failed = true;
        } finally {
            loading = false;
        }
    }

    function collapse(): void {
        expanded = false;
        persist('0');
        map?.remove();
        map = null;
    }

    function toggle(): void {
        if (expanded) {
            collapse();
        } else {
            void expand();
        }
    }

    function persist(value: string): void {
        try {
            localStorage.setItem(STORAGE_KEY, value);
        } catch {
            // 프라이빗 모드 등 — 상태 기억만 포기
        }
    }

    onMount(() => {
        // 마지막 펼침 상태 복원 (기본 접힘 — 지도를 안 보는 방문엔 Leaflet 로드 0)
        try {
            if (localStorage.getItem(STORAGE_KEY) === '1') void expand();
        } catch {
            // ignore
        }
    });

    onDestroy(() => {
        map?.remove();
        map = null;
    });
</script>

<div class="mb-6">
    <div class="flex flex-wrap items-center justify-between gap-2">
        <button
            type="button"
            onclick={toggle}
            aria-expanded={expanded}
            class="text-foreground hover:bg-muted flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors"
        >
            <MapPin class="text-primary h-4 w-4" />
            장소 핀 지도
            {#if pins}
                <span class="text-muted-foreground font-normal">({pins.length}곳)</span>
            {/if}
            <ChevronDown
                class="text-muted-foreground h-4 w-4 transition-transform {expanded
                    ? 'rotate-180'
                    : ''}"
            />
        </button>

        <div class="text-muted-foreground flex items-center gap-3 text-xs">
            {#each shortcutLinks as link (link.name)}
                <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="hover:text-foreground flex items-center gap-1 transition-colors"
                >
                    {link.name}
                    <ExternalLink class="h-3 w-3" />
                </a>
            {/each}
        </div>
    </div>

    {#if expanded}
        <div class="mt-3">
            {#if failed}
                <div
                    class="border-border text-muted-foreground flex h-32 flex-col items-center justify-center gap-2 rounded-lg border text-sm"
                >
                    <p>지도를 불러오지 못했습니다.</p>
                    <button
                        type="button"
                        onclick={() => void expand()}
                        class="text-primary hover:underline"
                    >
                        다시 시도
                    </button>
                </div>
            {:else}
                <!-- z-0 스택 컨텍스트: Leaflet 내부 z-index(~700)가 사이트 헤더/드롭다운을 덮지 않게 -->
                <div class="relative z-0">
                    <div
                        bind:this={mapContainer}
                        class="border-border h-72 w-full rounded-lg border sm:h-96"
                    ></div>
                    {#if loading}
                        <div
                            class="bg-background/60 absolute inset-0 flex items-center justify-center rounded-lg"
                        >
                            <span class="text-muted-foreground text-sm">지도 불러오는 중...</span>
                        </div>
                    {/if}
                </div>
                {#if pins && pins.length === 0 && !loading}
                    <p class="text-muted-foreground mt-2 text-xs">
                        아직 지도에 표시할 장소가 없습니다. 글에 지도 링크를 남기면 핀으로 모입니다.
                    </p>
                {/if}
            {/if}
        </div>
    {/if}
</div>
