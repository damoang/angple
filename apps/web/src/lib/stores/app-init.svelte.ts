/**
 * 앱 초기화 스토어
 *
 * /api/init 엔드포인트를 1회 호출하여 celebration + banners 데이터를 메모리 캐시.
 * SPA 내비게이션 간 5분 TTL로 재사용하여 중복 API 호출 방지.
 */
import { browser } from '$app/environment';
import type { CelebrationBanner } from './celebration.svelte';

const CACHE_TTL = 5 * 60 * 1000; // 5분

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface InitData {
    celebration: CelebrationBanner[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    banners: Record<string, any[]>;
}

let cachedData: InitData | null = null;
let cacheTimestamp = 0;
let fetchPromise: Promise<InitData | null> | null = null;

function isCacheValid(): boolean {
    return cachedData !== null && Date.now() - cacheTimestamp < CACHE_TTL;
}

async function fetchInit(positions: string[]): Promise<InitData | null> {
    if (!browser) return null;

    try {
        const params = positions.length > 0 ? `?positions=${positions.join(',')}` : '';
        const res = await fetch(`/api/init${params}`);
        if (!res.ok) return null;
        const data: InitData = await res.json();
        cachedData = data;
        cacheTimestamp = Date.now();
        return data;
    } catch {
        return null;
    }
}

/**
 * 초기화 데이터 가져오기 (캐시 우선, 만료 시 fetch)
 */
export async function getInitData(positions: string[] = []): Promise<InitData | null> {
    if (isCacheValid()) return cachedData;

    // singleflight: 동시 호출 방지
    if (!fetchPromise) {
        fetchPromise = fetchInit(positions).finally(() => {
            fetchPromise = null;
        });
    }
    return fetchPromise;
}

/**
 * 캐시된 celebration 데이터 가져오기 (동기, 없으면 null)
 */
export function getCachedCelebrations(): CelebrationBanner[] | null {
    if (isCacheValid() && cachedData) return cachedData.celebration;
    return null;
}

/**
 * 캐시된 banners 데이터 가져오기 (동기, 없으면 null)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCachedBanners(position: string): any[] | null {
    if (isCacheValid() && cachedData?.banners?.[position]) {
        return cachedData.banners[position];
    }
    return null;
}
