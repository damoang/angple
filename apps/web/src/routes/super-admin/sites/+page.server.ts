import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { pool } from '$lib/server/db';
import { getSingoRole } from '$lib/server/singo-role';
import { scanThemes } from '$lib/server/themes/scanner';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * 최고관리자 — multi-tenant 사이트 목록 + 1-클릭 생성 화면.
 * 사이트 생성은 /api/super-admin/sites/create (POST) 가 담당하고, 이 load 는 목록/테마만 제공.
 */
export const load: PageServerLoad = async ({ locals }) => {
    const mbId = locals.user?.id;
    if (!mbId || (await getSingoRole(mbId)) !== 'super_admin') {
        throw error(403, '최고관리자 권한이 필요합니다.');
    }

    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT s.id, s.domain, s.theme_id, s.site_title, s.active, s.created_at,
                (SELECT GROUP_CONCAT(a.domain SEPARATOR ', ')
                   FROM angple_site_aliases a WHERE a.site_id = s.id) AS aliases
           FROM angple_sites s ORDER BY s.id`
    );

    const themesMap = await scanThemes();
    const themes = [...themesMap.values()]
        .map((m) => ({ id: m.id, name: m.name, description: m.description ?? '' }))
        .sort((a, b) => a.id.localeCompare(b.id));

    return {
        sites: rows.map((r) => ({
            id: r.id as number,
            domain: r.domain as string,
            themeId: r.theme_id as string,
            siteTitle: (r.site_title as string | null) ?? '',
            aliases: (r.aliases as string | null) ?? '',
            active: !!r.active,
            createdAt: r.created_at as string
        })),
        themes
    };
};
