import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { safeRedirectUrl } from '$lib/server/safe-redirect';
import { getActivePlugins } from '$lib/server/plugins';

/**
 * Admin 레이아웃 서버 로드
 *
 * hooks.server.ts에서 이미 SSR 인증 완료 → event.locals 사용
 * level >= 10 이면 관리자
 *
 * Phase 1 (issue #1289): 활성 plugin 의 admin.menu 항목을 사이드바에 자동 추가.
 */

interface PluginAdminMenuEntry {
    pluginId: string;
    title: string;
    href: string;
    icon?: string;
    position?: number;
}

async function loadPluginAdminMenuEntries(): Promise<PluginAdminMenuEntry[]> {
    try {
        const plugins = await getActivePlugins();
        const entries: PluginAdminMenuEntry[] = [];
        for (const plugin of plugins) {
            const menu = plugin.manifest.ui?.admin?.menu;
            if (!menu) continue;
            entries.push({
                pluginId: plugin.manifest.id,
                title: menu.title,
                href: `/admin/plugins/${plugin.manifest.id}`,
                icon: menu.icon,
                position: menu.position
            });
        }
        entries.sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999));
        return entries;
    } catch (err) {
        console.error('[admin layout] failed to load plugin admin menu entries:', err);
        return [];
    }
}

export const load: LayoutServerLoad = async ({ locals, url }) => {
    // 설치 페이지는 권한 체크 제외
    if (url.pathname.startsWith('/install')) {
        return { isAdmin: false, authChecked: false };
    }

    const isLoginPage = url.pathname === '/admin/login';
    const user = locals.user;

    if (user) {
        const isAdmin = user.level >= 10;

        if (isAdmin) {
            if (isLoginPage) {
                const redirectTo = safeRedirectUrl(url.searchParams.get('redirect'), '/admin');
                throw redirect(303, redirectTo);
            }
            const pluginAdminMenuEntries = await loadPluginAdminMenuEntries();
            return {
                isAdmin: true,
                authChecked: true,
                nickname: user.nickname,
                pluginAdminMenuEntries
            };
        }

        // 로그인됐지만 관리자 아님
        return {
            isAdmin: false,
            authChecked: true,
            accessDenied: true,
            nickname: user.nickname
        };
    }

    // 개발 모드: VITE_SKIP_AUTH
    const skipAuth = import.meta.env.VITE_SKIP_AUTH === 'true';
    if (skipAuth) {
        if (isLoginPage) throw redirect(303, '/admin');
        const pluginAdminMenuEntries = await loadPluginAdminMenuEntries();
        return { isAdmin: true, authChecked: true, pluginAdminMenuEntries };
    }

    // 로그인 페이지는 그대로 표시
    if (isLoginPage) {
        return { isAdmin: false, authChecked: true };
    }

    // 미인증 → 로그인 페이지로 리다이렉트
    throw redirect(303, `/admin/login?redirect=${encodeURIComponent(url.pathname)}`);
};
