/**
 * 플러그인 매니페스트 타입 (Web API 응답)
 */
export interface PluginManifest {
    id: string;
    name: string;
    version: string;
    author: {
        name: string;
        email?: string;
        url?: string;
    };
    description?: string;
    screenshot?: string;
    hooks?: Array<{
        name: string;
        type: 'action' | 'filter';
        callback: string;
        priority: number;
    }>;
    components?: Array<{
        id: string;
        name: string;
        slot: string;
        path: string;
        priority: number;
    }>;
    settings?: Record<
        string,
        {
            label: string;
            type: 'text' | 'color' | 'boolean' | 'number' | 'select' | 'textarea' | 'url';
            default: unknown;
            description?: string;
            options?: Array<{ label: string; value: unknown }>;
            min?: number;
            max?: number;
            step?: number;
            secret?: boolean;
        }
    >;
    tags?: string[];
    angpleVersion?: string;
}

export type PluginStatus = 'active' | 'inactive' | 'installing' | 'error';

export interface PluginWithStatus {
    manifest: PluginManifest;
    status: PluginStatus;
    installedAt: Date;
    updatedAt?: Date;
    activatedAt?: Date;
    currentSettings?: Record<string, unknown>;
    source?: string;
    downloadCount?: number;
    errorMessage?: string;
}

export interface PluginSettingsUpdate {
    pluginId: string;
    settings: Record<string, unknown>;
}

export type PluginAction = 'activate' | 'deactivate' | 'delete' | 'update' | 'install';

export interface PluginFilter {
    status?: PluginStatus[];
    search?: string;
    tags?: string[];
    sortBy?: 'name' | 'installedAt' | 'downloadCount';
    sortOrder?: 'asc' | 'desc';
}
