import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getPool } from '$lib/server/db/mysql';

/** GET /api/church/check-subdomain?subdomain=xxx */
export const GET: RequestHandler = async ({ url }) => {
    const subdomain = url.searchParams.get('subdomain')?.trim().toLowerCase();
    if (!subdomain || subdomain.length < 3) {
        return json({ available: false, error: '3자 이상 입력하세요' });
    }
    if (!/^[a-z0-9-]+$/.test(subdomain)) {
        return json({ available: false, error: '영문 소문자, 숫자, -만 가능합니다' });
    }

    // 예약어 체크
    const reserved = ['www', 'admin', 'api', 'app', 'mail', 'ftp', 'test', 'demo', 'church'];
    if (reserved.includes(subdomain)) {
        return json({ available: false, error: '사용할 수 없는 주소입니다' });
    }

    try {
        const pool = getPool();
        const [rows] = await pool.query(
            'SELECT id FROM church_sites WHERE subdomain = ?', [subdomain]
        ) as any;
        return json({ available: rows.length === 0 });
    } catch {
        return json({ available: false, error: 'DB 오류' });
    }
};
