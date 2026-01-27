/**
 * 플러그인 매니페스트 타입 (Web API 응답)
 */
export interface PluginManifest {
    /** 플러그인 ID (kebab-case) */
    id: string;

    /** 플러그인 이름 */
    name: string;

    /** 플러그인 버전 (semver) */
    version: string;

    /** 작성자 정보 */
    author: {
        name: string;
        email?: string;
        url?: string;
    };

    /** 플러그인 설명 */
    description?: string;

    /** 스크린샷 경로 */
    screenshot?: string;

    /** Hook 정의 */
    hooks?: Array<{
        name: string;
        type: 'action' | 'filter';
        callback: string;
        priority: number;
    }>;

    /** Component 정의 */
    components?: Array<{
        id: string;
        name: string;
        slot: string;
        path: string;
        priority: number;
    }>;

    /** 플러그인 설정 스키마 */
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

    /** 태그 (검색/필터링용) */
    tags?: string[];

    /** 필요한 Angple 버전 */
    angpleVersion?: string;
}

/**
 * 플러그인 상태
 */
export type PluginStatus = 'active' | 'inactive' | 'installing' | 'error';

/**
 * Admin UI에서 사용하는 확장된 플러그인 타입
 * 기본 PluginManifest에 설치 상태 및 메타데이터 추가
 */
export interface PluginWithStatus {
    /** 플러그인 매니페스트 (plugin.json 내용) */
    manifest: PluginManifest;

    /** 현재 상태 */
    status: PluginStatus;

    /** 설치 날짜 */
    installedAt: Date;

    /** 마지막 업데이트 날짜 */
    updatedAt?: Date;

    /** 활성화 날짜 (활성화된 경우) */
    activatedAt?: Date;

    /** 현재 적용된 설정값 */
    currentSettings?: Record<string, unknown>;

    /** 설치 소스 (official: Git 추적, custom: 사용자 업로드) */
    source?: string;

    /** 다운로드/설치 횟수 */
    downloadCount?: number;

    /** 에러 메시지 (상태가 error인 경우) */
    errorMessage?: string;
}

/**
 * 플러그인 설정 업데이트 요청
 */
export interface PluginSettingsUpdate {
    /** 플러그인 ID */
    pluginId: string;

    /** 업데이트할 설정값 */
    settings: Record<string, unknown>;
}

/**
 * 플러그인 액션 타입
 */
export type PluginAction = 'activate' | 'deactivate' | 'delete' | 'update' | 'install';

/**
 * 플러그인 필터 옵션
 */
export interface PluginFilter {
    /** 상태별 필터 */
    status?: PluginStatus[];

    /** 검색어 */
    search?: string;

    /** 태그별 필터 */
    tags?: string[];

    /** 정렬 기준 */
    sortBy?: 'name' | 'installedAt' | 'downloadCount';

    /** 정렬 순서 */
    sortOrder?: 'asc' | 'desc';
}
