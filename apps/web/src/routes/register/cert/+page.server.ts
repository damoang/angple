/**
 * 가입 후 실명인증 페이지 (선택)
 * 소셜 가입 완료 직후 리다이렉트됨
 */
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { getCertConfig } from '$lib/server/auth/cert-inicis.js';
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

export const load: PageServerLoad = async ({ locals, cookies }) => {
    if (!locals.user) {
        redirect(303, '/login');
    }

    const certConfig = await getCertConfig();

    // 인증 비활성화면 홈으로
    if (!certConfig.certUse) {
        redirect(302, '/');
    }

    // 이미 인증 완료 여부 확인
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT mb_certify FROM g5_member WHERE mb_id = ? LIMIT 1',
        [locals.user.id]
    );
    const alreadyCertified = !!rows[0]?.mb_certify;

    // 인증 완료 데이터가 쿠키에 있는지 확인 (방금 인증한 경우)
    let certData = null;
    const pendingCert = cookies.get('pending_cert_data');
    if (pendingCert) {
        try {
            certData = JSON.parse(pendingCert);
            cookies.delete('pending_cert_data', { path: '/' });
        } catch {
            // 잘못된 데이터 무시
        }
    }

    return {
        certEnabled: true,
        certRequired: certConfig.certReq === 1,
        alreadyCertified,
        certData
    };
};
