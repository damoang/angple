/**
 * 테마 마켓플레이스 레지스트리
 *
 * 외부 레지스트리(GitHub Pages JSON)에서 테마 목록을 가져오고,
 * 로컬 설치 테마와 병합하여 마켓플레이스 데이터를 제공합니다.
 */

import type { ThemeRegistry, RegistryTheme, MarketplaceTheme } from '$lib/types/registry';
import type { InstalledTheme } from './index';
import { env } from '$env/dynamic/private';

/** 캐시 TTL (5분) */
const CACHE_TTL_MS = 5 * 60 * 1000;

/** 메모리 캐시 */
let cachedRegistry: ThemeRegistry | null = null;
let cachedAt = 0;

/**
 * 레지스트리 URL 가져오기
 */
function getRegistryUrl(): string | null {
    return env.THEME_REGISTRY_URL || null;
}

/**
 * 외부 레지스트리에서 테마 목록 fetch
 *
 * - THEME_REGISTRY_URL 환경변수가 설정되어 있어야 합니다
 * - 5분 메모리 캐시 적용
 * - 네트워크 실패 시 빈 레지스트리 반환 (graceful fallback)
 */
export async function fetchThemeRegistry(): Promise<ThemeRegistry> {
    const url = getRegistryUrl();

    if (!url) {
        return { version: 0, updatedAt: '', themes: [] };
    }

    // 캐시가 유효하면 반환
    if (cachedRegistry && Date.now() - cachedAt < CACHE_TTL_MS) {
        return cachedRegistry;
    }

    try {
        const response = await fetch(url, {
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(10_000)
        });

        if (!response.ok) {
            console.error(`[Registry] fetch 실패: ${response.status} ${response.statusText}`);
            return cachedRegistry ?? { version: 0, updatedAt: '', themes: [] };
        }

        const data: ThemeRegistry = await response.json();
        cachedRegistry = data;
        cachedAt = Date.now();
        return data;
    } catch (error) {
        console.error('[Registry] 레지스트리 fetch 오류:', error);
        return cachedRegistry ?? { version: 0, updatedAt: '', themes: [] };
    }
}

/**
 * 레지스트리 캐시 초기화 (테스트/수동 갱신용)
 */
export function clearRegistryCache(): void {
    cachedRegistry = null;
    cachedAt = 0;
}

/**
 * 로컬 설치 테마 + 레지스트리 테마를 병합
 *
 * - 레지스트리에 있고 로컬에도 있으면: installed=true + 레지스트리 메타데이터
 * - 레지스트리에 있고 로컬에 없으면: installed=false
 * - 로컬에만 있으면 (레지스트리에 없으면): installed=true, tier=free
 */
export function mergeRegistryWithInstalled(
    registry: ThemeRegistry,
    installed: Map<string, InstalledTheme>
): MarketplaceTheme[] {
    const result: MarketplaceTheme[] = [];
    const processedIds = new Set<string>();

    // 1. 레지스트리 테마 처리
    for (const regTheme of registry.themes) {
        processedIds.add(regTheme.id);
        const localTheme = installed.get(regTheme.id);

        const localVersion = localTheme?.manifest.version;
        const registryVersion = regTheme.version;
        const hasUpdate = !!localTheme && !!localVersion && localVersion !== registryVersion;

        result.push({
            id: regTheme.id,
            name: regTheme.name,
            description: regTheme.description,
            version: localTheme ? localTheme.manifest.version : regTheme.version,
            author: regTheme.author,
            downloads: regTheme.downloads,
            rating: regTheme.rating,
            tags: regTheme.tags,
            category: regTheme.category,
            price: regTheme.price,
            screenshot: regTheme.screenshot,
            installed: !!localTheme,
            isActive: localTheme?.isActive ?? false,
            tier: regTheme.tier,
            githubUrl: regTheme.githubUrl,
            githubPath: regTheme.githubPath,
            requiredScope: regTheme.requiredScope,
            licenseRequired: regTheme.licenseRequired,
            localVersion,
            registryVersion,
            hasUpdate
        });
    }

    // 2. 로컬에만 있는 테마 (레지스트리에 없는)
    for (const [themeId, localTheme] of installed) {
        if (processedIds.has(themeId)) continue;

        let authorName: string;
        const author = localTheme.manifest.author;
        if (typeof author === 'string') {
            authorName = author;
        } else if (author && 'name' in author) {
            authorName = author.name;
        } else {
            authorName = 'Unknown';
        }

        result.push({
            id: themeId,
            name: localTheme.manifest.name,
            description: localTheme.manifest.description || '',
            version: localTheme.manifest.version,
            author: authorName,
            downloads: 0,
            rating: 5,
            tags: localTheme.manifest.tags ?? [],
            category:
                ((localTheme.manifest as Record<string, unknown>).themeCategory as string) ??
                'general',
            price: 0,
            screenshot: localTheme.manifest.screenshot,
            installed: true,
            isActive: localTheme.isActive,
            tier: 'free'
        });
    }

    return result;
}

/**
 * 레지스트리에서 특정 테마 조회
 */
export async function getRegistryTheme(themeId: string): Promise<RegistryTheme | null> {
    const registry = await fetchThemeRegistry();
    return registry.themes.find((t) => t.id === themeId) ?? null;
}
