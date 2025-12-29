/**
 * 플러그인 시스템 타입 정의
 */

import type { HookDefinition } from './hook.js';
import type { ComponentDefinition } from './theme.js';

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
 */
export interface PluginManifest {
    /** 플러그인 고유 ID (kebab-case) */
    id: string;

    /** 플러그인 이름 */
    name: string;

    /** 버전 (semver) */
    version: string;

    /** 작성자 정보 */
    author: {
        name: string;
        email?: string;
        url?: string;
    };

    /** 플러그인 설명 */
    description: string;

    /** 플러그인 아이콘 */
    icon?: string;

    /** 플러그인 홈페이지 */
    homepage?: string;

    /** 라이선스 */
    license?: string;

    /** 의존성 */
    dependencies?: {
        plugins?: string[];
        packages?: Record<string, string>;
    };

    /** 등록할 Hook 목록 */
    hooks?: HookDefinition[];

    /** 등록할 컴포넌트 목록 (UI 확장) */
    components?: ComponentDefinition[];

    /** API 엔드포인트 목록 */
    endpoints?: ApiEndpoint[];

    /** 데이터베이스 마이그레이션 */
    migrations?: Migration[];

    /** 설정 스키마 */
    settings?: Record<string, any>;

    /** 지원하는 Angple 버전 */
    angpleVersion?: string;

    /** 플러그인 카테고리 */
    category?: 'widget' | 'integration' | 'analytics' | 'seo' | 'utility' | 'other';

    /** 플러그인 태그 */
    tags?: string[];
}

/**
 * 활성화된 플러그인 정보
 */
export interface ActivePlugin {
    /** 플러그인 매니페스트 */
    manifest: PluginManifest;

    /** 플러그인 디렉터리 경로 */
    path: string;

    /** 현재 설정값 */
    settings: Record<string, any>;

    /** 활성화 시간 */
    activatedAt: Date;

    /** 활성화 상태 */
    enabled: boolean;
}
