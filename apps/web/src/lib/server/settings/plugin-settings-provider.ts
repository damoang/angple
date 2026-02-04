/**
 * 플러그인 설정 저장소 Provider
 *
 * JSON 파일 기반 플러그인 설정 관리
 * 테마 설정 Provider(json-provider.ts)와 동일한 패턴으로 구현되었습니다.
 */

import fs from 'fs/promises';
import path from 'path';

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
            console.log(`✅ 플러그인 설정 파일 생성: ${this.filePath}`);
        }
    }

    /**
     * 설정 읽기
     */
    private async read(): Promise<PluginSettings> {
        await this.ensureFile();
        const data = await fs.readFile(this.filePath, 'utf-8');
        return JSON.parse(data);
    }

    /**
     * 설정 쓰기
     */
    private async write(settings: PluginSettings): Promise<void> {
        await fs.writeFile(this.filePath, JSON.stringify(settings, null, 2), 'utf-8');
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
                console.log(`ℹ️ 플러그인 이미 활성화됨: ${pluginId}`);
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
            console.log(`✅ 플러그인 활성화: ${pluginId}`);
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
            console.log(`✅ 플러그인 비활성화: ${pluginId}`);
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
            console.log(`✅ 플러그인 설정 저장: ${pluginId}`);
        } finally {
            this.releaseLock();
        }
    }

    async getAllPluginSettings(): Promise<Record<string, unknown>> {
        return (await this.read()) as unknown as Record<string, unknown>;
    }
}

/**
 * 전역 플러그인 설정 Provider
 */
export const pluginSettingsProvider = new JsonPluginSettingsProvider();
