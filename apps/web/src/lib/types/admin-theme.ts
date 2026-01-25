import type { ThemeManifest } from '@angple/types';

/**
 * 테마 상태
 */
export type ThemeStatus = 'active' | 'inactive' | 'installing' | 'error';

/**
 * Admin UI에서 사용하는 확장된 테마 타입
 * 기본 ThemeManifest에 설치 상태 및 메타데이터 추가
 */
export interface ThemeWithStatus {
    /** 테마 매니페스트 (theme.json 내용) */
    manifest: ThemeManifest;

    /** 현재 상태 */
    status: ThemeStatus;

    /** 설치 날짜 */
    installedAt: Date;

    /** 마지막 업데이트 날짜 */
    updatedAt?: Date;

    /** 활성화 날짜 (활성화된 경우) */
    activatedAt?: Date;

    /** 현재 적용된 설정값 */
    currentSettings?: Record<string, Record<string, unknown>>;

    /** 설치 소스 (github, marketplace, local 등) */
    source?: string;

    /** 다운로드/설치 횟수 */
    downloadCount?: number;

    /** 에러 메시지 (상태가 error인 경우) */
    errorMessage?: string;
}

/**
 * 테마 설치 요청 데이터
 */
export interface ThemeInstallRequest {
    /** GitHub URL 또는 마켓플레이스 ID */
    source: string;

    /** 설치 방법 */
    method: 'github' | 'marketplace' | 'upload';

    /** 업로드된 파일 (method가 'upload'인 경우) */
    file?: File;
}

/**
 * 테마 설정 업데이트 요청
 */
export interface ThemeSettingsUpdate {
    /** 테마 ID */
    themeId: string;

    /** 업데이트할 설정값 */
    settings: Record<string, unknown>;
}

/**
 * 테마 액션 타입
 */
export type ThemeAction = 'activate' | 'deactivate' | 'delete' | 'update' | 'install';

/**
 * 테마 필터 옵션
 */
export interface ThemeFilter {
    /** 상태별 필터 */
    status?: ThemeStatus[];

    /** 검색어 */
    search?: string;

    /** 태그별 필터 */
    tags?: string[];

    /** 정렬 기준 */
    sortBy?: 'name' | 'installedAt' | 'downloadCount';

    /** 정렬 순서 */
    sortOrder?: 'asc' | 'desc';
}
