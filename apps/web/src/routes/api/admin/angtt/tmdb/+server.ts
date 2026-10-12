/**
 * TMDB 작품 검색 (관리자 전용) — 편집 화면에서 포스터·원제·개봉일·TMDB id 를 채울 후보 5개.
 *
 * GET ?q=검색어&kind=movie|tv → { enabled, results }
 * 키(TMDB_API_KEY)가 없으면 enabled=false · results=[] (화면은 버튼을 숨긴다).
 * 결과는 저장하지 않는다 — 관리자가 고른 값만 편집 저장으로 들어간다.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/require-admin.js';
import { isTmdbEnabled, searchTmdb } from '$lib/server/angtt-tmdb';

const NO_STORE = { 'cache-control': 'private, no-store' };

export const GET: RequestHandler = async ({ locals, url }) => {
    const denied = requireAdmin(locals);
    if (denied) return denied;

    if (!isTmdbEnabled()) {
        return json({ success: true, enabled: false, results: [] }, { headers: NO_STORE });
    }

    const q = (url.searchParams.get('q') ?? '').trim();
    const kind = url.searchParams.get('kind') === 'tv' ? 'tv' : 'movie';
    if (!q) {
        return json({ success: true, enabled: true, results: [] }, { headers: NO_STORE });
    }

    try {
        const results = await searchTmdb(q, kind);
        return json({ success: true, enabled: true, results }, { headers: NO_STORE });
    } catch (err) {
        console.error('[admin/angtt/tmdb] 검색 실패:', (err as Error)?.message ?? err);
        return json(
            { success: false, enabled: true, error: 'TMDB 검색에 실패했습니다.', results: [] },
            { status: 502, headers: NO_STORE }
        );
    }
};
