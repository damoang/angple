/**
 * KG이니시스 실명인증 설정 및 유틸리티
 * g5_config 테이블에서 cf_cert_* 설정값을 읽어옴
 */
import pool, { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import { createHash, randomBytes } from 'crypto';
import { env } from '$env/dynamic/private';

/** SEED IV를 base64로 반환 (런타임에 env 읽기) */
export function getSeedIV(): string {
    const raw = env.CERT_INICIS_SEED_IV || '';
    return raw ? Buffer.from(raw).toString('base64') : '';
}

/** dupinfo 생성용 키 (런타임에 env 읽기) */
function getCertTokenKey(): string {
    return env.CERT_TOKEN_ENCRYPTION_KEY || '';
}

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

    let mid: string;
    let apiKey: string;

    if (config.certUse === 2) {
        // 운영
        mid = 'SRA' + config.kgMid;
        apiKey = config.kgCd;
    } else {
        // 테스트
        mid = env.CERT_INICIS_TEST_MID || '';
        apiKey = env.CERT_INICIS_TEST_API_KEY || '';
    }

    const mTxId = ('SIR' + Date.now().toString(36) + randomBytes(3).toString('hex')).substring(
        0,
        20
    );
    const reqSvcCd = '01'; // 간편인증
    const authHash = createHash('sha256')
        .update(mid + mTxId + apiKey)
        .digest('hex');
    const reservedMsg = 'isUseToken=Y'; // SEED 암호화 응답 요청

    return { mid, apiKey, mTxId, authHash, reqSvcCd, reservedMsg };
}

/** 인증 요청 시 mTxId → mbId 매핑 저장 (DB 기반, 5분 TTL) */
export async function storeCertPending(mTxId: string, mbId: string): Promise<void> {
    await pool.query(
        `INSERT INTO g5_cert_pending (cp_mtxid, cp_mb_id, cp_datetime) VALUES (?, ?, NOW())
		 ON DUPLICATE KEY UPDATE cp_mb_id = ?, cp_datetime = NOW()`,
        [mTxId, mbId, mbId]
    );
    // 만료된 항목 정리 (5분 이상)
    await pool.query(
        `DELETE FROM g5_cert_pending WHERE cp_datetime < DATE_SUB(NOW(), INTERVAL 5 MINUTE)`
    );
}

/** 인증 콜백에서 mTxId로 mbId 조회 (1회용) */
export async function getCertPendingMbId(mTxId: string): Promise<string | null> {
    const [rows] = await readPool.query<RowDataPacket[]>(
        `SELECT cp_mb_id FROM g5_cert_pending WHERE cp_mtxid = ? AND cp_datetime > DATE_SUB(NOW(), INTERVAL 5 MINUTE)`,
        [mTxId]
    );
    if (!rows[0]) return null;
    // 1회용 삭제
    await pool.query('DELETE FROM g5_cert_pending WHERE cp_mtxid = ?', [mTxId]);
    return rows[0].cp_mb_id as string;
}

/** CI 기반 mb_dupinfo 생성 (PHP 호환) */
export function buildDupinfo(ci: string): string {
    return createHash('sha256')
        .update(ci + getCertTokenKey())
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
