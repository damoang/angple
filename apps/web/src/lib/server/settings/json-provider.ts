import fs from 'fs/promises';
import path from 'path';
import type { SettingsProvider } from './provider';
import type { WidgetConfig } from '$lib/stores/widget-layout.svelte';

/**
 * JSON 파일 기반 설정 Provider
 *
 * Self-hosted CMS 초기 단계에 적합
 * - 설치 간편 (DB 서버 불필요)
 * - 디버깅 쉬움 (파일 직접 수정 가능)
 * - Git으로 기본값 관리 가능
 */

interface Settings {
    activeTheme: string | null;
    activatedAt?: string;
    themes: Record<string, { settings: Record<string, unknown> }>;
    version: string;
    widgetLayout?: WidgetConfig[];
    sidebarWidgetLayout?: WidgetConfig[];
}

const DEFAULT_SETTINGS: Settings = {
    activeTheme: null,
    activatedAt: undefined,
    themes: {},
    version: '1.0.0'
};

export class JsonSettingsProvider implements SettingsProvider {
    private filePath: string;
    private lock = false;

    // 인메모리 캐시: 매 요청마다 디스크 I/O 방지 (30초 TTL)
    private cachedSettings: Settings | null = null;
    private cacheExpiry = 0;
    private static readonly CACHE_TTL = 30_000; // 30초

    constructor(filePath?: string) {
        this.filePath = filePath || path.join(process.cwd(), 'data', 'settings.json');
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

    /** 캐시 무효화 (쓰기 후 호출) */
    private invalidateCache(): void {
        this.cachedSettings = null;
        this.cacheExpiry = 0;
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
            await fs.writeFile(this.filePath, JSON.stringify(DEFAULT_SETTINGS, null, 2), 'utf-8');
        }
    }

    /**
     * 설정 읽기 (인메모리 캐시 사용, 30초 TTL)
     */
    private async read(): Promise<Settings> {
        const now = Date.now();
        if (this.cachedSettings && now < this.cacheExpiry) {
            return this.cachedSettings;
        }
        await this.ensureFile();
        const data = await fs.readFile(this.filePath, 'utf-8');
        const settings = JSON.parse(data);
        this.cachedSettings = settings;
        this.cacheExpiry = now + JsonSettingsProvider.CACHE_TTL;
        return settings;
    }

    /**
     * 설정 쓰기 (캐시 무효화)
     */
    private async write(settings: Settings): Promise<void> {
        await fs.writeFile(this.filePath, JSON.stringify(settings, null, 2), 'utf-8');
        this.invalidateCache();
    }

    // ========== Interface 구현 ==========

    async getActiveTheme(): Promise<string | null> {
        const settings = await this.read();
        return settings.activeTheme;
    }

    async setActiveTheme(themeId: string): Promise<void> {
        await this.acquireLock();
        try {
            const settings = await this.read();
            settings.activeTheme = themeId;
            settings.activatedAt = new Date().toISOString();
            await this.write(settings);
        } finally {
            this.releaseLock();
        }
    }

    async getThemeSettings(themeId: string): Promise<Record<string, unknown>> {
        const settings = await this.read();
        return settings.themes[themeId]?.settings || {};
    }

    async setThemeSettings(themeId: string, themeSettings: Record<string, unknown>): Promise<void> {
        await this.acquireLock();
        try {
            const settings = await this.read();
            if (!settings.themes[themeId]) {
                settings.themes[themeId] = { settings: {} };
            }
            settings.themes[themeId].settings = themeSettings;
            await this.write(settings);
        } finally {
            this.releaseLock();
        }
    }

    async getAllSettings(): Promise<Record<string, unknown>> {
        return (await this.read()) as unknown as Record<string, unknown>;
    }

    // ========== 위젯 레이아웃 ==========

    async getWidgetLayout(): Promise<WidgetConfig[] | null> {
        const settings = await this.read();
        return settings.widgetLayout ?? null;
    }

    async setWidgetLayout(widgets: WidgetConfig[]): Promise<void> {
        await this.acquireLock();
        try {
            const settings = await this.read();
            settings.widgetLayout = widgets;
            await this.write(settings);
        } finally {
            this.releaseLock();
        }
    }

    async getSidebarWidgetLayout(): Promise<WidgetConfig[] | null> {
        const settings = await this.read();
        return settings.sidebarWidgetLayout ?? null;
    }

    async setSidebarWidgetLayout(widgets: WidgetConfig[]): Promise<void> {
        await this.acquireLock();
        try {
            const settings = await this.read();
            settings.sidebarWidgetLayout = widgets;
            await this.write(settings);
        } finally {
            this.releaseLock();
        }
    }
}
