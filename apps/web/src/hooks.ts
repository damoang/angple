import type { Reroute } from '@sveltejs/kit';

/**
 * wikiang.org: 위키 문서를 루트 URL에서 직접 serving 한다 (예: /대문, /이재명).
 *
 * 실제 위키 페이지 라우트는 `/wiki/[...path]` 그대로 두되, reroute 로 URL → 내부 라우트만 매핑한다.
 *  - URL `/대문`        → 내부 `/wiki/대문`   (URL 바는 `/대문` 유지)
 *  - 예약된 앱 경로(/api, /login, /search, [boardId] 등)는 그대로 둔다.
 *  - `/wiki/*` 직접 접근도 계속 동작(예약).
 *
 * ⚠️ RESERVED 는 routes/ 최상위 경로에서 도출. 새 최상위 라우트 추가 시 여기도 갱신해야
 *    해당 경로가 위키로 오인 라우팅되지 않는다.
 */
const RESERVED = new Set<string>([
    'wiki',
    'api',
    'admin',
    'auth',
    'login',
    'register',
    'password-reset',
    'cert',
    'my',
    'member',
    'messages',
    'notifications',
    'search',
    'tags',
    'explore',
    'empathy',
    'feed',
    'rss',
    'games',
    'groups',
    'guide',
    'faq',
    'info',
    'content',
    'advertising',
    'level',
    'point',
    'policy',
    'privacy',
    'terms',
    'themes',
    'plugin',
    'install',
    'health',
    'healthz',
    'go',
    'disciplinelog',
    'api-docs',
    'api-test',
    '2nd-anniversary',
    'ads.txt',
    'robots.txt',
    'manifest.json',
    '_app',
    'favicon.ico'
]);

export const reroute: Reroute = ({ url }) => {
    const pathname = url.pathname;
    // 루트(/)는 routes/+page.server.ts 가 대문으로 리다이렉트하도록 둔다.
    if (pathname === '/') return;

    const seg = pathname.split('/')[1] ?? '';
    // 예약 경로 / sitemap* / .well-known 은 그대로
    if (RESERVED.has(seg) || seg.startsWith('sitemap') || seg.startsWith('.well-known')) {
        return;
    }

    // 그 외 모든 경로 = 위키 문서 → 내부적으로 /wiki/<path> 로 라우팅 (URL 은 유지)
    return '/wiki' + pathname;
};
