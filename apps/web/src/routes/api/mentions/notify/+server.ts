/**
 * 멘션 알림 생성 API
 * POST /api/mentions/notify
 * 멘션된 회원에게 g5_na_noti 테이블에 직접 알림 INSERT
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';
import { getAuthUser } from '$lib/server/auth';

interface NotifyRequest {
    mentions: string[]; // 닉네임 배열
    boardId: string;
    postId: number;
    commentId?: number;
    content: string; // 원본 내용 (발췌용)
    senderNick: string; // 발신자 닉네임
    senderId: string; // 발신자 mb_id
    postTitle?: string; // 게시글 제목
}

/** HTML 태그를 반복 제거 (중첩 태그 우회 방지) */
function stripHtmlTags(str: string): string {
    let result = str;
    let prev;
    do {
        prev = result;
        result = result.replace(/<[^>]+>/g, '');
    } while (result !== prev);
    return result;
}

// 회원당 멘션 알림 호출 레이트리밋 — 파드 인메모리(분당 5회면 정상 사용은 충분).
// ⛔ 파드별 독립이라 완벽하지 않지만, 무인증이던 시절의 무한 주입을 막는 1차 방어선.
const MENTION_RATE_WINDOW_MS = 60_000;
const MENTION_RATE_MAX = 5;
const mentionCallLog = new Map<string, number[]>();

function mentionRateLimited(mbID: string): boolean {
    const now = Date.now();
    const calls = (mentionCallLog.get(mbID) ?? []).filter((t) => now - t < MENTION_RATE_WINDOW_MS);
    if (calls.length >= MENTION_RATE_MAX) {
        mentionCallLog.set(mbID, calls);
        return true;
    }
    calls.push(now);
    mentionCallLog.set(mbID, calls);
    if (mentionCallLog.size > 10_000) mentionCallLog.clear(); // 무한 성장 방지
    return false;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
    // ⛔ 인증 필수 + 발신자는 세션에서 — 본문의 senderId/senderNick 을 믿으면
    //    임의 회원 사칭으로 알림을 주입할 수 있다 (알림 딥다이브에서 발견된 구멍).
    const user = await getAuthUser(cookies);
    if (!user) {
        return json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }
    const senderId = user.mb_id;
    const senderNick = user.mb_nick || user.mb_name || user.mb_id;

    if (mentionRateLimited(senderId)) {
        return json(
            { error: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' },
            { status: 429 }
        );
    }

    const body: NotifyRequest = await request.json();
    const { mentions, boardId, postId, commentId, content, postTitle } = body;

    if (!mentions || mentions.length === 0) {
        return json({ sent: 0 });
    }

    if (!boardId || !postId) {
        return json({ error: 'boardId, postId 필수' }, { status: 400 });
    }

    // 닉네임 유효성 검사
    const validNicks = mentions
        .filter((nick) => nick && nick.length > 0 && nick.length <= 50)
        .slice(0, 20); // 최대 20명

    if (validNicks.length === 0) {
        return json({ sent: 0 });
    }

    try {
        // 닉네임으로 mb_id 조회
        const placeholders = validNicks.map(() => '?').join(',');
        const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT mb_id, mb_nick FROM g5_member WHERE mb_nick IN (${placeholders}) AND mb_leave_date = ''`,
            validNicks
        );

        if (rows.length === 0) {
            return json({ sent: 0 });
        }

        // 자기 자신 제외
        const receivers = rows.filter((row) => row.mb_id !== senderId);
        if (receivers.length === 0) {
            return json({ sent: 0 });
        }

        // 알림 설정 확인 (noti_mention = false인 유저 제외)
        const receiverIds = receivers.map((r) => r.mb_id);
        const prefPlaceholders = receiverIds.map(() => '?').join(',');
        const [prefRows] = await pool.execute<RowDataPacket[]>(
            `SELECT mb_id, noti_mention FROM g5_noti_preference WHERE mb_id IN (${prefPlaceholders})`,
            receiverIds
        );
        const prefMap = new Map<string, boolean>();
        for (const pref of prefRows) {
            prefMap.set(pref.mb_id, Boolean(pref.noti_mention));
        }

        // 중복 알림 방지: 동일 게시글+댓글+발신자+mention 조합 체크
        const wrId = commentId || postId;
        const [existingRows] = await pool.execute<RowDataPacket[]>(
            `SELECT mb_id FROM g5_na_noti WHERE bo_table = ? AND wr_id = ? AND rel_mb_id = ? AND ph_from_case = 'mention' AND mb_id IN (${prefPlaceholders})`,
            [boardId, wrId, senderId, ...receiverIds]
        );
        const alreadyNotified = new Set(existingRows.map((r: RowDataPacket) => r.mb_id));

        const url = commentId
            ? `/${boardId}/${postId}#comment-${commentId}`
            : `/${boardId}/${postId}`;
        const excerpt = stripHtmlTags(content).substring(0, 80);
        let sentCount = 0;

        for (const receiver of receivers) {
            // 알림 설정 체크 (설정 없으면 기본 활성)
            const mentionEnabled = prefMap.get(receiver.mb_id) ?? true;
            if (!mentionEnabled) continue;

            // 중복 체크
            if (alreadyNotified.has(receiver.mb_id)) continue;

            try {
                await pool.execute(
                    `INSERT INTO g5_na_noti (ph_to_case, ph_from_case, bo_table, wr_id, mb_id, rel_mb_id, rel_mb_nick, rel_msg, rel_url, ph_readed, ph_datetime, parent_subject, wr_parent)
					 VALUES ('mention', 'mention', ?, ?, ?, ?, ?, ?, ?, 'N', NOW(), ?, ?)`,
                    [
                        boardId,
                        wrId,
                        receiver.mb_id,
                        senderId,
                        senderNick,
                        excerpt,
                        url,
                        postTitle || '',
                        postId
                    ]
                );
                sentCount++;
            } catch (err) {
                console.error('멘션 알림 INSERT 실패 (%s):', receiver.mb_nick, err);
            }
        }

        return json({ sent: sentCount });
    } catch (error) {
        console.error('Mention notify API error:', error);
        return json({ error: '멘션 알림 전송 실패' }, { status: 500 });
    }
};
