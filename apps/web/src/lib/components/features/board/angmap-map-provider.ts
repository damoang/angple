/**
 * 앙지도 핀맵 지도 provider 설정.
 *
 * 지금은 Leaflet + OSM 타일. 카카오맵 JS SDK 도입 시(키 확보 후)
 * 이 상수만 교체/분기해 angmap-pin-map.svelte 의 렌더 엔진을 갈아끼운다 —
 * 컴포넌트는 provider 설정을 통해서만 타일 소스를 알도록 유지할 것.
 */

export type AngmapTileProviderId = 'osm';

export interface AngmapTileProvider {
    urlTemplate: string;
    attribution: string;
    maxZoom: number;
}

export const ANGMAP_TILE_PROVIDERS: Record<AngmapTileProviderId, AngmapTileProvider> = {
    osm: {
        urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        maxZoom: 19
    }
};

/** 현재 사용할 타일 provider (추후 설정/키 유무에 따라 kakao 로 교체 예정) */
export const ANGMAP_TILE_PROVIDER: AngmapTileProviderId = 'osm';

/** 핀 0건일 때 기본 화면 — 한반도 전역 */
export const ANGMAP_DEFAULT_CENTER: [number, number] = [36.35, 127.8];
export const ANGMAP_DEFAULT_ZOOM = 7;
