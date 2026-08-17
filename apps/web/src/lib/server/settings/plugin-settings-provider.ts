/**
 * 플러그인 설정 저장소 Provider
 *
 * JSON 파일 기반 플러그인 설정 관리
 * 테마 설정 Provider(json-provider.ts)와 동일한 패턴으로 구현되었습니다.
 */

import fs from 'fs/promises';
import path from 'path';
import { env } from '$env/dynamic/private';
import { DbPluginSettingsProvider } from './db-plugin-settings-provider';

/**
 * 플러그인 설정 Provider 인터페이스
 */
export interface PluginSettingsProvider {
    /**
     * 현재 활성화된 플러그인 ID 목록 조회
     * @returns 플러그인 ID 배열
     */
    getActivePlugins(): Promise<string[]>;

    /**
     * 플러그인 활성화
     * @param pluginId - 활성화할 플러그인 ID
     */
    activatePlugin(pluginId: string): Promise<void>;

    /**
     * 플러그인 비활성화
     * @param pluginId - 비활성화할 플러그인 ID
     */
    deactivatePlugin(pluginId: string): Promise<void>;

    /**
     * 특정 플러그인의 설정값 조회
     * @param pluginId - 플러그인 ID
     * @returns 플러그인 설정 객체
     */
    getPluginSettings(pluginId: string): Promise<Record<string, unknown>>;

    /**
     * 특정 플러그인의 설정값 저장
     * @param pluginId - 플러그인 ID
     * @param settings - 저장할 설정값
     */
    setPluginSettings(pluginId: string, settings: Record<string, unknown>): Promise<void>;

    /**
     * 전체 플러그인 설정 조회 (디버깅/백업용)
     */
    getAllPluginSettings(): Promise<Record<string, unknown>>;

    /**
     * 프로세스 로컬(in-memory) 캐시 무효화 (선택).
     * pub/sub 구독자가 다른 파드의 변경을 수신했을 때 호출한다.
     * 로컬 캐시가 없는 구현(JSON 파일 등)은 구현하지 않아도 된다.
     */
    invalidateLocal?(): void;
}

/**
 * 플러그인 설정 구조
 */
interface PluginSettings {
    /** 활성화된 플러그인 ID 목록 */
    activePlugins: string[];
    /** 플러그인별 설정 */
    plugins: Record<string, { settings: Record<string, unknown>; activatedAt?: string }>;
    /** 설정 버전 */
    version: string;
}

const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
    activePlugins: [],
    plugins: {},
    version: '1.0.0'
};

/**
 * JSON 파일 기반 플러그인 설정 Provider
 *
 * Self-hosted CMS 초기 단계에 적합
 * - 설치 간편 (DB 서버 불필요)
 * - 디버깅 쉬움 (파일 직접 수정 가능)
 * - Git으로 기본값 관리 가능
 */
class JsonPluginSettingsProvider implements PluginSettingsProvider {
    private filePath: string;
    private lock = false;
    private cachedSettings: PluginSettings | null = null;
    private cacheTimestamp = 0;
    private static readonly CACHE_TTL = 300_000; // 5분

    constructor(filePath?: string) {
        this.filePath = filePath || path.join(process.cwd(), 'data', 'plugin-settings.json');
    }

    /**
     * 파일 Lock (동시 쓰기 방지)
     */
    private async acquireLock(): Promise<void> {
        while (this.lock) {
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        this.lock = true;
    }

    private releaseLock(): void {
        this.lock = false;
    }

    /**
     * 설정 파일이 없으면 생성
     */
    private async ensureFile(): Promise<void> {
        try {
            await fs.access(this.filePath);
        } catch {
            // 파일 없음 → 생성
            const dir = path.dirname(this.filePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(
                this.filePath,
                JSON.stringify(DEFAULT_PLUGIN_SETTINGS, null, 2),
                'utf-8'
            );
        }
    }

    /**
     * 설정 읽기 (인메모리 캐시 적용)
     */
    private async read(): Promise<PluginSettings> {
        const now = Date.now();
        if (
            this.cachedSettings &&
            now - this.cacheTimestamp < JsonPluginSettingsProvider.CACHE_TTL
        ) {
            return this.cachedSettings;
        }
        await this.ensureFile();
        const data = await fs.readFile(this.filePath, 'utf-8');
        const parsed: PluginSettings = JSON.parse(data);
        this.cachedSettings = parsed;
        this.cacheTimestamp = now;
        return parsed;
    }

    /**
     * 설정 쓰기 (캐시 무효화)
     */
    private async write(settings: PluginSettings): Promise<void> {
        await fs.writeFile(this.filePath, JSON.stringify(settings, null, 2), 'utf-8');
        this.cachedSettings = settings;
        this.cacheTimestamp = Date.now();
    }

    // ========== Interface 구현 ==========

    async getActivePlugins(): Promise<string[]> {
        const settings = await this.read();
        return settings.activePlugins || [];
    }

    async activatePlugin(pluginId: string): Promise<void> {
        await this.acquireLock();
        try {
            const settings = await this.read();

            // 이미 활성화되어 있으면 스킵
            if (settings.activePlugins.includes(pluginId)) {
                return;
            }

            settings.activePlugins.push(pluginId);

            // 플러그인 설정 초기화 (없으면)
            if (!settings.plugins[pluginId]) {
                settings.plugins[pluginId] = {
                    settings: {},
                    activatedAt: new Date().toISOString()
                };
            } else {
                settings.plugins[pluginId].activatedAt = new Date().toISOString();
            }

            await this.write(settings);
        } finally {
            this.releaseLock();
        }
    }

    async deactivatePlugin(pluginId: string): Promise<void> {
        await this.acquireLock();
        try {
            const settings = await this.read();

            // 활성 플러그인 목록에서 제거
            settings.activePlugins = settings.activePlugins.filter((id) => id !== pluginId);

            await this.write(settings);
        } finally {
            this.releaseLock();
        }
    }

    async getPluginSettings(pluginId: string): Promise<Record<string, unknown>> {
        const settings = await this.read();
        return settings.plugins[pluginId]?.settings || {};
    }

    async setPluginSettings(
        pluginId: string,
        pluginSettings: Record<string, unknown>
    ): Promise<void> {
        await this.acquireLock();
        try {
            const settings = await this.read();
            if (!settings.plugins[pluginId]) {
                settings.plugins[pluginId] = { settings: {} };
            }
            settings.plugins[pluginId].settings = pluginSettings;
            await this.write(settings);
        } finally {
            this.releaseLock();
        }
    }

    async getAllPluginSettings(): Promise<Record<string, unknown>> {
        return (await this.read()) as unknown as Record<string, unknown>;
    }
}

/**
 * 전역 플러그인 설정 Provider (Facade)
 *
 * 환경변수로 저장소 선택 (PLUGIN_SETTINGS_PROVIDER 우선, 없으면 SETTINGS_PROVIDER 재사용):
 *   - json  (기본값) 파일. 단일 인스턴스·셀프호스팅용
 *   - mysql  MySQL 전용 테이블(angple_plugin_settings) + Redis. **다중 파드 운영은 이쪽**
 *
 * ⛔ 기본값을 mysql 로 바꾸지 말 것 — 셀프호스팅 사용자는 DB 스키마 없이 설치한다.
 *    운영 env 는 이미 mysql 이다. 이 코드는 mysql 매핑을 기존 MySqlPluginSettingsProvider
 *    (공유 angple_settings)에서 DbPluginSettingsProvider(전용 angple_plugin_settings)로 바꾼다.
 *    ⛔ 배포 전 반드시 006 DDL → 007 백필(angple_settings.active_plugins → 전용 테이블)을 선행할 것.
 *       백필 없이 배포하면 빈 전용 테이블을 SoT 로 읽어 전 플러그인이 꺼진다.
 * ⛔ json 구현을 지우지 말 것 — 셀프호스팅 롤백 경로다.
 *
 * 파일 기반의 한계(2026-07-31 실측): prod web 파드 다수에 볼륨 마운트가 없어 파일이
 * 이미지에 구워진 채 파드별로 분리된다 → admin 토글이 파드 1개에만 적용되고 재배포 시
 * 소실되며, Redis L2 공유와 맞물려 변경이 스스로 되돌아가는 flapping 까지 발생했다.
 * mysql 구현은 플러그인당 1행(원자적 UPSERT) + pub/sub 무효화로 이를 해소한다.
 * 자세한 배경은 db-plugin-settings-provider.ts 상단 주석 참조.
 */
const PROVIDER_TYPE = env.PLUGIN_SETTINGS_PROVIDER || env.SETTINGS_PROVIDER || 'json';

function createProvider(): PluginSettingsProvider {
    if (PROVIDER_TYPE === 'mysql') {
        console.log('[PluginSettings] Using MySQL + Redis provider (angple_plugin_settings)');
        return new DbPluginSettingsProvider();
    }
    console.log('[PluginSettings] Using JSON file provider');
    return new JsonPluginSettingsProvider();
}

export const pluginSettingsProvider = createProvider();
