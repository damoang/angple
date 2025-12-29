/**
 * 테마 시스템 타입 정의
 */

import type { HookDefinition } from './hook.js';

/**
 * 컴포넌트가 렌더링될 슬롯 위치
 */
export type ComponentSlot =
    | 'header'
    | 'footer'
    | 'sidebar-left'
    | 'sidebar-right'
    | 'panel'
    | 'content-before'
    | 'content-after'
    | 'banner-left'
    | 'banner-right';

/**
 * 테마 컴포넌트 정의
 */
export interface ComponentDefinition {
    /** 컴포넌트 고유 식별자 */
    id: string;

    /** 컴포넌트 표시 이름 */
    name: string;

    /** 렌더링될 슬롯 위치 */
    slot: ComponentSlot;

    /** 컴포넌트 파일 경로 (테마 디렉터리 기준) */
    path: string;

    /** 컴포넌트에 전달될 props */
    props?: Record<string, any>;

    /** 우선순위 (같은 슬롯에 여러 컴포넌트가 있을 때) */
    priority?: number;

    /** 조건부 렌더링 (예: 특정 페이지에서만) */
    condition?: string;
}

/**
 * 테마 설정 스키마
 */
export interface ThemeSettings {
    /** 설정 그룹 */
    [group: string]: {
        /** 설정 항목 */
        [key: string]: {
            /** 표시 라벨 */
            label: string;

            /** 설명 */
            description?: string;

            /** 입력 타입 */
            type: 'text' | 'number' | 'color' | 'boolean' | 'select' | 'textarea';

            /** 기본값 */
            default: any;

            /** select 타입일 경우 옵션 */
            options?: Array<{ label: string; value: any }>;

            /** 유효성 검증 */
            validation?: {
                required?: boolean;
                min?: number;
                max?: number;
                pattern?: string;
            };
        };
    };
}

/**
 * 테마 메타데이터 (theme.json)
 */
export interface ThemeManifest {
    /** 테마 고유 ID (kebab-case) */
    id: string;

    /** 테마 이름 */
    name: string;

    /** 버전 (semver) */
    version: string;

    /** 작성자 정보 */
    author: {
        name: string;
        email?: string;
        url?: string;
    };

    /** 테마 설명 */
    description: string;

    /** 테마 스크린샷 URL */
    screenshot?: string;

    /** 테마 홈페이지 */
    homepage?: string;

    /** 라이선스 */
    license?: string;

    /** 의존성 (다른 테마/플러그인) */
    dependencies?: {
        themes?: string[];
        plugins?: string[];
        packages?: Record<string, string>;
    };

    /** 등록할 Hook 목록 */
    hooks?: HookDefinition[];

    /** 등록할 컴포넌트 목록 */
    components?: ComponentDefinition[];

    /** 테마 설정 스키마 */
    settings?: ThemeSettings;

    /** 지원하는 Angple 버전 */
    angpleVersion?: string;

    /** 테마 태그 */
    tags?: string[];
}

/**
 * 활성화된 테마 정보
 */
export interface ActiveTheme {
    /** 테마 매니페스트 */
    manifest: ThemeManifest;

    /** 테마 디렉터리 경로 */
    path: string;

    /** 현재 설정값 */
    settings: Record<string, any>;

    /** 활성화 시간 */
    activatedAt: Date;
}

/**
 * 테마 저장소 정보
 */
export interface ThemeRepository {
    /** 저장소 ID */
    id: string;

    /** 저장소 이름 */
    name: string;

    /** 저장소 URL */
    url: string;

    /** 저장소 타입 */
    type: 'github' | 'npm' | 'url';

    /** 인증 정보 (선택) */
    auth?: {
        token?: string;
        username?: string;
        password?: string;
    };
}
