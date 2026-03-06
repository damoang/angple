import type { LayoutServerLoad } from './$types';
import { getActiveTheme } from '$lib/server/themes';
import { getActivePlugins } from '$lib/server/plugins';
import { loadMenus } from '$lib/server/menu-loader';
import { getCachedCelebrations } from '$lib/server/celebration';
import { getAdsServerUrl } from '$lib/server/ads/config';

/** ads 서버에서 배너 데이터 내부 호출 (CDN 우회, localhost:9090 직접) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchBannersByPositions(positions: string[]): Promise<Record<string, any[]>> {
    const adsServerUrl = getAdsServerUrl();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: Record<string, any[]> = {};

    await Promise.all(
        positions.map(async (position) => {
            try {
                const response = await fetch(
                    `${adsServerUrl}/api/v1/serve/banners?position=${encodeURIComponent(position)}&limit=10`
                );
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.data?.banners) {
                        result[position] = data.data.banners;
                    }
                }
            } catch {
                // 개별 position 실패는 무시
            }
        })
    );

    return result;
}

/**
 * 서버 사이드 데이터 로드
 * 모든 페이지 로드 전에 실행됨
 *
 * Promise.allSettled 사용: 개별 실패해도 사이트 전체가 크래시되지 않음
 *
 * celebration + banners: SSR에서 직접 로드하여 클라이언트 /api/init CDN 요청 제거
 */
export const load: LayoutServerLoad = async ({ locals }) => {
    // 병렬로 모든 데이터 로드 (allSettled: 개별 실패 허용)
    const [themeResult, pluginsResult, menusResult, celebrationResult, bannersResult] =
        await Promise.allSettled([
            getActiveTheme(),
            getActivePlugins(),
            loadMenus(),
            getCachedCelebrations(),
            fetchBannersByPositions(['index-top', 'board-head', 'sidebar'])
        ]);

    const activeTheme = themeResult.status === 'fulfilled' ? themeResult.value : null;
    const activePlugins = pluginsResult.status === 'fulfilled' ? pluginsResult.value : [];
    const menus = menusResult.status === 'fulfilled' ? menusResult.value : [];
    const celebration = celebrationResult.status === 'fulfilled' ? celebrationResult.value : [];
    const banners = bannersResult.status === 'fulfilled' ? bannersResult.value : {};

    // 실패 로깅 (크래시 안 함)
    for (const [name, r] of [
        ['Theme', themeResult],
        ['Plugins', pluginsResult],
        ['Menus', menusResult],
        ['Celebration', celebrationResult],
        ['Banners', bannersResult]
    ] as const) {
        if (r.status === 'rejected') {
            console.error(`[Layout] ${name} load failed:`, r.reason);
        }
    }

    return {
        activeTheme: activeTheme?.manifest.id || null,
        themeSettings: activeTheme?.currentSettings || {},
        activePlugins: activePlugins.map((plugin) => ({
            id: plugin.manifest.id,
            name: plugin.manifest.name,
            version: plugin.manifest.version,
            hooks: plugin.manifest.hooks || [],
            components: plugin.manifest.components || [],
            settings: plugin.currentSettings || {}
        })),
        menus,
        user: locals.user ?? null,
        accessToken: locals.accessToken ?? null,
        csrfToken: locals.csrfToken ?? null,
        isAdmin: (locals.user?.level ?? 0) >= 10,
        // SSR에서 직접 로드 — 클라이언트 /api/init 호출 제거
        celebration,
        banners
    };
};
