/**
 * 플러그인 마켓플레이스 API
 *
 * GET /api/plugins/marketplace - 공식 플러그인 목록 조회
 *
 * 하드코딩된 마켓플레이스 UI를 실제 plugins/ 디렉터리 스캔으로 대체
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getInstalledPlugins } from '$lib/server/plugins';
import type { ExtensionManifest } from '@angple/types';

/**
 * 마켓플레이스 플러그인 타입
 * Admin UI의 MarketplacePlugin 인터페이스와 호환
 */
interface MarketplacePlugin {
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
    packageName?: string;
    installed?: boolean; // 설치 여부 (활성화 여부)
}

/**
 * ExtensionManifest를 MarketplacePlugin으로 변환
 */
function transformToMarketplacePlugin(
    manifest: ExtensionManifest,
    isActive: boolean
): MarketplacePlugin {
    // author 필드 변환 (string 또는 object)
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
        description: manifest.description,
        version: manifest.version,
        author: authorName,
        downloads: (manifest as any).downloads ?? 0, // TODO: DB에 저장
        rating: (manifest as any).rating ?? 5, // TODO: DB에 저장
        tags: manifest.tags ?? [],
        category: (manifest as any).marketplaceCategory ?? 'plugin', // TODO: 세부 카테고리
        price: 0, // 공식 플러그인은 모두 무료
        screenshot: (manifest as any).screenshot,
        packageName: (manifest as any).packageName,
        installed: isActive
    };
}

/**
 * GET /api/plugins/marketplace
 * 공식 플러그인 목록 조회 (마켓플레이스용)
 */
export const GET: RequestHandler = async () => {
    try {
        // 설치된 모든 플러그인 조회
        const installedPlugins = await getInstalledPlugins();

        const marketplacePlugins: MarketplacePlugin[] = [];

        // 공식 플러그인만 필터링 및 변환
        for (const plugin of installedPlugins.values()) {
            // 공식 플러그인만 마켓플레이스에 표시
            if (plugin.source === 'official') {
                const marketplacePlugin = transformToMarketplacePlugin(
                    plugin.manifest,
                    plugin.isActive
                );
                marketplacePlugins.push(marketplacePlugin);
            }
        }

        return json({
            plugins: marketplacePlugins,
            total: marketplacePlugins.length
        });
    } catch (error) {
        console.error('[API /marketplace] 마켓플레이스 목록 조회 실패:', error);

        return json(
            {
                plugins: [],
                total: 0,
                error: '마켓플레이스 목록을 불러오는 데 실패했습니다.'
            },
            { status: 500 }
        );
    }
};
