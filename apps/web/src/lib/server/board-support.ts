/**
 * 소모임 돌보기(임시 조치) — 이력 저장소 헬퍼 (서버 전용)
 *
 * 이력의 정본은 audit_logs 다. g5_da_content_history 는 operation 이
 * ENUM('수정','삭제') 라 당주 조치를 담을 수 없다(DDL 회피 결정).
 *
 * audit_logs 매핑:
 * - action      = 'board_owner.support_lock' | 'board_owner.support_unlock' (인덱스 있음)
 * - resource    = boardId
 * - resource_id = wr_id (문자열)
 * - details     = JSON { is_comment, author_id, author_name, wr_7_prev|wr_7_restored,
 *                        url, reason, subject }
 */
import type { RowDataPacket } from 'mysql2/promise';
import { readPool } from '$lib/server/db';

export const ACT_LOCK = 'board_owner.support_lock';
export const ACT_UNLOCK = 'board_owner.support_unlock';

export interface SupportHistoryRow {
    id: number;
    action: string;
    operatedBy: string;
    operatedAt: string;
    wrId: number;
    details: Record<string, unknown>;
}

function parseDetails(raw: unknown): Record<string, unknown> {
    try {
        const v = JSON.parse(String(raw ?? '{}'));
        return v && typeof v === 'object' ? v : {};
    } catch {
        return {};
    }
}

/** 이 보드의 당주 조치 이력 (최신순). action 인덱스 선필터 후 보드로 좁힌다. */
export async function listSupportHistory(
    boardId: string,
    limit = 50
): Promise<SupportHistoryRow[]> {
    const [rows] = await readPool.query<RowDataPacket[]>(
        `SELECT id, action, user_id, created_at, resource_id, details
           FROM audit_logs
          WHERE action IN (?, ?) AND resource = ?
          ORDER BY id DESC
          LIMIT ?`,
        [ACT_LOCK, ACT_UNLOCK, boardId, limit]
    );
    return rows.map((r) => ({
        id: Number(r.id),
        action: String(r.action),
        operatedBy: String(r.user_id ?? ''),
        operatedAt: String(r.created_at ?? ''),
        wrId: Number(r.resource_id),
        details: parseDetails(r.details)
    }));
}

/** 대상의 마지막 당주 조치 — unlock 권한 판정과 wr_7 복원값의 근거. */
export async function getLastSupportAction(
    boardId: string,
    wrId: number
): Promise<{ action: string; details: Record<string, unknown> } | null> {
    const [rows] = await readPool.query<RowDataPacket[]>(
        `SELECT action, details FROM audit_logs
          WHERE action IN (?, ?) AND resource = ? AND resource_id = ?
          ORDER BY id DESC LIMIT 1`,
        [ACT_LOCK, ACT_UNLOCK, boardId, String(wrId)]
    );
    if (!rows[0]) return null;
    return { action: String(rows[0].action), details: parseDetails(rows[0].details) };
}

/** 대상별 최신 조치가 '잠금'인 건수 = 현재 당주 잠금 중인 대상 수. */
export async function countActiveSupportLocks(boardId: string): Promise<number> {
    const rows = await listSupportHistory(boardId, 500);
    const lastByTarget = new Map<number, string>();
    for (const r of rows) {
        // 최신순이므로 처음 만난 것이 그 대상의 마지막 조치
        if (!lastByTarget.has(r.wrId)) lastByTarget.set(r.wrId, r.action);
    }
    let n = 0;
    for (const a of lastByTarget.values()) if (a === ACT_LOCK) n++;
    return n;
}
