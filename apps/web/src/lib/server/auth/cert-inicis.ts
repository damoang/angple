/**
 * KG이니시스 실명인증 설정 및 유틸리티
 * g5_config 테이블에서 cf_cert_* 설정값을 읽어옴
 */
import pool, { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import { createHash, randomBytes } from 'crypto';
import { env } from '$env/dynamic/private';
import { formatLeaveDate } from './member-leave.js';

/** SEED IV를 base64로 반환 (런타임에 env 읽기) */
export function getSeedIV(): string {
    const raw = env.CERT_INICIS_SEED_IV || '';
    return raw ? Buffer.from(raw).toString('base64') : '';
}

/**
 * dupinfo 생성용 키 (런타임에 env 읽기) — fail-closed.
 * ⛔ 빈 문자열 폴백 금지: 키가 없으면 buildDupinfo가 SHA256(ci+'')로 **다른 DI**를 만들어
 * 재가입 중복차단(checkDupinfo)이 통째로 무력화된다(같은 사람=다른 DI). 조용한 오염 대신 즉시 throw.
 * ⛔ 이 키는 절대 rotate 금지 — 바뀌면 기존 회원 전원의 DI가 달라진다. 주입=k8s secret `angple-secrets`.
 */
function getCertTokenKey(): string {
    const key = env.CERT_TOKEN_ENCRYPTION_KEY;
    if (!key) {
        throw new Error(
            'CERT_TOKEN_ENCRYPTION_KEY 미설정 — 실명인증(DI 생성) 차단(fail-closed). 빈 키로 DI를 만들면 재가입 중복차단이 무력화됩니다.'
        );
    }
    return key;
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

interface DupCollisionRow extends RowDataPacket {
    mb_id: string;
    mb_level: number;
    mb_intercept_date: string;
    mb_leave_date: string;
}

/**
 * DI(mb_dupinfo) 충돌 하드닝(구멍②).
 *
 * 동일 dupinfo 를 가진 다른 계정을 조회한다. mb_dupinfo = 본인확인(CI)의 단방향 해시라
 * 충돌 = 동일인. 매칭 계정이 **제재중(mb_intercept_date≠'') 또는 탈퇴(mb_leave_date≠'')**면
 * 징계회피/다중이 재가입 정황 → durable 운영 플래그를 재인증 시도 계정 mb_memo 에 기록하고
 * `blocked=true` 를 반환한다(호출부가 본인인증 거부·dupinfo 미저장에 사용).
 *
 * ⚠️ 밴/탈퇴 "유효" 판정은 코드베이스 관례와 일치 — 값이 비어있지 않으면 제재/탈퇴로 본다.
 *    (제재: api/members/search/+server.ts:49, admin/members/[mbId]/+page.svelte:187 /
 *     탈퇴: auth/oauth/member.ts:142 isMemberActive, auth/password-reset.ts:26)
 *    어디에서도 현재시각과 날짜비교를 하지 않고 '비어있지 않음'만으로 판정하므로 동일 기준 사용.
 *
 * ⚠️ 정상(활성) 계정 매칭은 여기서 추가 차단하지 않는다 — 차단은 호출부 checkDupinfo 가
 *    이미 1차 게이트로 담당하며(정상회원 회귀 방지), 이 함수는 감사 로그만 남긴다.
 *
 * 운영 플래그 기록처: mb_memo 앞줄 prepend (member-leave.ts 의 처리와 동일한 durable
 *    per-member 운영 메모, 관리자 회원관리 화면에 노출). 별도 audit/security 테이블은
 *    web 코드베이스에 없어(grep 0건) mb_memo 를 재사용한다.
 */
export async function flagDupinfoCollision(
    mbId: string,
    dupinfo: string
): Promise<{ matched: boolean; blocked: boolean }> {
    const [rows] = await readPool.query<DupCollisionRow[]>(
        `SELECT mb_id, mb_level,
                COALESCE(mb_intercept_date, '') AS mb_intercept_date,
                COALESCE(mb_leave_date, '')     AS mb_leave_date
           FROM g5_member
          WHERE mb_dupinfo = ? AND mb_id <> ?`,
        [dupinfo, mbId]
    );

    if (rows.length === 0) {
        return { matched: false, blocked: false };
    }

    // 코드베이스 관례: mb_intercept_date/mb_leave_date 가 비어있지 않으면 제재/탈퇴.
    const blockingRows = rows.filter(
        (r) => (r.mb_intercept_date ?? '') !== '' || (r.mb_leave_date ?? '') !== ''
    );

    if (blockingRows.length === 0) {
        // 정상(활성) 계정 매칭: 추가 차단 없이 감사 로그만.
        console.warn('[Cert][DI-guard] DI collision with active account(s) — logged only', {
            mbId,
            dupinfoPrefix: dupinfo.slice(0, 16),
            collisions: rows.map((r) => r.mb_id)
        });
        return { matched: true, blocked: false };
    }

    const flaggedAt = formatLeaveDate();
    const detail = blockingRows
        .map((r) => `${r.mb_id}(${(r.mb_leave_date ?? '') !== '' ? '탈퇴' : '제재'})`)
        .join(', ');
    const memo = `${flaggedAt} [DI충돌차단] 동일 본인확인정보 계정 ${detail} 존재 — 재인증 거부(다중이/징계회피 정황)`;

    // durable 운영 플래그: 재인증 시도 계정 mb_memo 앞줄에 기록(관리자 회원관리 화면 노출).
    // 실패해도 차단 판정 자체는 유지(로그만).
    try {
        await pool.query(
            `UPDATE g5_member
                SET mb_memo = CONCAT(?, IF(mb_memo IS NULL OR mb_memo = '', '', CONCAT('\n', mb_memo)))
              WHERE mb_id = ?`,
            [memo, mbId]
        );
    } catch (e) {
        console.error('[Cert][DI-guard] mb_memo flag write failed:', e);
    }

    console.warn('[Cert][DI-guard] blocked re-certification on DI collision', {
        mbId,
        dupinfoPrefix: dupinfo.slice(0, 16),
        collisions: blockingRows.map((r) => ({
            mb_id: r.mb_id,
            mb_level: r.mb_level,
            banned: (r.mb_intercept_date ?? '') !== '',
            withdrawn: (r.mb_leave_date ?? '') !== ''
        }))
    });

    return { matched: true, blocked: true };
}

/** 인증 결과를 DB에 저장 (g5_member 업데이트 + 인증 이력) */
export async function saveCertResult(
    mbId: string,
    dupinfo: string,
    birthDay: string
): Promise<void> {
    // DI 충돌 하드닝(구멍②) — 방어선(defense-in-depth).
    // 호출부(cert/inicis/result)는 이미 checkDupinfo 로 모든 dupinfo 충돌을 1차 차단하지만,
    // 그 게이트가 우회되더라도 제재/탈퇴 계정과 동일 DI 인 경우 dupinfo 를 절대 저장하지 않는다.
    // 정상 저장(충돌 없음/활성계정만)은 기존과 100% 동일하게 진행된다.
    const { blocked } = await flagDupinfoCollision(mbId, dupinfo);
    if (blocked) {
        throw new Error('DI_COLLISION_BLOCKED');
    }

    const adult_day = new Date();
    adult_day.setFullYear(adult_day.getFullYear() - 19);
    const adultDayStr = adult_day.toISOString().slice(0, 10).replace(/-/g, '');
    const adult = parseInt(birthDay) <= parseInt(adultDayStr) ? 1 : 0;

    await pool.query(
        `UPDATE g5_member SET mb_certify = 'simple', mb_dupinfo = ?, mb_adult = ? WHERE mb_id = ?`,
        [dupinfo, adult, mbId]
    );

    // 인증 이력 저장.
    // ⚠️ ch_ci 컬럼에는 원본 CI가 아니라 dupinfo(단방향 해시)를 저장한다 — 의도된 설계.
    //    checkDupinfo()도 이 값으로 중복을 조회하며, 이 이력은 탈퇴 시에도 삭제되지
    //    않아 사실상 DI 영구백업 역할을 한다(원본 CI는 어디에도 저장하지 않음).
    //    실제 CI로 바꾸지 말 것 — 중복차단(dedup)이 깨지고 DI 복구 경로가 사라진다.
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
