/**
 * 플러그인 서버 API
 *
 * 파일 시스템 기반 플러그인 관리 및 settings.json 통합
 * 테마 서버 API(themes/index.ts)와 동일한 패턴으로 구현되었습니다.
 *
 * ExtensionManifest 사용:
 * - category가 'plugin'인 ExtensionManifest만 반환
 * - 통합된 스키마로 테마와 동일한 구조 사용
 */

import {
    scanPlugins,
    getPluginManifest,
    getPluginPath,
    isPluginInstalled,
    isCustomPlugin
} from './scanner';
import { pluginSettingsProvider } from '../settings/plugin-settings-provider';
import { TieredCache } from '$lib/server/cache';
import type { ExtensionManifest } from '@angple/types';
import { runPluginMigrations, rollbackPluginMigrations } from './migration-runner';
import { invalidateHandlerCache } from './route-dispatcher';
import { publishPluginInvalidation } from './invalidation';

/**
 * 설치된 플러그인의 전체 정보
 */
export interface InstalledPlugin {
    /** 플러그인 매니페스트 (ExtensionManifest with category='plugin') */
    manifest: ExtensionManifest;

    /** 현재 설정값 (settings.json에서 로드) */
    currentSettings?: Record<string, unknown>;

    /** 플러그인 디렉터리 절대 경로 */
    path: string;

    /** 활성 플러그인 여부 */
    isActive: boolean;

    /** 플러그인 출처 (official: Git 추적, custom: 사용자 업로드) */
    source: 'official' | 'custom';
}

/**
 * 설치된 모든 플러그인 목록 가져오기
 *
 * @returns 플러그인 ID를 key로 하는 InstalledPlugin 맵
 */
export async function getInstalledPlugins(): Promise<Map<string, InstalledPlugin>> {
    const plugins = new Map<string, InstalledPlugin>();

    // 1. 파일 시스템에서 플러그인 스캔
    const manifests = await scanPlugins();

    // 2. 활성 플러그인 ID 목록 조회
    const activePluginIds = await pluginSettingsProvider.getActivePlugins();

    // 3. 각 플러그인에 대해 InstalledPlugin 객체 생성
    for (const [pluginId, manifest] of manifests) {
        const currentSettings = await pluginSettingsProvider.getPluginSettings(pluginId);

        plugins.set(pluginId, {
            manifest,
            currentSettings,
            path: await getPluginPath(pluginId),
            isActive: activePluginIds.includes(pluginId),
            source: (await isCustomPlugin(pluginId)) ? 'custom' : 'official'
        });
    }

    return plugins;
}

/**
 * 특정 플러그인 정보 가져오기
 */
export async function getPluginById(pluginId: string): Promise<InstalledPlugin | null> {
    if (!(await isPluginInstalled(pluginId))) {
        return null;
    }

    const manifest = await getPluginManifest(pluginId);
    if (!manifest) {
        return null;
    }

    const currentSettings = await pluginSettingsProvider.getPluginSettings(pluginId);
    const activePluginIds = await pluginSettingsProvider.getActivePlugins();

    return {
        manifest,
        currentSettings,
        path: await getPluginPath(pluginId),
        isActive: activePluginIds.includes(pluginId),
        source: (await isCustomPlugin(pluginId)) ? 'custom' : 'official'
    };
}

// --- 2-tier 캐시: 활성 플러그인 (L1 3초, L2 5분) ---
//
// ⛔ L1 은 **파드마다 따로** 있고, `TieredCache.delete()` 는 그 요청을 처리한 파드의
//    L1 과 Redis 만 지운다. 무효화를 파드 간에 전파하는 pub/sub 이 없다.
//    → 관리자가 플러그인을 끄면 나머지 파드(운영 13개)는 L1 TTL 만큼 옛 값을 계속 쓴다.
//
// 30초였을 때 폭죽 플러그인에서 "켜기는 되는데 끄기가 안 된다"는 제보가 나왔다.
// 무효화 로직은 활성·비활성이 대칭이라 버그가 아니었고, 비대칭은 판정 기준에 있었다 —
// 켜기는 파드 하나만 갱신돼도 "됐다"로 보이지만, 끄기는 13개가 전부 갱신돼야
// "꺼졌다"로 보인다. 같은 지연이 정반대로 체감된다.
//
// 활성 플러그인 목록은 수십 바이트고 L2(Redis)가 받쳐 주므로 3초로 줄여도
// DB 부하 증가는 무시할 수준이다. 파드 간 지연 30초 → 3초.
//
// ⛔ 근본 해결은 아니다. 무효화 pub/sub 전파(TieredCache 전 소비자가 함께 이득)는
//    별건으로 남긴다. 열어 둔 탭은 body-end 슬롯 특성상 하드 리로드가 필요한 것도 그대로다.
// export: pub/sub 구독자(invalidation-subscriber.ts)가 다른 파드의 변경 수신 시
//         이 캐시의 L1 을 비운다(deleteL1).
export const activePluginsTieredCache = new TieredCache<InstalledPlugin[]>(
    'plugins:active',
    3_000,
    300,
    10
);

/**
 * 활성화된 모든 플러그인 가져오기 (TieredCache: L1 30초, L2 5분)
 */
export async function getActivePlugins(): Promise<InstalledPlugin[]> {
    return activePluginsTieredCache.getOrFetch('list', async () => {
        const activePluginIds = await pluginSettingsProvider.getActivePlugins();
        const activePlugins: InstalledPlugin[] = [];

        for (const pluginId of activePluginIds) {
            const plugin = await getPluginById(pluginId);
            if (plugin) {
                activePlugins.push(plugin);
            }
        }

        return activePlugins;
    });
}

/**
 * 플러그인 캐시 무효화 (활성화/비활성화/설정변경 시 호출).
 *
 * 1) 이 파드의 TieredCache(L1+L2) 를 지운다.
 * 2) pub/sub 으로 전 파드에 방송 → 각 파드 구독자가 자기 L1/provider 로컬 캐시를 비운다.
 *    (방송이 없으면 다른 파드는 L1 TTL 만큼 옛 값을 계속 쓴다 — 파드별 캐시 문제)
 */
export async function invalidateActivePluginsCache(): Promise<void> {
    await activePluginsTieredCache.delete('list');
    await publishPluginInvalidation({ type: 'active' });
}

/**
 * 플러그인 활성화
 *
 * settings.json의 activePlugins 배열에 플러그인 ID를 추가하고,
 * 매니페스트의 migrations를 실행합니다 (#1289).
 */
export async function activatePlugin(pluginId: string): Promise<boolean> {
    if (!(await isPluginInstalled(pluginId))) {
        console.error(`[Plugin API] 플러그인이 설치되지 않음: ${pluginId}`);
        return false;
    }

    const manifest = await getPluginManifest(pluginId);
    if (manifest?.migrations && manifest.migrations.length > 0) {
        const pluginPath = await getPluginPath(pluginId);
        try {
            const result = await runPluginMigrations(pluginId, pluginPath, manifest.migrations);
            console.info(
                `[Plugin API] ${pluginId} migrations: applied=${result.applied.length}, skipped=${result.skipped.length}`
            );
        } catch (err) {
            console.error(`[Plugin API] migration 실패: ${pluginId}`, err);
            return false;
        }
    }

    await pluginSettingsProvider.activatePlugin(pluginId);
    await invalidateActivePluginsCache();
    invalidateHandlerCache();

    return true;
}

/**
 * 플러그인 비활성화
 *
 * settings.json의 activePlugins 배열에서 플러그인 ID를 제거합니다.
 * 데이터 보존을 위해 migration은 자동으로 롤백되지 않습니다.
 * 명시적 롤백은 `rollbackPlugin` 사용.
 */
export async function deactivatePlugin(pluginId: string): Promise<boolean> {
    await pluginSettingsProvider.deactivatePlugin(pluginId);
    await invalidateActivePluginsCache();
    invalidateHandlerCache();

    return true;
}

/**
 * 플러그인 명시적 롤백 (관리자 액션).
 * 비활성화 + migration down 실행.
 */
export async function rollbackPlugin(pluginId: string): Promise<boolean> {
    const manifest = await getPluginManifest(pluginId);
    if (!manifest) {
        console.error(`[Plugin API] 매니페스트 없음: ${pluginId}`);
        return false;
    }

    await pluginSettingsProvider.deactivatePlugin(pluginId);

    if (manifest.migrations && manifest.migrations.length > 0) {
        const pluginPath = await getPluginPath(pluginId);
        try {
            const result = await rollbackPluginMigrations(
                pluginId,
                pluginPath,
                manifest.migrations
            );
            console.info(
                `[Plugin API] ${pluginId} rollback: rolledBack=${result.rolledBack.length}`
            );
        } catch (err) {
            console.error(`[Plugin API] rollback 실패: ${pluginId}`, err);
            return false;
        }
    }

    await invalidateActivePluginsCache();
    invalidateHandlerCache();
    return true;
}

/**
 * 플러그인 설정값 업데이트
 */
export async function updatePluginSettings(
    pluginId: string,
    newSettings: Record<string, unknown>
): Promise<boolean> {
    // Provider를 통해 플러그인 설정 업데이트
    await pluginSettingsProvider.setPluginSettings(pluginId, newSettings);

    // ⛔ 캐시 무효화 필수. activate/deactivate 는 하는데 여기만 빠져 있어,
    //    설정을 저장해도 getActivePlugins() 가 실어 나르는 currentSettings 가
    //    TieredCache(L1 30초/L2 300초)에 박힌 채 최대 5분간 반영되지 않았다.
    await invalidateActivePluginsCache();

    return true;
}

// Re-export scanner functions
export {
    getPluginManifest,
    getPluginPath,
    isPluginInstalled,
    scanPlugins,
    isCustomPlugin
} from './scanner';
