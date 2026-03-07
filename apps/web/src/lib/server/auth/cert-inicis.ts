/**
 * KG이니시스 실명인증 설정 및 유틸리티
 * g5_config 테이블에서 cf_cert_* 설정값을 읽어옴
 */
import pool, { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import { createHash } from 'crypto';
import { env } from '$env/dynamic/private';

const SEED_IV = 'SASHOSTSIRIAS000';
const CERT_TOKEN_KEY = env.CERT_TOKEN_ENCRYPTION_KEY || '';

interface CertConfigRow extends RowDataPacket {
    cf_cert_use: number;
    cf_cert_req: number;
    cf_cert_kg_mid: string;
    cf_cert_kg_cd: string;
}

export interface CertConfig {
    /** 인증 사용 여부 (0=미사용, 1=테스트, 2=운영) */
    certUse: number;
    /** 인증 필수 여부 (0=선택, 1=필수) */
    certReq: number;
    /** KG이니시스 상점 MID */
    kgMid: string;
    /** KG이니시스 상점 코드 */
    kgCd: string;
}

/** g5_config에서 실명인증 설정 조회 */
export async function getCertConfig(): Promise<CertConfig> {
    const [rows] = await readPool.query<CertConfigRow[]>(
        'SELECT cf_cert_use, cf_cert_req, cf_cert_kg_mid, cf_cert_kg_cd FROM g5_config LIMIT 1'
    );

    if (rows[0]) {
        return {
            certUse: Number(rows[0].cf_cert_use) || 0,
            certReq: Number(rows[0].cf_cert_req) || 0,
            kgMid: String(rows[0].cf_cert_kg_mid || ''),
            kgCd: String(rows[0].cf_cert_kg_cd || '')
        };
    }

    return { certUse: 0, certReq: 0, kgMid: '', kgCd: '' };
}

/** 인증 요청에 필요한 MID, apiKey, authHash 등 생성 */
export async function buildCertRequest(): Promise<{
    mid: string;
    apiKey: string;
    mTxId: string;
    authHash: string;
    reqSvcCd: string;
    reservedMsg: string;
}> {
    const config = await getCertConfig();

    // 최대 cr_id 조회
    const [crRows] = await readPool.query<RowDataPacket[]>(
        'SELECT MAX(cr_id) as max_cr_id FROM g5_cert_history LIMIT 1'
    );
    const maxCrId = crRows[0]?.max_cr_id || 0;

    let mid: string;
    let apiKey: string;

    if (config.certUse === 2) {
        // 운영
        mid = 'SRA' + config.kgMid;
        apiKey = config.kgCd;
    } else {
        // 테스트
        mid = env.CERT_INICIS_TEST_MID || 'SRAiasTest';
        apiKey = env.CERT_INICIS_TEST_API_KEY || '';
    }

    const mTxId = ('SIR_' + maxCrId + '_' + Date.now()).substring(0, 16);
    const reqSvcCd = '01'; // 간편인증
    const authHash = createHash('sha256')
        .update(mid + mTxId + apiKey)
        .digest('hex');
    const reservedMsg = 'isUseToken=Y'; // SEED 암호화 응답 요청

    return { mid, apiKey, mTxId, authHash, reqSvcCd, reservedMsg };
}

/** CI 기반 mb_dupinfo 생성 (PHP 호환) */
export function buildDupinfo(ci: string): string {
    return createHash('sha256')
        .update(ci + CERT_TOKEN_KEY)
        .digest('hex');
}

/** 이니시스 결과 URL 검증 */
export function isValidInicisUrl(url: string): boolean {
    return url.startsWith('https://kssa.inicis.com') || url.startsWith('https://fcsa.inicis.com');
}

/** 인증 결과를 DB에 저장 (g5_member 업데이트 + 인증 이력) */
export async function saveCertResult(
    mbId: string,
    dupinfo: string,
    birthDay: string
): Promise<void> {
    const adult_day = new Date();
    adult_day.setFullYear(adult_day.getFullYear() - 19);
    const adultDayStr = adult_day.toISOString().slice(0, 10).replace(/-/g, '');
    const adult = parseInt(birthDay) <= parseInt(adultDayStr) ? 1 : 0;

    await pool.query(
        `UPDATE g5_member SET mb_certify = 'simple', mb_dupinfo = ?, mb_adult = ? WHERE mb_id = ?`,
        [dupinfo, adult, mbId]
    );

    // 인증 이력 저장
    await pool.query(
        `INSERT INTO g5_member_cert_history (mb_id, ch_type, ch_ci, ch_datetime) VALUES (?, 'simple', ?, NOW())`,
        [mbId, dupinfo]
    );
}

/** 이미 인증된 dupinfo가 존재하는지 체크 */
export async function checkDupinfo(mbId: string, dupinfo: string): Promise<string | null> {
    const [rows] = await readPool.query<RowDataPacket[]>(
        'SELECT mb_id FROM g5_member WHERE mb_id <> ? AND mb_dupinfo = ?',
        [mbId, dupinfo]
    );
    if (rows[0]) {
        return rows[0].mb_id as string;
    }

    // history 테이블에서도 체크
    const [histRows] = await readPool.query<RowDataPacket[]>(
        'SELECT count(*) as cnt FROM g5_member_cert_history WHERE mb_id <> ? AND ch_ci = ?',
        [mbId, dupinfo]
    );
    if (histRows[0]?.cnt > 0) {
        return '(탈퇴 또는 기존 계정)';
    }

    return null;
}

export { SEED_IV };
