/**
 * 테마 시스템 타입 정의
 */

import type { HookDefinition } from './hook.js';
import type { ExtensionManifest } from './extension.js';

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
 *
 * ExtensionManifest를 확장하여 테마 전용 필드를 추가합니다.
 * category는 항상 'theme'로 고정되며, pluginType은 사용하지 않습니다.
 */
export interface ThemeManifest
    extends Omit<ExtensionManifest, 'category' | 'pluginType' | 'hooks' | 'settings'> {
    /** Extension 대분류 (테마로 고정) */
    category: 'theme';

    /** 등록할 Hook 목록 (테마는 HookDefinition[] 형식 사용) */
    hooks?: HookDefinition[];

    /** 등록할 컴포넌트 목록 (테마 전용) */
    components?: ComponentDefinition[];

    /** 테마 설정 스키마 (테마 전용 구조) */
    settings?: ThemeSettings;
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
