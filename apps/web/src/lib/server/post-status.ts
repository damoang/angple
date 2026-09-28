/**
 * 글 처리 상태(해결됨·진행중·보류) 기능 플래그 — 게시판 확장설정 `post_status.enabled`.
 *
 * 배지 자체는 백엔드가 상태 행이 있는 글에 status 를 실어 주면 어디서나 그려진다.
 * 이 플래그는 **목록의 「해결됨 숨기기」 토글과 관리자 상태 변경 메뉴**를 보일지만 정한다.
 * 설계: docs/2026-09-28-bug-status-badge-sprint.html
 */
import { readPool } from '$lib/server/db.js';

interface ExtendedSettingsRow {
    // 컬럼이 JSON 타입이라 mysql2 가 **이미 객체로** 돌려준다(문자열이 아니다). 둘 다 받는다.
    settings: string | Record<string, unknown> | null;
}

function parseSettings(raw: ExtendedSettingsRow['settings']): {
    post_status?: { enabled?: boolean };
} {
    if (!raw) return {};
    if (typeof raw === 'string') return JSON.parse(raw) as { post_status?: { enabled?: boolean } };
    return raw as { post_status?: { enabled?: boolean } };
}

// 모든 게시판의 목록·상세 로드마다 부르므로 짧게 캐시한다(파드별, 60초). 설정 저장 뒤 최대 1분 지연.
const FLAG_TTL_MS = 60_000;
const flagCache = new Map<string, { value: boolean; expiresAt: number }>();

export async function boardHasPostStatusFeature(boardId: string): Promise<boolean> {
    const now = Date.now();
    const hit = flagCache.get(boardId);
    if (hit && hit.expiresAt > now) return hit.value;
    let value = false;
    try {
        const [rows] = await readPool.query(
            `SELECT settings FROM v2_board_extended_settings WHERE board_id = ? LIMIT 1`,
            [boardId]
        );
        const row = (rows as ExtendedSettingsRow[])[0];
        value = parseSettings(row?.settings ?? null).post_status?.enabled === true;
    } catch {
        // 조회 실패는 기능 꺼짐으로 — 목록 자체를 막지 않는다. (실패값은 캐시하지 않는다)
        return false;
    }
    if (flagCache.size > 500) flagCache.clear();
    flagCache.set(boardId, { value, expiresAt: now + FLAG_TTL_MS });
    return value;
}
