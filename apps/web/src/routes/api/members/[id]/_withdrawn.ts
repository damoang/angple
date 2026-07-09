import pool from '$lib/server/db';
import type { RowDataPacket } from 'mysql2';

interface LeaveRow extends RowDataPacket {
    mb_leave_date: string;
}

/**
 * mb_id 또는 mb_nick 로 조회해 탈퇴(mb_leave_date 세팅) 여부를 반환한다.
 * 탈퇴 회원의 프로필·활동·공감·팔로우 데이터는 로그인 회원에게도 비노출한다
 * (개인정보 분쟁조정 대응). 숙려중 회원 포함 — 숙려 취소 시 mb_leave_date 가
 * 해제되어 자동 복원된다.
 * 조회 실패 시 false(정상 노출) — 가용성 우선. profile 라우트는 자체 차단됨.
 */
export async function isWithdrawnMember(memberId: string): Promise<boolean> {
    try {
        const [rows] = await pool.query<LeaveRow[]>(
            'SELECT mb_leave_date FROM g5_member WHERE mb_id = ? OR mb_nick = ? LIMIT 1',
            [memberId, memberId]
        );
        return !!rows[0]?.mb_leave_date;
    } catch {
        return false;
    }
}
