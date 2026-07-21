/**
 * 실명인증 페이지 서버 로직
 * 회원가입 완료 후 리다이렉트되어 옴
 */
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getCertConfig } from '$lib/server/auth/cert-inicis.js';
import { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

interface MemberCertRow extends RowDataPacket {
    mb_certify: string;
    mb_level: number;
    login_days: number;
}

/**
 * 앙님💛(등급 3) 승급에 필요한 로그인 일수.
 * `auto-promotion.ts` 의 DEFAULT_PROMOTION_RULES 와 같은 값이어야 한다.
 * (XP 조건도 있으나 실측상 아무도 XP 에서 막히지 않아 안내하지 않는다 —
 *  등급 2 정체 회원 673명 중 'XP만 미달' 0명.)
 */
const PROMOTE_LOGIN_DAYS = 7;

interface BoardSubjectRow extends RowDataPacket {
    bo_subject: string;
}

export const load: PageServerLoad = async ({ locals, url }) => {
    // 로그인 필수
    if (!locals.user) {
        redirect(303, '/login');
    }

    // 실명인증 설정 확인
    const certConfig = await getCertConfig();
    if (certConfig.certUse === 0) {
        // 실명인증 미사용 시 메인으로
        redirect(302, '/');
    }

    // 이미 인증 완료 여부 + 승급 진행 상황
    const [rows] = await readPool.query<MemberCertRow[]>(
        `SELECT mb_certify, COALESCE(mb_level, 0) AS mb_level,
                COALESCE(mb_login_days, 0) AS login_days
           FROM g5_member WHERE mb_id = ?`,
        [locals.user.id]
    );

    const mbCertify = rows[0]?.mb_certify || '';
    const isCertified = !!mbCertify;

    // 승급까지 남은 로그인 일수. 이미 등급 3 이상이면 안내하지 않는다.
    const mbLevel = rows[0]?.mb_level ?? 0;
    const loginDays = rows[0]?.login_days ?? 0;
    const promoteDaysLeft = mbLevel >= 3 ? null : Math.max(0, PROMOTE_LOGIN_DAYS - loginDays);

    // 글쓰기에서 막혀 넘어온 경우 게시판 이름을 함께 보여준다.
    // board 값은 URL 파라미터라 신뢰하지 않고 DB 에 실재하는 게시판일 때만 사용한다.
    let blockedBoardName: string | null = null;
    const fromWrite = url.searchParams.get('from') === 'write';
    const boardParam = (url.searchParams.get('board') || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (fromWrite && boardParam) {
        const [boardRows] = await readPool.query<BoardSubjectRow[]>(
            'SELECT bo_subject FROM g5_board WHERE bo_table = ?',
            [boardParam]
        );
        blockedBoardName = boardRows[0]?.bo_subject || null;
    }

    return {
        isCertified,
        certRequired: certConfig.certReq === 1,
        fromWrite,
        blockedBoardName,
        promoteDaysLeft
    };
};
