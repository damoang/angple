/**
 * 리액션 서버사이드 조회 (SSR용)
 *
 * /api/reactions GET 핸들러의 DB 조회 로직을 공유 모듈로 추출.
 * +page.server.ts에서 SSR 스트리밍으로 직접 호출하여 CDN 요청 제거.
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

interface ReactionRow extends RowDataPacket {
    target_id: string;
    reaction: string;
    reaction_count: number;
}

interface ChooseRow extends RowDataPacket {
    target_id: string;
    reaction: string;
}

export interface ReactionItem {
    reaction: string;
    category: string;
    reactionId: string;
    count: number;
    choose: boolean;
}

function parseReaction(reaction: string, count: number, choose: boolean): ReactionItem {
    const idx = reaction.indexOf(':');
    return {
        reaction,
        category: idx >= 0 ? reaction.substring(0, idx) : reaction,
        reactionId: idx >= 0 ? reaction.substring(idx + 1) : reaction,
        count,
        choose
    };
}

function sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9:_-]/g, '');
}

/**
 * parentId 기준 리액션 일괄 조회 (게시글 + 모든 댓글)
 * @param parentId e.g. "document:free:12345"
 * @param memberId 로그인한 사용자 mb_id (없으면 빈 문자열)
 */
export async function fetchReactionsByParentId(
    parentId: string,
    memberId: string = ''
): Promise<Record<string, ReactionItem[]>> {
    const safeParentId = sanitizeId(parentId);

    const [reactions] = await pool.query<ReactionRow[]>(
        `SELECT target_id, reaction, reaction_count FROM g5_da_reaction
		 WHERE parent_id = ? ORDER BY id ASC`,
        [safeParentId]
    );

    let memberChoices: ChooseRow[] = [];
    if (memberId) {
        [memberChoices] = await pool.query<ChooseRow[]>(
            `SELECT target_id, reaction FROM g5_da_reaction_choose
			 WHERE member_id = ? AND parent_id = ?`,
            [memberId, safeParentId]
        );
    }

    // 사용자 선택 맵
    const chooseMap = new Map<string, Set<string>>();
    for (const row of memberChoices) {
        if (!chooseMap.has(row.target_id)) {
            chooseMap.set(row.target_id, new Set());
        }
        chooseMap.get(row.target_id)!.add(row.reaction);
    }

    // 결과 구성
    const result: Record<string, ReactionItem[]> = {};
    for (const row of reactions) {
        if (!result[row.target_id]) {
            result[row.target_id] = [];
        }
        const isChosen = chooseMap.get(row.target_id)?.has(row.reaction) ?? false;
        result[row.target_id].push(parseReaction(row.reaction, row.reaction_count, isChosen));
    }

    return result;
}
