import fs from 'fs/promises';
import path from 'path';
import { DEFAULT_SITE_SETTINGS, type SiteSettings } from '$lib/types/admin-settings.js';

/**
 * 사이트 설정 JSON 파일 Provider
 *
 * JsonSettingsProvider 패턴을 그대로 따름
 * 저장 위치: data/settings/site-settings.json
 */
export class SiteSettingsProvider {
    private filePath: string;
    private lock = false;

    constructor(filePath?: string) {
        this.filePath =
            filePath || path.join(process.cwd(), 'data', 'settings', 'site-settings.json');
    }

    private async acquireLock(): Promise<void> {
        while (this.lock) {
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        this.lock = true;
    }

    private releaseLock(): void {
        this.lock = false;
    }

    private async ensureFile(): Promise<void> {
        try {
            await fs.access(this.filePath);
        } catch {
            const dir = path.dirname(this.filePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(
                this.filePath,
                JSON.stringify(DEFAULT_SITE_SETTINGS, null, 2),
                'utf-8'
            );
            console.log(`site-settings.json 생성: ${this.filePath}`);
        }
    }

    /** 전체 설정 로드 */
    async load(): Promise<SiteSettings> {
        await this.ensureFile();
        const data = await fs.readFile(this.filePath, 'utf-8');
        const parsed = JSON.parse(data);
        // 기본값과 병합 (새 필드 추가 시 안전)
        return { ...DEFAULT_SITE_SETTINGS, ...parsed };
    }

    /** 전체 설정 저장 */
    async save(settings: SiteSettings): Promise<void> {
        await this.acquireLock();
        try {
            await this.ensureFile();
            await fs.writeFile(this.filePath, JSON.stringify(settings, null, 2), 'utf-8');
        } finally {
            this.releaseLock();
        }
    }

    /** 특정 섹션 가져오기 */
    async get<K extends keyof SiteSettings>(section: K): Promise<SiteSettings[K]> {
        const settings = await this.load();
        return settings[section];
    }

    /** 특정 섹션 업데이트 */
    async update<K extends keyof SiteSettings>(section: K, data: SiteSettings[K]): Promise<void> {
        await this.acquireLock();
        try {
            const settings = await this.load();
            settings[section] = data;
            await fs.writeFile(this.filePath, JSON.stringify(settings, null, 2), 'utf-8');
        } finally {
            this.releaseLock();
        }
    }
}

/** 싱글톤 인스턴스 */
export const siteSettingsProvider = new SiteSettingsProvider();
