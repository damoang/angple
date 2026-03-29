/**
 * 사이트 로고 스케줄 데이터 공유 모듈
 *
 * +layout.server.ts에서 SSR 데이터로 로드.
 * 60초 인메모리 캐시 포함.
 */
import { createCache } from '$lib/server/cache';
import { env } from '$env/dynamic/private';
import {
    buildLogoPreviews,
    getLogoTimeZone,
    resolveActiveLogo,
    type LogoPreview
} from '$lib/utils/logo-schedule';
import type { SupportedLocale } from '@angple/i18n';

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

interface RawLogoData {
    schedules: SiteLogoSchedule[];
}

export interface LogoData {
    active: SiteLogoSchedule | null;
    schedules: SiteLogoSchedule[];
    previews: LogoPreview[];
    requestLocale: SupportedLocale;
    requestTimeZone: string;
}

const logoCache = createCache<RawLogoData>({ ttl: 60_000, maxSize: 10 });

async function fetchLogoData(): Promise<RawLogoData> {
    const backendUrl = (env.BACKEND_URL || 'http://localhost:8090').replace(/\/$/, '');

    try {
        const response = await fetch(`${backendUrl}/api/v1/logos/active`, {
            signal: AbortSignal.timeout(2000)
        });

        if (!response.ok) {
            return { schedules: [] };
        }

        const result = await response.json();
        const data = result.data;

        return {
            schedules: data?.schedules || []
        };
    } catch {
        return { schedules: [] };
    }
}

/** 캐시된 로고 스케줄 조회 후 요청 locale 기준으로 활성 로고를 계산 */
export async function getCachedLogoData(requestLocale: SupportedLocale): Promise<LogoData> {
    const rawData = await logoCache.getOrSet('logo', fetchLogoData);
    const requestTimeZone = getLogoTimeZone(requestLocale);

    return {
        active: resolveActiveLogo(rawData.schedules, { timeZone: requestTimeZone }),
        schedules: rawData.schedules,
        previews: buildLogoPreviews(rawData.schedules),
        requestLocale,
        requestTimeZone
    };
}
