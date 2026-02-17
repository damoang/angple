/**
 * Plugin Permission Manager
 *
 * 플러그인별 권한을 관리하고 검증합니다.
 * 최소 권한 원칙을 적용하여 플러그인이 요청한 권한만 허용합니다.
 */

import type { PluginPermission } from './types.js';

/**
 * 위험 권한 목록 — 설치 시 경고 표시 대상
 */
export const DANGEROUS_PERMISSIONS: PluginPermission[] = [
    'database:write',
    'users:write',
    'users:delete',
    'files:delete',
    'network:fetch',
    'network:websocket',
    'api:external'
];

/**
 * 훅 이름 → 필요 권한 매핑
 *
 * 플러그인이 훅을 등록할 때 해당 훅에 필요한 권한이 있는지 검증합니다.
 * 매핑에 없는 훅은 권한 검증 없이 허용됩니다.
 */
export const HOOK_PERMISSION_MAP: Record<string, PluginPermission> = {
    // 게시글 관련 훅
    post_created: 'posts:write',
    post_updated: 'posts:write',
    post_deleted: 'posts:delete',
    post_title: 'posts:read',
    post_content: 'posts:read',
    before_post_save: 'posts:write',
    after_post_save: 'posts:write',

    // 댓글 관련 훅
    comment_created: 'comments:write',
    comment_updated: 'comments:write',
    comment_deleted: 'comments:delete',
    comment_content: 'comments:read',

    // 사용자 관련 훅
    user_registered: 'users:write',
    user_updated: 'users:write',
    user_deleted: 'users:delete',
    user_login: 'users:read',
    user_logout: 'users:read',

    // 파일 관련 훅
    file_uploaded: 'files:write',
    file_deleted: 'files:delete',
    before_file_upload: 'files:write',

    // 설정 관련 훅
    settings_updated: 'settings:write',
    settings_loaded: 'settings:read'
};

/**
 * 권한 거부 에러
 */
export class PermissionDeniedError extends Error {
    constructor(
        public readonly pluginId: string,
        public readonly permission: PluginPermission,
        public readonly action: string
    ) {
        super(
            `[${pluginId}] 권한 거부: '${permission}' 필요 (${action})`
        );
        this.name = 'PermissionDeniedError';
    }
}

/** 감사 로그 항목 */
export interface AuditEntry {
    timestamp: Date;
    pluginId: string;
    permission: PluginPermission;
    action: string;
    granted: boolean;
}

export class PermissionManager {
    /** 플러그인별 부여된 권한 */
    private grantedPermissions: Map<string, Set<PluginPermission>> = new Map();

    /** 감사 로그 (최근 1000건) */
    private auditLog: AuditEntry[] = [];

    /** 감사 로그 최대 크기 */
    private static readonly MAX_AUDIT_LOG = 1000;

    /**
     * 플러그인에 권한 부여
     */
    grant(pluginId: string, permissions: PluginPermission[]): void {
        const existing = this.grantedPermissions.get(pluginId) ?? new Set();
        for (const perm of permissions) {
            existing.add(perm);
        }
        this.grantedPermissions.set(pluginId, existing);
    }

    /**
     * 플러그인의 모든 권한 회수
     */
    revoke(pluginId: string): void {
        this.grantedPermissions.delete(pluginId);
    }

    /**
     * 특정 권한 보유 여부 확인
     */
    check(pluginId: string, permission: PluginPermission): boolean {
        const perms = this.grantedPermissions.get(pluginId);
        return perms?.has(permission) ?? false;
    }

    /**
     * 권한을 요구하고, 없으면 PermissionDeniedError를 throw
     */
    require(pluginId: string, permission: PluginPermission, action: string): void {
        const granted = this.check(pluginId, permission);

        this.addAuditEntry(pluginId, permission, action, granted);

        if (!granted) {
            throw new PermissionDeniedError(pluginId, permission, action);
        }
    }

    /**
     * 훅 등록 시 필요 권한 검증
     *
     * @returns true면 허용, false면 거부
     */
    checkHookPermission(pluginId: string, hookName: string): boolean {
        const requiredPermission = HOOK_PERMISSION_MAP[hookName];

        // 매핑에 없는 훅은 자유롭게 허용
        if (!requiredPermission) {
            return true;
        }

        const granted = this.check(pluginId, requiredPermission);
        this.addAuditEntry(
            pluginId,
            requiredPermission,
            `hook:${hookName}`,
            granted
        );

        if (!granted) {
            console.warn(
                `[PermissionManager] 훅 등록 거부: ${pluginId} → ${hookName} (필요: ${requiredPermission})`
            );
        }

        return granted;
    }

    /**
     * 매니페스트의 권한 목록 중 위험 권한 분석
     */
    static analyzeDangerousPermissions(permissions: PluginPermission[]): {
        dangerous: PluginPermission[];
        safe: PluginPermission[];
        riskLevel: 'low' | 'medium' | 'high';
    } {
        const dangerous = permissions.filter((p) => DANGEROUS_PERMISSIONS.includes(p));
        const safe = permissions.filter((p) => !DANGEROUS_PERMISSIONS.includes(p));

        let riskLevel: 'low' | 'medium' | 'high' = 'low';
        if (dangerous.length >= 3) {
            riskLevel = 'high';
        } else if (dangerous.length >= 1) {
            riskLevel = 'medium';
        }

        return { dangerous, safe, riskLevel };
    }

    /**
     * 플러그인에 부여된 모든 권한 조회
     */
    getGranted(pluginId: string): PluginPermission[] {
        const perms = this.grantedPermissions.get(pluginId);
        return perms ? Array.from(perms) : [];
    }

    /**
     * 감사 로그 조회
     */
    getAuditLog(pluginId?: string): AuditEntry[] {
        if (pluginId) {
            return this.auditLog.filter((e) => e.pluginId === pluginId);
        }
        return [...this.auditLog];
    }

    /**
     * 모든 권한 초기화
     */
    clearAll(): void {
        this.grantedPermissions.clear();
        this.auditLog = [];
    }

    private addAuditEntry(
        pluginId: string,
        permission: PluginPermission,
        action: string,
        granted: boolean
    ): void {
        this.auditLog.push({
            timestamp: new Date(),
            pluginId,
            permission,
            action,
            granted
        });

        // 최대 크기 제한
        if (this.auditLog.length > PermissionManager.MAX_AUDIT_LOG) {
            this.auditLog = this.auditLog.slice(-PermissionManager.MAX_AUDIT_LOG);
        }
    }
}
