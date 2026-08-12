/**
 * 회원의 인증 산출물(세션·리프레시 토큰) 전량 파기.
 *
 * ⛔ **실서비스 탈퇴 경로는 이걸 쓰지 않는다.** 파기의 단일 소유자는 백엔드
 *    purgeAuthArtifacts (backend/internal/handler/auth_artifacts.go) 다.
 *    실제 탈퇴는 routes/member/leave/+page.server.ts → 백엔드
 *    POST /api/v1/members/me/leave 로 흐르고, 거기서 DB 파기 + Redis 캐시
 *    무효화가 전부 끝난다(canary 네임스페이스 포함).
 *    web 에서 또 불러도 소득이 거의 없다 — 백엔드가 먼저 행을 지우고 오므로
 *    세션 조회가 0행이 되어 **sess: 키는 하나도 못 지운다**. 회원 캐시만
 *    처리한 파드 1대 기준으로 중복 삭제될 뿐이라, 파기 주체를 둘로 나눠
 *    추적을 어렵게 만들 값어치가 없다.
 *
 * ⛔ 그런데 왜 남겨두는가 — 유일한 호출처가 member-leave.ts 의
 *    processMemberLeave() 이기 때문이다. 그 함수는 **백엔드를 거치지 않고
 *    web DB 에 직접 mb_leave_date 를 쓰는 유일한 경로**다(PHP 호환, 현재 dead).
 *    되살아나면 백엔드 파기가 절대 붙지 않으므로, 그때를 대비해 짝을 지어 둔다.
 *    → 지우지 말 것. 지우려면 processMemberLeave() 를 먼저 없애야 한다.
 *
 * 왜 필요한가 — 분쟁조정위 26R05-00197 로 드러난 문제:
 *   탈퇴 처리가 기존 세션을 무효화하지 않아, **탈퇴 전에 발급된 세션 쿠키로
 *   인증 상태가 유지**됐다. 2026-04-02 신청인 계정에서 포인트·XP·mb_today_login
 *   이 갱신된 것이 그 결과다(신규 로그인이 아니라 잔존 세션에 의한 접근).
 *   인증 자체는 hooks.server.ts 의 탈퇴자 세션 차단으로 이미 막혔으나,
 *   그것은 **다시 접속했을 때** 동작하는 사후 방어다. 여기서는 탈퇴 시점에
 *   **선제적으로** 지운다.
 *
 * ⛔ revoke 가 아니라 DELETE 다.
 *    angple_sessions·angple_refresh_tokens 는 **IP·User-Agent 를 보유**해
 *    사실상 접속기록이다. token-store 의 revokeAllUserTokens 는
 *    `UPDATE ... SET revoked_at = NOW()` 라 **행이 남아 IP 가 보존된다**.
 *    탈퇴 파기에는 쓰지 말 것.
 */
import type { ResultSetHeader } from 'mysql2';
import pool from '$lib/server/db.js';
import { destroyAllUserSessions } from '$lib/server/auth/session-store.js';
import { invalidateMemberCache } from '$lib/server/auth/oauth/member.js';

export interface PurgeResult {
    sessions: number;
    tokens: number;
}

/**
 * 인증 산출물 파기. 세션 → 토큰 순으로 지운다.
 *
 * ⛔ **실패해도 예외를 던지지 않는다.** 탈퇴 자체를 막으면 안 되기 때문이다 —
 *    회원은 이미 탈퇴를 신청했고, 파기 실패로 탈퇴가 롤백되면 더 곤란해진다.
 *    남은 행은 hooks.server.ts 의 탈퇴자 세션 차단이 2차 방어로 처리한다.
 *    실패 사실은 로그로만 남긴다.
 */
export async function purgeAuthArtifacts(mbId: string): Promise<PurgeResult> {
    const result: PurgeResult = { sessions: 0, tokens: 0 };
    if (!mbId) return result;

    try {
        // DELETE + 세션 캐시(L1·L2) 키 삭제를 함께 수행한다.
        // ⛔ 캐시를 비우지 않으면 지운 세션이 L2(Redis, TTL 300초)에서 되살아나
        //    그동안 인증이 유지된다 — 이 사안의 재현 경로 그 자체다.
        result.sessions = await destroyAllUserSessions(mbId);
    } catch (e) {
        console.error('[purgeAuthArtifacts] 세션 파기 실패', mbId, e);
    }

    try {
        // ⛔ 회원 캐시도 반드시 비운다.
        //    hooks 의 2차 방어는 getMemberById() 로 mb_leave_date 를 보는데,
        //    이 값이 캐시(L2 TTL 300초)에서 **탈퇴 전 상태**로 나오면 탈퇴자가 통과한다.
        await invalidateMemberCache(mbId);
    } catch (e) {
        console.error('[purgeAuthArtifacts] 회원 캐시 무효화 실패', mbId, e);
    }

    try {
        const [r] = await pool.query<ResultSetHeader>(
            'DELETE FROM angple_refresh_tokens WHERE mb_id = ?',
            [mbId]
        );
        result.tokens = r.affectedRows;
    } catch (e) {
        console.error('[purgeAuthArtifacts] 토큰 파기 실패', mbId, e);
    }

    return result;
}
