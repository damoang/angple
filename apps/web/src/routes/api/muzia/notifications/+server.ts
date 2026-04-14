import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const BACKEND_URL = process.env.BACKEND_URL || 'http://muzia-api:8081';

/** GET /api/muzia/notifications — 알림 목록 (프록시) */
export const GET: RequestHandler = async ({ url, request }) => {
    const auth = request.headers.get('Authorization') || '';
    const page = url.searchParams.get('page') || '1';
    const limit = url.searchParams.get('limit') || '10';
    const action = url.searchParams.get('action');

    try {
        let apiUrl = `${BACKEND_URL}/api/v1/notifications`;

        if (action === 'unread-count') {
            apiUrl = `${BACKEND_URL}/api/v1/notifications/unread-count`;
        } else {
            apiUrl += `?page=${page}&limit=${limit}`;
        }

        const r = await fetch(apiUrl, { headers: { 'Authorization': auth } });
        const data = await r.json();
        return json(data, { status: r.status });
    } catch (error) {
        console.error('[Notifications] proxy error:', error);
        return json({ success: false, error: '알림 조회 실패' }, { status: 500 });
    }
};

/** POST /api/muzia/notifications — 알림 읽음/전체읽음 처리 */
export const POST: RequestHandler = async ({ url, request }) => {
    const auth = request.headers.get('Authorization') || '';
    const action = url.searchParams.get('action');
    const id = url.searchParams.get('id');

    try {
        let apiUrl: string;
        if (action === 'read-all') {
            apiUrl = `${BACKEND_URL}/api/v1/notifications/read-all`;
        } else if (action === 'read' && id) {
            apiUrl = `${BACKEND_URL}/api/v1/notifications/${id}/read`;
        } else {
            return json({ success: false, error: 'action 필요' }, { status: 400 });
        }

        const r = await fetch(apiUrl, { method: 'POST', headers: { 'Authorization': auth } });
        const data = await r.json();
        return json(data, { status: r.status });
    } catch (error) {
        console.error('[Notifications] proxy error:', error);
        return json({ success: false, error: '알림 처리 실패' }, { status: 500 });
    }
};
