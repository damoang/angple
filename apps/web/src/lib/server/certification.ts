/**
 * 실명인증(본인확인) 체크 유틸리티
 *
 * 그누보드 호환: g5_board.bo_use_cert = 'cert'인 게시판에서
 * 미인증 회원의 글쓰기/댓글/좋아요/리액션 차단
 *
 * 예외 게시판: verification, promotion, overseas
 */
import { readPool } from '$lib/server/db';
import type { RowDataPacket } from 'mysql2';

/** 실명인증 체크가 면제되는 게시판 */
const EXEMPT_BOARDS = new Set(['verification', 'promotion', 'overseas']);

interface BoardCertRow extends RowDataPacket {
    bo_use_cert: string;
}

interface MemberCertRow extends RowDataPacket {
    mb_certify: string;
    mb_level: number;
}

/**
 * 해당 게시판에서 실명인증이 필요한지 체크
 * @returns null이면 통과, 문자열이면 에러 메시지
 */
export async function checkCertification(
    boardId: string,
    mbId: string | undefined
): Promise<string | null> {
    // 예외 게시판은 무조건 통과
    if (EXEMPT_BOARDS.has(boardId)) {
        return null;
    }

    // 게시판의 bo_use_cert 확인
    const [boardRows] = await readPool.query<BoardCertRow[]>(
        'SELECT bo_use_cert FROM g5_board WHERE bo_table = ?',
        [boardId]
    );

    const boUseCert = boardRows[0]?.bo_use_cert;
    if (!boUseCert) {
        // bo_use_cert가 비어있으면 실명인증 불필요
        return null;
    }

    // 비로그인 사용자 차단
    if (!mbId) {
        return '이 게시판은 본인확인 하신 회원님만 이용 가능합니다. 로그인 후 이용해 주세요.';
    }

    // 회원 인증 상태 확인
    const [memberRows] = await readPool.query<MemberCertRow[]>(
        'SELECT mb_certify, mb_level FROM g5_member WHERE mb_id = ?',
        [mbId]
    );

    const member = memberRows[0];
    if (!member) {
        return '회원 정보를 찾을 수 없습니다.';
    }

    // 관리자(레벨 10 이상)는 바이패스
    if (member.mb_level >= 10) {
        return null;
    }

    // bo_use_cert = 'cert': 실명인증 필수
    if (boUseCert === 'cert' && !member.mb_certify) {
        return '이 게시판은 본인확인 하신 회원님만 이용 가능합니다. 회원정보 수정에서 본인확인을 해주시기 바랍니다.';
    }

    return null;
}
