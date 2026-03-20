/**
 * 사이트 로고 스케줄 데이터 공유 모듈
 *
 * +layout.server.ts에서 SSR 데이터로 로드.
 * 60초 인메모리 캐시 포함.
 */
import { createCache } from '$lib/server/cache';
import { env } from '$env/dynamic/private';

export interface SiteLogoSchedule {
    id: number;
    name: string;
    logo_url: string;
    schedule_type: 'recurring' | 'date_range' | 'default';
    recurring_date?: string;
    start_date?: string;
    end_date?: string;
    priority: number;
}

export interface LogoData {
    active: SiteLogoSchedule | null;
    schedules: SiteLogoSchedule[];
}

const logoCache = createCache<LogoData>({ ttl: 60_000, maxSize: 10 });

async function fetchLogoData(): Promise<LogoData> {
    const backendUrl = (env.BACKEND_URL || 'http://localhost:8090').replace(/\/$/, '');

    try {
        const response = await fetch(`${backendUrl}/api/v1/logos/active`, {
            signal: AbortSignal.timeout(2000)
        });

        if (!response.ok) {
            return { active: null, schedules: [] };
        }

        const result = await response.json();
        const data = result.data;

        return {
            active: data?.active || null,
            schedules: data?.schedules || []
        };
    } catch {
        return { active: null, schedules: [] };
    }
}

/** 캐시된 로고 데이터 조회 (60초 TTL, singleflight) */
export async function getCachedLogoData(): Promise<LogoData> {
    return logoCache.getOrSet('logo', fetchLogoData);
}
