import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { pool } from '$lib/server/db';
import { getSingoRole } from '$lib/server/singo-role';
import { invalidateDbSiteCache } from '$lib/server/site-resolver/db';
import { scanThemes } from '$lib/server/themes/scanner';
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';

/**
 * POST /api/super-admin/sites/create — 1-클릭 신규 사이트 생성 (WordPress wpmu_create_blog 격)
 *
 * angple_sites row 를 추가하면 DbSiteResolver 가 해당 host 요청을 선택한 theme 으로 즉시
 * 해석한다 (cache invalidate 로 5분 TTL 대기 없이 반영). 콘텐츠가 비어 있어도 Tier 1 의
 * EmptySiteWelcome 이 표시되므로 사이트는 곧바로 정상 동작한다.
 *
 * 권한: 최고관리자(super_admin)만 — 전체 multi-tenant 네트워크에 사이트를 추가하는 작업.
 * 주의: DNS + reverse proxy 가 해당 host 를 이 서버로 향하게 하는 것은 별도 인프라 작업.
 */

// RFC 1123 hostname (라벨 1~63, 전체 ≤253, 최소 1개 점)
const HOST_RE =
    /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export const POST: RequestHandler = async ({ request, locals }) => {
    const mbId = locals.user?.id;
    if (!mbId || (await getSingoRole(mbId)) !== 'super_admin') {
        return json({ success: false, message: '최고관리자 권한이 필요합니다.' }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
        body = await request.json();
    } catch {
        return json({ success: false, message: '잘못된 요청 본문입니다.' }, { status: 400 });
    }

    const domain = String(body.domain ?? '')
        .trim()
        .toLowerCase();
    const themeId = String(body.themeId ?? '').trim();
    const siteTitle = body.siteTitle ? String(body.siteTitle).trim().slice(0, 255) : null;
    const siteDescription = body.siteDescription
        ? String(body.siteDescription).trim().slice(0, 1000)
        : null;
    const aliases: string[] = Array.isArray(body.aliases)
        ? [
              ...new Set((body.aliases as unknown[]).map((a) => String(a).trim().toLowerCase()))
          ].filter((a) => a && a !== domain)
        : [];

    if (!HOST_RE.test(domain)) {
        return json({ success: false, message: '올바른 도메인 형식이 아닙니다.' }, { status: 400 });
    }
    for (const a of aliases) {
        if (!HOST_RE.test(a)) {
            return json(
                { success: false, message: `올바르지 않은 별칭 도메인: ${a}` },
                { status: 400 }
            );
        }
    }

    // 설치된 테마인지 확인
    const themes = await scanThemes();
    if (!themes.has(themeId)) {
        return json(
            { success: false, message: `설치되지 않은 테마입니다: ${themeId}` },
            { status: 400 }
        );
    }

    // 중복 도메인 확인 (primary + alias 전체)
    const allHosts = [domain, ...aliases];
    const placeholders = allHosts.map(() => '?').join(',');
    const [dup] = await pool.query<RowDataPacket[]>(
        `SELECT domain FROM angple_sites WHERE domain IN (${placeholders})
         UNION SELECT domain FROM angple_site_aliases WHERE domain IN (${placeholders}) LIMIT 1`,
        [...allHosts, ...allHosts]
    );
    if (dup.length > 0) {
        return json(
            { success: false, message: `이미 등록된 도메인입니다: ${dup[0].domain}` },
            { status: 409 }
        );
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [res] = await conn.query<ResultSetHeader>(
            `INSERT INTO angple_sites (domain, theme_id, site_title, site_description, active)
             VALUES (?, ?, ?, ?, 1)`,
            [domain, themeId, siteTitle, siteDescription]
        );
        const siteId = res.insertId;
        for (const a of aliases) {
            await conn.query('INSERT INTO angple_site_aliases (site_id, domain) VALUES (?, ?)', [
                siteId,
                a
            ]);
        }
        await conn.commit();

        // DbSiteResolver cache 즉시 무효화 — 새 사이트가 5분 TTL 대기 없이 바로 반영
        await invalidateDbSiteCache(domain);
        for (const a of aliases) await invalidateDbSiteCache(a);

        return json({ success: true, site: { id: siteId, domain, themeId, aliases } });
    } catch (e) {
        await conn.rollback();
        console.error('[super-admin/sites/create] insert 실패:', e);
        return json({ success: false, message: '사이트 생성 실패 (서버 오류)' }, { status: 500 });
    } finally {
        conn.release();
    }
};
