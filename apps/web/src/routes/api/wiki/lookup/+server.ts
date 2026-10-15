import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import { readPool } from '$lib/server/db';
import { canonicalWikiPath } from '$lib/wiki/paths';

/** 공개 문서 메타데이터만 제공한다. 회원·세션·원문 데이터는 공유하지 않는다. */
export const GET: RequestHandler = async ({ url }) => {
    const titles = [...new Set(url.searchParams.getAll('title').map((title) => title.trim()))];
    if (titles.length > 20 || titles.some((title) => !title || title.length > 255)) {
        return json({ error: 'invalid_titles' }, { status: 400 });
    }
    if (!titles.length) return json({ checked: [], pages: [] });
    try {
        const [rows] = await readPool.query<RowDataPacket[]>(
            `SELECT title, path FROM wikiang_pages
              WHERE title IN (${titles.map(() => '?').join(',')})
                AND is_published = 1 AND is_private = 0 AND namespace_id = 0
                AND locale = 'ko'
                AND path NOT LIKE '/위키앙\\_관리/%'
                AND path NOT LIKE '/삭제예정:%'
                AND path NOT LIKE '/토론/%'
                AND path NOT LIKE '/파일/%'
                AND path NOT LIKE '/틀/%'`,
            titles
        );
        const pages = titles.flatMap((title) => {
            const paths = [
                ...new Set(
                    rows
                        .filter((row) => row.title === title)
                        .map((row) => canonicalWikiPath(row.path))
                )
            ];
            // 동명 문서는 검색으로 안내한다. 경로를 추측하거나 첫 행을 임의 선택하지 않는다.
            return paths.length === 1 ? [{ title, path: paths[0] }] : [];
        });
        return json({ checked: titles, pages });
    } catch (error) {
        console.error('[wiki lookup] failed:', error);
        return json({ error: 'lookup_unavailable' }, { status: 503 });
    }
};
