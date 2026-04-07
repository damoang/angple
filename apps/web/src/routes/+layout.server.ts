import type { LayoutServerLoad } from './$types';
import { getActiveTheme } from '$lib/server/themes';

/** 정적 도메인별 테마 오버라이드 (데모 + 랜딩) */
const STATIC_OVERRIDES: Record<string, string> = {
    'church.re.kr': 'church-landing',
    'www.church.re.kr': 'church-landing',
    'grace.church.re.kr': 'church-grace',
    'modern.church.re.kr': 'church-modern',
    'light.church.re.kr': 'church-light',
    'nature.church.re.kr': 'church-nature',
    'royal.church.re.kr': 'church-royal',
    'ocean.church.re.kr': 'church-ocean',
    'warm.church.re.kr': 'church-warm',
    'classic.church.re.kr': 'church-classic',
    'youth.church.re.kr': 'church-youth',
    'simple.church.re.kr': 'church-simple',
    'hdbc.kr': 'church-hdbc',
    'www.hdbc.kr': 'church-hdbc',
};

/** DB에서 동적 서브도메인 → 테마 조회 (church_sites) */
let dbThemeCache: Record<string, string> = {};
let dbCacheTime = 0;
const DB_CACHE_TTL = 60000; // 1분 캐시

async function getChurchTheme(hostname: string): Promise<string | null> {
    // 정적 오버라이드 우선
    if (STATIC_OVERRIDES[hostname]) return STATIC_OVERRIDES[hostname];

    // *.church.re.kr 서브도메인인지 확인
    if (!hostname.endsWith('.church.re.kr')) return null;

    // DB 캐시 체크
    if (Date.now() - dbCacheTime > DB_CACHE_TTL) {
        try {
            const { getPool } = await import('$lib/server/db/mysql');
            const pool = getPool();
            const [rows] = await pool.query(
                'SELECT subdomain, theme FROM church_sites WHERE active = 1'
            ) as any;
            dbThemeCache = {};
            for (const r of rows) {
                dbThemeCache[`${r.subdomain}.church.re.kr`] = r.theme;
            }
            dbCacheTime = Date.now();
        } catch { /* DB 연결 실패 시 캐시 유지 */ }
    }

    return dbThemeCache[hostname] || null;
}

/** 도메인별 SEO 메타데이터 */
const SITE_META: Record<string, { title: string; description: string; url: string }> = {
    'muzia.net': { title: 'Muzia — 음악을 사랑하는 사람들의 커뮤니티', description: 'Muzia는 음악을 사랑하는 사람들의 커뮤니티입니다. 시벨리우스, 피날레, 악보, 음악 토론, 설교 영상 등을 제공합니다.', url: 'https://muzia.net' },
    'muzia.io': { title: 'Muzia — 음악을 사랑하는 사람들의 커뮤니티', description: 'Muzia는 음악을 사랑하는 사람들의 커뮤니티입니다.', url: 'https://muzia.io' },
    'church.re.kr': { title: '처치레(ChurchRe) — 교회 홈페이지, 쉽고 빠르게', description: '월 1만원으로 교회 홈페이지를 만들어 드립니다. 10가지 테마, 설교 영상, 주보, 캘린더.', url: 'https://church.re.kr' },
    'hdbc.kr': { title: '흥덕침례교회 — 함께하는 은혜, 나누는 사랑', description: '흥덕침례교회에 오신 것을 환영합니다. 청주에서 하나님의 사랑을 나누는 공동체입니다.', url: 'https://hdbc.kr' },
};

/**
 * 서버 사이드 데이터 로드
 */
export const load: LayoutServerLoad = async ({ url }) => {
    console.log(`[SSR] Loading page: ${url.pathname}`);

    // 도메인별 SEO
    const hostname = url.hostname;
    const meta = SITE_META[hostname] || { title: 'Angple', description: '', url: `https://${hostname}` };

    // 도메인별 테마 (정적 + DB 동적)
    const churchTheme = await getChurchTheme(hostname);
    if (churchTheme) {
        console.log(`[SSR] Church theme: ${hostname} → ${churchTheme}`);
        return {
            pathname: url.pathname,
            activeTheme: churchTheme,
            themeSettings: {},
            siteTitle: meta.title,
            siteDescription: meta.description,
            siteUrl: meta.url,
        };
    }

    // 서버에서 활성 테마 조회
    const activeTheme = await getActiveTheme();
    console.log(`[SSR] Active theme: ${activeTheme?.manifest.id || 'null'}`);

    return {
        pathname: url.pathname,
        activeTheme: activeTheme?.manifest.id || null,
        themeSettings: activeTheme?.currentSettings || {},
        siteTitle: meta.title,
        siteDescription: meta.description,
        siteUrl: meta.url,
    };
};
