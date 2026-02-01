/**
 * Plugin Permission Manager
 *
 * 플러그인별 권한을 관리하고 검증합니다.
 * 최소 권한 원칙을 적용하여 플러그인이 요청한 권한만 허용합니다.
 */

import type { PluginPermission } from './types.js';

export class PermissionManager {
    /** 플러그인별 부여된 권한 */
    private grantedPermissions: Map<string, Set<PluginPermission>> = new Map();

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
     * 플러그인에 부여된 모든 권한 조회
     */
    getGranted(pluginId: string): PluginPermission[] {
        const perms = this.grantedPermissions.get(pluginId);
        return perms ? Array.from(perms) : [];
    }

    /**
     * 모든 권한 초기화
     */
    clearAll(): void {
        this.grantedPermissions.clear();
    }
}
