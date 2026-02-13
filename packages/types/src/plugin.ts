/**
 * 플러그인 시스템 타입 정의
 */

import type { HookDefinition } from './hook.js';
import type { ComponentDefinition } from './theme.js';
import type { ExtensionManifest, PluginType } from './extension.js';

/**
 * 플러그인 API 엔드포인트 정의
 */
export interface ApiEndpoint {
    /** 엔드포인트 경로 (예: /api/v2/custom) */
    path: string;

    /** HTTP 메서드 */
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

    /** 핸들러 함수 경로 */
    handler: string;

    /** 미들웨어 목록 */
    middleware?: string[];

    /** 인증 필요 여부 */
    requireAuth?: boolean;

    /** 권한 체크 */
    permissions?: string[];
}

/**
 * 데이터베이스 마이그레이션 정의
 */
export interface Migration {
    /** 마이그레이션 버전 */
    version: string;

    /** 마이그레이션 설명 */
    description: string;

    /** Up 스크립트 경로 */
    up: string;

    /** Down 스크립트 경로 */
    down: string;
}

/**
 * 플러그인 메타데이터 (plugin.json)
 *
 * ExtensionManifest를 확장하여 플러그인 전용 필드를 추가합니다.
 * category는 항상 'plugin'으로 고정되며, pluginType으로 세부 분류합니다.
 */
export interface PluginManifest extends Omit<ExtensionManifest, 'category' | 'hooks' | 'settings'> {
    /** Extension 대분류 (플러그인으로 고정) */
    category: 'plugin';

    /** 플러그인 세부 분류 (BOARD, EDITOR, AUTH 등) */
    pluginType?: PluginType;

    /** 등록할 Hook 목록 (플러그인은 HookDefinition[] 형식 사용) */
    hooks?: HookDefinition[];

    /** 등록할 컴포넌트 목록 (UI 확장) */
    components?: ComponentDefinition[];

    /** API 엔드포인트 목록 (플러그인 전용) */
    endpoints?: ApiEndpoint[];

    /** 데이터베이스 마이그레이션 (플러그인 전용) */
    migrations?: Migration[];

    /** 설정 스키마 (플러그인 전용) */
    settings?: Record<string, any>;
}

/**
 * 활성화된 플러그인 정보
 *
 * @deprecated ExtensionManifest로 통합되었습니다. 하위 호환성을 위해 유지됩니다.
 */
export interface ActivePlugin {
    /** 플러그인 ID */
    id: string;

    /** 플러그인 이름 */
    name: string;

    /** 플러그인 버전 */
    version: string;

    /** Hook 목록 */
    hooks: Array<{
        name: string;
        type: 'action' | 'filter';
        callback: string;
        priority?: number;
    }>;

    /** Component 목록 */
    components: Array<{
        id: string;
        name: string;
        slot: string;
        path: string;
        priority?: number;
        props?: Record<string, unknown>;
    }>;

    /** 현재 설정값 */
    settings: Record<string, unknown>;
}
