/**
 * 글 처리 상태(해결됨·진행중·보류) 기능 플래그 — 게시판 확장설정 `post_status.enabled`.
 *
 * 배지 자체는 백엔드가 상태 행이 있는 글에 status 를 실어 주면 어디서나 그려진다.
 * 이 플래그는 **목록의 「해결됨 숨기기」 토글과 관리자 상태 변경 메뉴**를 보일지만 정한다.
 * 설계: docs/2026-09-28-bug-status-badge-sprint.html
 */
import { readPool } from '$lib/server/db.js';

interface ExtendedSettingsRow {
    settings: string | null;
}

export async function boardHasPostStatusFeature(boardId: string): Promise<boolean> {
    try {
        const [rows] = await readPool.query(
            `SELECT settings FROM v2_board_extended_settings WHERE board_id = ? LIMIT 1`,
            [boardId]
        );
        const row = (rows as ExtendedSettingsRow[])[0];
        if (!row?.settings) return false;
        const parsed = JSON.parse(row.settings) as { post_status?: { enabled?: boolean } };
        return parsed.post_status?.enabled === true;
    } catch {
        // 조회 실패는 기능 꺼짐으로 — 목록 자체를 막지 않는다.
        return false;
    }
}
