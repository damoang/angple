import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';
import { getSingoRole } from '$lib/server/singo-role';
import { invalidateDbSiteCache } from '$lib/server/site-resolver/db';
import { scanThemes } from '$lib/server/themes/scanner';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

/**
 * PATCH/DELETE /api/super-admin/sites/[id] — 사이트 수정/삭제.
 * (생성은 형제 라우트 /create — SvelteKit 가 정적 세그먼트를 [id] 보다 우선 매칭)
 *
 * 권한: 최고관리자(super_admin) 전용. 변경 후 DbSiteResolver cache 즉시 무효화.
 */

async function isSuperAdmin(mbId: string | undefined): Promise<boolean> {
    return !!mbId && (await getSingoRole(mbId)) === 'super_admin';
}

/** 사이트의 모든 host (primary + alias) — cache 무효화용 */
async function siteHosts(id: number): Promise<string[]> {
    const [primary] = await pool.query<RowDataPacket[]>(
        'SELECT domain FROM angple_sites WHERE id = ? LIMIT 1',
        [id]
    );
    if (primary.length === 0) return [];
    const [aliases] = await pool.query<RowDataPacket[]>(
        'SELECT domain FROM angple_site_aliases WHERE site_id = ?',
        [id]
    );
    return [primary[0].domain as string, ...aliases.map((a) => a.domain as string)];
}

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
    if (!(await isSuperAdmin(locals.user?.id))) {
        return json({ success: false, message: '최고관리자 권한이 필요합니다.' }, { status: 403 });
    }
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return json({ success: false, message: '잘못된 사이트 ID 입니다.' }, { status: 400 });
    }

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return json({ success: false, message: '잘못된 요청 본문입니다.' }, { status: 400 });
    }

    const sets: string[] = [];
    const values: unknown[] = [];

    if (body.themeId !== undefined) {
        const themeId = String(body.themeId).trim();
        const themes = await scanThemes();
        if (!themes.has(themeId)) {
            return json(
                { success: false, message: `설치되지 않은 테마입니다: ${themeId}` },
                { status: 400 }
            );
        }
        sets.push('theme_id = ?');
        values.push(themeId);
    }
    if (body.siteTitle !== undefined) {
        const t = String(body.siteTitle).trim().slice(0, 255);
        sets.push('site_title = ?');
        values.push(t || null);
    }
    if (body.siteDescription !== undefined) {
        const d = String(body.siteDescription).trim().slice(0, 1000);
        sets.push('site_description = ?');
        values.push(d || null);
    }
    if (body.active !== undefined) {
        sets.push('active = ?');
        values.push(body.active ? 1 : 0);
    }

    if (sets.length === 0) {
        return json({ success: false, message: '변경할 항목이 없습니다.' }, { status: 400 });
    }

    const hosts = await siteHosts(id);
    if (hosts.length === 0) {
        return json({ success: false, message: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    values.push(id);
    await pool.query<ResultSetHeader>(
        `UPDATE angple_sites SET ${sets.join(', ')} WHERE id = ?`,
        values
    );

    // 수정 즉시 반영
    for (const h of hosts) await invalidateDbSiteCache(h);

    return json({ success: true });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
    if (!(await isSuperAdmin(locals.user?.id))) {
        return json({ success: false, message: '최고관리자 권한이 필요합니다.' }, { status: 403 });
    }
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return json({ success: false, message: '잘못된 사이트 ID 입니다.' }, { status: 400 });
    }

    const hosts = await siteHosts(id);
    if (hosts.length === 0) {
        return json({ success: false, message: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    // angple_site_aliases 는 FK ON DELETE CASCADE 로 함께 삭제됨
    await pool.query<ResultSetHeader>('DELETE FROM angple_sites WHERE id = ?', [id]);

    for (const h of hosts) await invalidateDbSiteCache(h);

    return json({ success: true });
};
