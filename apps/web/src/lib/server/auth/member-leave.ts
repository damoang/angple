/**
 * 회원 탈퇴 처리
 * PHP member_leave.php 호환 — 소프트 삭제 (mb_leave_date 설정)
 */
import pool from '$lib/server/db.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';

function formatLeaveDate(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

function prependLeaveMemo(existingMemo: string, leaveDate: string): string {
    const leaveMemo = `${leaveDate} 탈퇴함`;
    return existingMemo ? `${leaveMemo}\n${existingMemo}` : leaveMemo;
}

/**
 * 회원 탈퇴 처리 (소프트 삭제)
 * 1. mb_leave_date = YYYYMMDD
 * 2. mb_memo 앞에 "YYYYMMDD 탈퇴함" 기록
 * 3. 본인인증 표식 초기화(mb_certify·mb_adult)
 * 4. 소셜 프로필 삭제
 *
 * ⚠️ mb_dupinfo(DI)는 삭제하지 않는다 — 부정 이용 방지(재가입 중복차단)를
 *    위한 단방향 식별값으로 영구 보존한다. (backend withdrawal_grace.go 의
 *    'DI 등 식별자 미삭제' 정책과 일치)
 */
export async function processMemberLeave(
    mbId: string
): Promise<{ success: boolean; error?: string }> {
    // 회원 존재 확인
    const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT mb_id, mb_leave_date, COALESCE(mb_memo, '') AS mb_memo FROM g5_member WHERE mb_id = ? AND mb_leave_date = '' LIMIT 1",
        [mbId]
    );

    const member = rows[0];
    if (!member) {
        return { success: false, error: '회원 정보를 찾을 수 없거나 이미 탈퇴한 회원입니다.' };
    }

    const leaveDate = formatLeaveDate();
    const nextMemo = prependLeaveMemo(member.mb_memo ?? '', leaveDate);

    // 소프트 삭제: 본인인증 표식만 초기화.
    // DI(mb_dupinfo)는 재가입 중복차단을 위해 의도적으로 보존한다(삭제 금지).
    await pool.query<ResultSetHeader>(
        `UPDATE g5_member
            SET mb_leave_date = ?,
                mb_memo = ?,
                mb_certify = '',
                mb_adult = 0
          WHERE mb_id = ?`,
        [leaveDate, nextMemo, mbId]
    );

    // 소셜 프로필 삭제
    await pool.query<ResultSetHeader>('DELETE FROM g5_member_social_profiles WHERE mb_id = ?', [
        mbId
    ]);

    return { success: true };
}

export { formatLeaveDate, prependLeaveMemo };
