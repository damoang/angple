/**
 * 이용제한 기록 상세 - SSR 데이터 로드
 *
 * 기존엔 클라이언트에서만 fetch(loading 스피너 → 왕복)해서 진입 시 지연이 체감됐다.
 * 상세 + 회원 이력을 서버에서 미리 로드해 즉시 렌더한다(스피너·클라 왕복 제거).
 * SvelteKit 이 라우트 파라미터 변경 시 load 를 재실행하므로 목록/이력에서 다른 row
 * 클릭(SPA 네비게이션)에도 그대로 반영된다.
 */
import type { PageServerLoad } from './$types';
import { backendFetch } from '$lib/server/backend-fetch.js';
import { safeJson } from '$lib/api/safe-json.js';
import type { DisciplineLogDetail, DisciplineLogListItem } from '$lib/api/discipline-log.js';

const SSR_HEADERS = { Accept: 'application/json', 'User-Agent': 'Angple-Web-SSR/1.0' };

export const load: PageServerLoad = async ({ params }) => {
    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) {
        return {
            log: null as DisciplineLogDetail | null,
            memberHistory: [] as DisciplineLogListItem[],
            loadError: true
        };
    }

    try {
        const res = await backendFetch(`/api/v1/discipline-logs/${id}`, { headers: SSR_HEADERS });
        if (!res.ok) {
            return { log: null, memberHistory: [] as DisciplineLogListItem[], loadError: true };
        }
        const result = await safeJson(res);
        const log: DisciplineLogDetail | null = result.data ?? null;
        if (!log) {
            return { log: null, memberHistory: [] as DisciplineLogListItem[], loadError: true };
        }

        // 이 회원의 전체 이용제한 이력(최대 100) — 함께 서버 로드. 실패해도 상세는 표시.
        let memberHistory: DisciplineLogListItem[] = [];
        if (log.member_id) {
            try {
                const hres = await backendFetch(
                    `/api/v1/discipline-logs?page=1&limit=100&member_id=${encodeURIComponent(log.member_id)}`,
                    { headers: SSR_HEADERS }
                );
                if (hres.ok) {
                    const hjson = await safeJson(hres);
                    memberHistory = hjson.data ?? [];
                }
            } catch {
                memberHistory = [];
            }
        }

        return { log, memberHistory, loadError: false };
    } catch {
        return { log: null, memberHistory: [] as DisciplineLogListItem[], loadError: true };
    }
};
