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
}

export const load: PageServerLoad = async ({ locals }) => {
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

    // 이미 인증 완료 여부 확인
    const [rows] = await readPool.query<MemberCertRow[]>(
        'SELECT mb_certify FROM g5_member WHERE mb_id = ?',
        [locals.user.id]
    );

    const mbCertify = rows[0]?.mb_certify || '';
    const isCertified = !!mbCertify;

    return {
        isCertified,
        certRequired: certConfig.certReq === 1
    };
};
