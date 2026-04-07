import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { isInstalled } from '$lib/server/install/check-installed';

/**
 * SvelteKit Server Hooks
 *
 * CORS 설정: Admin 앱에서 Web API 호출 허용
 * 미설치 시 /install로 리다이렉트
 */
export const handle: Handle = async ({ event, resolve }) => {
    // 미설치 상태: /install 경로가 아니면 설치 위저드로 리다이렉트
    const path = event.url.pathname;
    if (!isInstalled() && !path.startsWith('/install') && !path.startsWith('/api') && !path.startsWith('/_app')) {
        throw redirect(302, '/install');
    }

    // OPTIONS 요청 (CORS preflight) 처리
    if (event.request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            }
        });
    }

    // 도메인별 타이틀 매핑 (CSR 전용 페이지의 빈 <head>에 주입)
    const SITE_TITLES: Record<string, string> = {
        'muzia.net': 'Muzia — 음악을 사랑하는 사람들의 커뮤니티',
        'muzia.io': 'Muzia — 음악을 사랑하는 사람들의 커뮤니티',
        'church.re.kr': '처치레(ChurchRe) — 교회 홈페이지, 쉽고 빠르게',
        'hdbc.kr': '흥덕침례교회',
    };

    const hostname = event.url.hostname;
    const siteTitle = SITE_TITLES[hostname] || 'Angple';

    const response = await resolve(event, {
        transformPageChunk: ({ html }) => {
            // SSR이 비활성화된 페이지에서 빈 <head>에 <title> 주입
            if (!html.includes('<title>')) {
                html = html.replace('</head>', `<title>${siteTitle}</title></head>`);
            }
            return html;
        }
    });

    // 모든 응답에 CORS 헤더 추가
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return response;
};
