import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection } from '$lib/server/db/mysql';
import { randomUUID } from 'crypto';

/** POST /api/church/signup — 교회 사이트 생성 */
export const POST: RequestHandler = async ({ request }) => {
    const conn = await getConnection();
    try {
        const { subdomain, site_name, owner_email, owner_name, theme, settings } = await request.json() as any;

        if (!subdomain || !site_name || !owner_email) {
            conn.release();
            return json({ success: false, error: '필수 정보를 입력해주세요' }, { status: 400 });
        }

        const sub = subdomain.trim().toLowerCase();

        // 중복 체크
        const [existing] = await conn.query(
            'SELECT id FROM church_sites WHERE subdomain = ?', [sub]
        ) as any;
        if (existing.length > 0) {
            conn.release();
            return json({ success: false, error: '이미 사용 중인 주소입니다' }, { status: 409 });
        }

        // 사이트당 최대 3개
        const [ownerCount] = await conn.query(
            'SELECT COUNT(*) as cnt FROM church_sites WHERE owner_email = ? AND active = 1', [owner_email]
        ) as any;
        if (ownerCount[0].cnt >= 3) {
            conn.release();
            return json({ success: false, error: '계정당 최대 3개까지 생성 가능합니다' }, { status: 429 });
        }

        const siteId = randomUUID();
        const settingsJson = settings ? JSON.stringify(settings) : null;

        await conn.query(
            'INSERT INTO church_sites (id, subdomain, site_name, owner_email, owner_name, theme, plan, settings_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [siteId, sub, site_name, owner_email, owner_name || '', theme || 'church-grace', 'free', settingsJson]
        );

        conn.release();

        return json({
            success: true,
            data: {
                site_id: siteId,
                subdomain: sub,
                site_url: `https://${sub}.church.re.kr`,
                theme: theme || 'church-grace',
                plan: 'free',
                message: '교회 홈페이지가 생성되었습니다!'
            }
        });
    } catch (error) {
        conn.release();
        console.error('[Church Signup] error:', error);
        return json({ success: false, error: '사이트 생성 실패' }, { status: 500 });
    }
};
