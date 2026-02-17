/**
 * 테마 마켓플레이스 API
 *
 * GET /api/themes/marketplace - 테마 목록 조회 (로컬 + 레지스트리 병합)
 *
 * 쿼리 파라미터:
 *   tier: 'free' | 'premium' | 'all' (기본값: 'all')
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getInstalledThemes } from '$lib/server/themes';
import { fetchThemeRegistry, mergeRegistryWithInstalled } from '$lib/server/themes/registry';

/**
 * GET /api/themes/marketplace
 * 로컬 설치 테마 + 외부 레지스트리 병합 목록 반환
 */
export const GET: RequestHandler = async ({ url }) => {
    try {
        const tierFilter = url.searchParams.get('tier') || 'all';

        // 로컬 설치 테마 + 레지스트리를 병렬 fetch
        const [installedThemes, registry] = await Promise.all([
            getInstalledThemes(),
            fetchThemeRegistry()
        ]);

        // 병합
        let themes = mergeRegistryWithInstalled(registry, installedThemes);

        // tier 필터
        if (tierFilter === 'free' || tierFilter === 'premium') {
            themes = themes.filter((t) => t.tier === tierFilter);
        }

        return json({
            themes,
            total: themes.length
        });
    } catch (error) {
        console.error('[API /themes/marketplace] 마켓플레이스 목록 조회 실패:', error);

        return json(
            {
                themes: [],
                total: 0,
                error: '테마 마켓플레이스 목록을 불러오는 데 실패했습니다.'
            },
            { status: 500 }
        );
    }
};
