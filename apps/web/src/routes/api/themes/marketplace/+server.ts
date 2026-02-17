/**
 * 테마 마켓플레이스 API
 *
 * GET /api/themes/marketplace - 공식 테마 목록 조회
 *
 * plugins/marketplace 패턴을 테마용으로 미러링
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getInstalledThemes } from '$lib/server/themes';
import type { ThemeManifest } from '$lib/types/theme';

/**
 * 마켓플레이스 테마 타입
 */
interface MarketplaceTheme {
    id: string;
    name: string;
    description: string;
    version: string;
    author: string;
    downloads: number;
    rating: number;
    tags: string[];
    category: string;
    price: number;
    screenshot?: string;
    installed?: boolean;
    isActive?: boolean;
}

/**
 * ThemeManifest를 MarketplaceTheme으로 변환
 */
function transformToMarketplaceTheme(
    manifest: ThemeManifest,
    isActive: boolean,
    source: string
): MarketplaceTheme {
    let authorName: string;
    if (typeof manifest.author === 'string') {
        authorName = manifest.author;
    } else if (manifest.author && 'name' in manifest.author) {
        authorName = manifest.author.name;
    } else {
        authorName = 'Unknown';
    }

    return {
        id: manifest.id,
        name: manifest.name,
        description: manifest.description || '',
        version: manifest.version,
        author: authorName,
        downloads: (manifest as any).downloads ?? 0,
        rating: (manifest as any).rating ?? 5,
        tags: manifest.tags ?? [],
        category: (manifest as any).themeCategory ?? 'general',
        price: 0,
        screenshot: manifest.screenshot,
        installed: true,
        isActive
    };
}

/**
 * GET /api/themes/marketplace
 * 공식 테마 목록 조회 (마켓플레이스용)
 */
export const GET: RequestHandler = async () => {
    try {
        const installedThemes = await getInstalledThemes();

        const marketplaceThemes: MarketplaceTheme[] = [];

        for (const theme of installedThemes.values()) {
            if (theme.source === 'official') {
                const marketplaceTheme = transformToMarketplaceTheme(
                    theme.manifest,
                    theme.isActive,
                    theme.source
                );
                marketplaceThemes.push(marketplaceTheme);
            }
        }

        console.log(
            `✅ [API /themes/marketplace] ${marketplaceThemes.length}개 공식 테마 반환`
        );

        return json({
            themes: marketplaceThemes,
            total: marketplaceThemes.length
        });
    } catch (error) {
        console.error('❌ [API /themes/marketplace] 마켓플레이스 목록 조회 실패:', error);

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
