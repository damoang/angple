import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getConnection, getPool } from '$lib/server/db/mysql';
import { getUserFromRequest, getMbId } from '$lib/server/db/auth';

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

/** GET /api/muzia/reaction?target_id=comment:qna:123 — 리액션 조회 */
export const GET: RequestHandler = async ({ url }) => {
    try {
        const pool = getPool();
        const targetId = url.searchParams.get('target_id');
        if (!targetId) return json({ success: false, error: 'target_id 필요' }, { status: 400 });

        const [rows] = await pool.query(
            'SELECT reaction, reaction_count FROM g5_da_reaction WHERE target_id = ? ORDER BY reaction_count DESC',
            [targetId]
        );

        // 현재 사용자의 리액션 확인
        const auth = url.searchParams.get('mb_id');
        let myReactions: string[] = [];
        if (auth) {
            const [myRows] = await pool.query(
                'SELECT reaction FROM g5_da_reaction_choose WHERE member_id = ? AND target_id = ?',
                [auth, targetId]
            ) as any;
            myReactions = myRows.map((r: any) => r.reaction);
        }

        return json({ success: true, data: { reactions: rows, myReactions } });
    } catch (error) {
        console.error('[Reaction] GET error:', error);
        return json({ success: false, error: '리액션 조회 실패' }, { status: 500 });
    }
};

/** POST /api/muzia/reaction — 리액션 추가/제거 (토글) */
export const POST: RequestHandler = async ({ request }) => {
    const user = getUserFromRequest(request);
    if (!user) return json({ success: false, error: '로그인 필요' }, { status: 401 });

    try {
        const conn = await getConnection();
        const { target_id, parent_id, reaction } = await request.json() as any;

        if (!target_id || !reaction) {
            return json({ success: false, error: 'target_id, reaction 필요' }, { status: 400 });
        }

        if (!EMOJIS.includes(reaction)) {
            return json({ success: false, error: '유효하지 않은 리액션' }, { status: 400 });
        }

        const mbId = getMbId(user);

        // 이미 리액션했는지 확인
        const [existing] = await conn.query(
            'SELECT id FROM g5_da_reaction_choose WHERE member_id = ? AND target_id = ? AND reaction = ?',
            [mbId, target_id, reaction]
        ) as any;

        if (existing.length > 0) {
            // 이미 있으면 제거 (토글)
            await conn.query('DELETE FROM g5_da_reaction_choose WHERE id = ?', [existing[0].id]);
            await conn.query(
                'UPDATE g5_da_reaction SET reaction_count = GREATEST(reaction_count - 1, 0) WHERE target_id = ? AND reaction = ?',
                [target_id, reaction]
            );
            // 0이면 삭제
            await conn.query('DELETE FROM g5_da_reaction WHERE target_id = ? AND reaction = ? AND reaction_count <= 0', [target_id, reaction]);
        } else {
            // 새 리액션 추가
            await conn.query(
                'INSERT INTO g5_da_reaction_choose (member_id, target_id, parent_id, reaction) VALUES (?, ?, ?, ?)',
                [mbId, target_id, parent_id || '', reaction]
            );
            await conn.query(
                'INSERT INTO g5_da_reaction (target_id, parent_id, reaction, reaction_count) VALUES (?, ?, ?, 1) ON DUPLICATE KEY UPDATE reaction_count = reaction_count + 1',
                [target_id, parent_id || '', reaction]
            );
        }

        // 현재 상태 반환
        const [reactions] = await conn.query(
            'SELECT reaction, reaction_count FROM g5_da_reaction WHERE target_id = ? ORDER BY reaction_count DESC',
            [target_id]
        );

        conn.release();
        return json({ success: true, data: { reactions, toggled: existing.length > 0 ? 'removed' : 'added' } });
    } catch (error) {
        console.error('[Reaction] POST error:', error);
        return json({ success: false, error: '리액션 처리 실패' }, { status: 500 });
    }
};
