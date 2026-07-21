/**
 * 내 온보딩/재활성 게이트 상태 — GET /api/me/onboarding-status
 *
 * 성장 카드(실험 A 온보딩 · R1 웰컴백)가 노출 여부를 판정하는 **단일 권위 소스**.
 *
 * 왜 신설했나: 두 카드가 쓰던 `apiClient.getMemberProfile()` 은 백엔드에 라우트가 없는
 * 죽은 메서드였다(`/api/v1/members/{id}` 가 존재하지 않는 경로와 똑같이 `{"data":null}` 반환).
 * 클라이언트가 `null` 을 역참조하며 던진 예외를 컴포넌트 catch 가 삼켜, 실험 A 카드는
 * 라이브 이후 노출된 적이 없다. 게이트는 동작이 검증된 경로 하나로 모은다.
 *
 * 응답:
 *   signup_at            가입 시각 (ISO)
 *   last_contribution_at 마지막 글/댓글 시각 (ISO) — 기여 이력이 없으면 null
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

interface MemberRow extends RowDataPacket {
    mb_datetime: Date | string | null;
}

interface ActivityRow extends RowDataPacket {
    source_created_at: Date | string | null;
}

function toIso(value: Date | string | null): string | null {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
    // mysql2 가 문자열로 주는 경우 — DB 저장값은 KST 이므로 타임존을 명시해야
    // 서버 로컬 타임존에 따라 9시간 어긋나지 않는다.
    const m = String(value)
        .trim()
        .match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (!m) return null;
    const t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+09:00`);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
}

export const GET: RequestHandler = async ({ locals, setHeaders }) => {
    const userId = locals.user?.id;
    if (!userId) {
        return json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    try {
        const [memberRows] = await pool.query<MemberRow[]>(
            'SELECT mb_datetime FROM g5_member WHERE mb_id = ? LIMIT 1',
            [userId]
        );
        if (!memberRows[0]) {
            return json({ error: '회원을 찾을 수 없습니다.' }, { status: 404 });
        }

        // (member_id, is_public, is_deleted, source_created_at) 인덱스를 그대로 타는 형태.
        // EXPLAIN: ref const,const,const + Using index (커버링) — 헤비 유저도 즉시 응답.
        const [activityRows] = await pool.query<ActivityRow[]>(
            `SELECT source_created_at FROM member_activity_feed
              WHERE member_id = ? AND is_public = 1 AND is_deleted = 0
              ORDER BY source_created_at DESC LIMIT 1`,
            [userId]
        );

        // 개인화 응답이라 공유 캐시 금지. hooks.server.ts 가 no-store 는 보존하고
        // 그 외는 `private, max-age=2` 로 덮으므로, 의도를 남기려면 no-store 로 명시해야 한다.
        // 호출량 억제는 서버 캐시가 아니라 클라이언트의 settled 마커가 담당한다.
        setHeaders({ 'cache-control': 'no-store' });

        return json({
            signup_at: toIso(memberRows[0].mb_datetime),
            last_contribution_at: activityRows[0] ? toIso(activityRows[0].source_created_at) : null
        });
    } catch (err) {
        console.error('[onboarding-status]', err);
        return json({ error: '상태를 확인할 수 없습니다.' }, { status: 500 });
    }
};
