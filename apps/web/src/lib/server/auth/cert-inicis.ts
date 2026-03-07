/**
 * KG이니시스 실명인증 (간편인증) 서버 로직
 * PHP plugin/inicert/ 구현을 SvelteKit으로 포팅
 */
import { createHash } from 'crypto';
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import { KISA_SEED_CBC } from 'kisa-seed';

// KG이니시스 인증 URL
const SA_AUTH_URL = 'https://sa.inicis.com/auth';
const SEED_IV = 'SASHOSTSIRIAS000';

// G5_TOKEN_ENCRYPTION_KEY (dbconfig.php에서 정의된 값)
const TOKEN_ENCRYPTION_KEY = process.env.CERT_TOKEN_ENCRYPTION_KEY || '';

// 테스트 모드 설정
const TEST_MID = process.env.CERT_INICIS_TEST_MID || '';
const TEST_API_KEY = process.env.CERT_INICIS_TEST_API_KEY || '';

export interface CertConfig {
    certUse: number; // 0=disabled, 1=test, 2=production
    certReq: number; // 0=optional, 1=required
    certKgMid: string;
    certKgCd: string;
    certSimple: string;
    certUseSeed: number; // SEED 암호화 사용 여부
}

/**
 * g5_config에서 실명인증 설정 조회
 */
export async function getCertConfig(): Promise<CertConfig> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT cf_cert_use, cf_cert_req, cf_cert_kg_mid, cf_cert_kg_cd, cf_cert_simple, cf_cert_use_seed FROM g5_config LIMIT 1'
    );
    const row = rows[0] || {};
    return {
        certUse: parseInt(row.cf_cert_use || '0', 10),
        certReq: parseInt(row.cf_cert_req || '0', 10),
        certKgMid: row.cf_cert_kg_mid || '',
        certKgCd: row.cf_cert_kg_cd || '',
        certSimple: row.cf_cert_simple || '',
        certUseSeed: parseInt(row.cf_cert_use_seed || '0', 10)
    };
}

export interface CertRequestParams {
    mid: string;
    mTxId: string;
    authHash: string;
    reqSvcCd: string;
    flgFixedUser: string;
    reservedMsg: string;
    successUrl: string;
    failUrl: string;
    actionUrl: string;
}

/**
 * KG이니시스 인증 요청 파라미터 생성
 * PHP ini_request.php 로직과 동일
 */
export async function generateRequestParams(callbackUrl: string): Promise<CertRequestParams> {
    const config = await getCertConfig();

    // g5_cert_history에서 max cr_id 조회 (트랜잭션 ID 생성용)
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT COALESCE(MAX(cr_id), 0) as max_id FROM g5_cert_history'
    );
    const maxId = rows[0]?.max_id || 0;

    // 모드에 따른 mid, apiKey 결정
    let mid: string, apiKey: string;
    if (config.certUse === 2) {
        // 운영 모드
        mid = 'SRA' + config.certKgMid;
        apiKey = config.certKgCd;
    } else {
        // 테스트 모드
        mid = TEST_MID;
        apiKey = TEST_API_KEY;
    }

    // 트랜잭션 ID 생성: SIR_ + (maxId_timestamp)[:16]
    const rawTxId = `${maxId}_${Math.round(Date.now())}`;
    const mTxId = `SIR_${rawTxId.substring(0, 16)}`;

    // 인증 해시: SHA256(mid + mTxId + apiKey)
    const authHash = createHash('sha256')
        .update(String(mid) + String(mTxId) + String(apiKey))
        .digest('hex');

    // SEED 암호화 사용 여부 (테스트 MID에서는 SEED 암호화가 정상 동작하지 않으므로 비활성화)
    const isTestMode = config.certUse === 1;
    const reservedMsg = config.certUseSeed && !isTestMode ? 'isUseToken=Y' : '';

    return {
        mid,
        mTxId,
        authHash,
        reqSvcCd: '01', // 간편인증
        flgFixedUser: 'N',
        reservedMsg,
        successUrl: callbackUrl,
        failUrl: callbackUrl,
        actionUrl: SA_AUTH_URL
    };
}

/**
 * SEED CBC 복호화 (PHP decrypt_SEED 호환)
 * ciphertext: base64 인코딩된 암호문
 * seedKey: base64 인코딩된 키 (KG이니시스에서 전달받은 token)
 */
function decryptSeed(ciphertext: string, seedKey: string): string {
    try {
        const keyBytes = new Uint8Array(Buffer.from(seedKey, 'base64'));
        const ivBytes = new Uint8Array(Buffer.from(SEED_IV, 'ascii'));
        const encBytes = new Uint8Array(Buffer.from(ciphertext, 'base64'));

        if (encBytes.length === 0) return ciphertext;

        // kisa-seed 라이브러리의 SEED_CBC_Decrypt는 PKCS5 패딩을 자동 제거하는데,
        // 1블록(16바이트) 데이터에서 패딩 길이가 블록 크기와 같아지면 0바이트를 반환하는 버그가 있음.
        // PHP의 KISA_SEED_CBC는 패딩을 제거하지 않으므로 이 문제가 없음.
        //
        // 해결: 더미 블록을 추가해서 실제 데이터 블록이 "마지막 블록"이 되지 않도록 함.
        // 더미 블록은 PKCS5 패딩 전체(16바이트의 0x10)를 암호화한 것.
        // 이렇게 하면 라이브러리가 더미 블록에서만 패딩을 제거하고, 실제 데이터는 그대로 반환.

        // 먼저 일반 복호화 시도
        let decBytes = KISA_SEED_CBC.SEED_CBC_Decrypt(
            keyBytes,
            ivBytes,
            encBytes,
            0,
            encBytes.length
        );

        if (decBytes && decBytes.length > 0) {
            return Buffer.from(decBytes).toString('utf-8');
        }

        // 0바이트인 경우: 더미 패딩 블록 추가 방식으로 재시도
        // 마지막 암호문 블록을 IV로 사용해서 PKCS5 full padding (16 bytes of 0x10)을 암호화
        const lastCipherBlock = new Uint8Array(encBytes.slice(-16));
        const paddingBlock = new Uint8Array(16).fill(16); // PKCS5: 전체가 패딩
        const encPadding = KISA_SEED_CBC.SEED_CBC_Encrypt(
            keyBytes,
            lastCipherBlock,
            paddingBlock,
            0,
            paddingBlock.length
        );

        if (!encPadding || encPadding.length === 0) return ciphertext;

        // 원본 + 암호화된 패딩 블록 결합 (패딩 블록이 32바이트로 나올 수 있음 — 첫 16바이트만 사용)
        const extended = new Uint8Array([
            ...encBytes,
            ...Array.from(encPadding as Uint8Array).slice(0, 16)
        ]);
        decBytes = KISA_SEED_CBC.SEED_CBC_Decrypt(keyBytes, ivBytes, extended, 0, extended.length);

        if (!decBytes || decBytes.length === 0) return ciphertext;

        // 원본 데이터 길이만큼만 추출 (더미 블록 데이터 제거)
        // 원본 암호문 크기 = 실제 평문 + PKCS5 패딩이므로 평문은 encBytes.length 이하
        const result = Buffer.from(decBytes).toString('utf-8');

        // null 바이트 및 패딩 바이트 제거
        return result.replace(/[\x01-\x10]+$/, '');
    } catch (err) {
        console.error('[cert-inicis] SEED decrypt failed:', err);
        return ciphertext;
    }
}

/**
 * 성인 여부 판별 (19세 이상)
 * PHP: date("Ymd", strtotime("-19 years")) 비교
 */
function isAdult(birthday: string): boolean {
    if (!birthday || birthday.length !== 8) return false;
    const now = new Date();
    const adultYear = now.getFullYear() - 19;
    const adultMonth = String(now.getMonth() + 1).padStart(2, '0');
    const adultDay = String(now.getDate()).padStart(2, '0');
    const adultDate = parseInt(`${adultYear}${adultMonth}${adultDay}`, 10);
    return parseInt(birthday, 10) <= adultDate;
}

/**
 * KG이니시스 authRequestUrl 검증
 * PHP: strpos 검증과 동일
 */
function isValidAuthUrl(url: string): boolean {
    return url.startsWith('https://kssa.inicis.com') || url.startsWith('https://fcsa.inicis.com');
}

/**
 * CI 중복 체크
 * PHP ini_result.php의 중복 체크와 동일
 */
async function checkDuplicateCI(dupinfo: string, excludeMbId?: string): Promise<string | null> {
    const excludeId = excludeMbId || '';

    // g5_member에서 중복 체크
    const [memberRows] = await pool.query<RowDataPacket[]>(
        'SELECT mb_id FROM g5_member WHERE mb_id <> ? AND mb_dupinfo = ? LIMIT 1',
        [excludeId, dupinfo]
    );
    if (memberRows.length > 0) {
        return memberRows[0].mb_id;
    }

    // g5_member_cert_history에서도 체크
    const [historyRows] = await pool.query<RowDataPacket[]>(
        'SELECT count(*) as cnt FROM g5_member_cert_history WHERE mb_id <> ? AND ch_ci = ?',
        [excludeId, dupinfo]
    );
    if (historyRows[0]?.cnt > 0) {
        return '(탈퇴 또는 기존 회원)';
    }

    return null;
}

/**
 * 인증 내역 기록
 * PHP: insert_cert_history()
 */
async function insertCertHistory(mbId: string, company: string, method: string, ip: string) {
    try {
        await pool.execute(
            `INSERT INTO g5_cert_history (mb_id, cr_company, cr_method, cr_ip, cr_date, cr_time)
			 VALUES (?, ?, ?, ?, CURDATE(), CURTIME())`,
            [mbId, company, method, ip]
        );
    } catch (err) {
        console.error('[cert-inicis] cert history insert failed:', err);
    }
}

/**
 * 회원 인증 내역 기록
 * PHP: insert_member_cert_history()
 */
async function insertMemberCertHistory(
    mbId: string,
    name: string,
    phone: string,
    birth: string,
    certType: string,
    ci: string
) {
    try {
        await pool.execute(
            `INSERT INTO g5_member_cert_history (mb_id, ch_name, ch_hp, ch_birth, ch_type, ch_ci, ch_datetime)
			 VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [mbId, name, phone, birth, certType, ci]
        );
    } catch (err) {
        console.error('[cert-inicis] member cert history insert failed:', err);
    }
}

export interface CertCallbackResult {
    success: boolean;
    certType: string;
    certNo: string; // SHA1(txId)
    certHash: string; // SHA1(certType + birthday + dupinfo + certNo)
    dupinfo: string; // SHA256(CI + TOKEN_KEY)
    name: string;
    phone: string;
    birthday: string;
    adult: boolean;
    error?: string;
}

/**
 * KG이니시스 콜백 결과 처리
 * PHP ini_result.php 로직과 동일
 */
export async function processCallback(
    postData: {
        txId: string;
        resultCode: string;
        resultMsg?: string;
        authRequestUrl: string;
        token?: string;
    },
    clientIp: string,
    currentMbId?: string
): Promise<CertCallbackResult> {
    const emptyResult: CertCallbackResult = {
        success: false,
        certType: '',
        certNo: '',
        certHash: '',
        dupinfo: '',
        name: '',
        phone: '',
        birthday: '',
        adult: false
    };

    // resultCode 확인
    if (postData.resultCode !== '0000') {
        return {
            ...emptyResult,
            error: `코드: ${postData.resultCode} ${postData.resultMsg || '인증에 실패했습니다.'}`
        };
    }

    // authRequestUrl 검증
    if (!isValidAuthUrl(postData.authRequestUrl)) {
        return { ...emptyResult, error: '잘못된 요청입니다.' };
    }

    // mid 추출 (txId에서)
    // PHP: $mid = substr($txId, 6, 10);
    const midData = postData.txId.substring(6, 16);

    // KG이니시스 API에 CURL 요청
    const curlBody = JSON.stringify({ mid: midData, txId: postData.txId });
    let resData: Record<string, string>;
    try {
        const response = await fetch(postData.authRequestUrl, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
            },
            body: curlBody,
            signal: AbortSignal.timeout(10_000)
        });
        resData = await response.json();
        console.log('[cert-inicis] API response keys:', Object.keys(resData));
        console.log('[cert-inicis] API response token:', resData.token || 'NOT_IN_RESPONSE');
    } catch (err) {
        console.error('[cert-inicis] API request failed:', err);
        return { ...emptyResult, error: '인증 결과 조회에 실패했습니다.' };
    }

    if (resData.resultCode !== '0000') {
        return {
            ...emptyResult,
            error: `코드: ${resData.resultCode} ${decodeURIComponent(resData.resultMsg || '')}`
        };
    }

    // 인증 결과 추출
    const certType = 'simple';
    const certNo = resData.txId || postData.txId;
    let userCi = resData.userCi || '';
    let userPhone = resData.userPhone || '';
    let userName = resData.userName || '';
    let userBirthday = resData.userBirthday || '';

    // SEED 복호화 (token이 있고 SEED 암호화가 활성화된 경우)
    const certConfig = await getCertConfig();
    const seedEnabled = certConfig.certUseSeed && certConfig.certUse !== 1; // 테스트 모드 제외
    if (postData.token && seedEnabled) {
        userCi = decryptSeed(userCi, postData.token);
        userPhone = decryptSeed(userPhone, postData.token);
        userName = decryptSeed(userName, postData.token);
        userBirthday = decryptSeed(userBirthday, postData.token);
    }

    // 인증 내역 기록
    await insertCertHistory(currentMbId || '', 'inicis', certType, clientIp);

    if (!userPhone) {
        return {
            ...emptyResult,
            error: '정상적인 인증이 아닙니다. 올바른 방법으로 이용해 주세요.'
        };
    }

    // mb_dupinfo 생성: SHA256(CI + G5_TOKEN_ENCRYPTION_KEY)
    const dupinfo = createHash('sha256')
        .update(userCi + TOKEN_ENCRYPTION_KEY)
        .digest('hex');

    console.log('[cert-inicis] CI:', userCi);
    console.log('[cert-inicis] dupinfo:', dupinfo);
    console.log('[cert-inicis] name:', userName, 'phone:', userPhone);

    // 전화번호 하이픈 추가
    const formattedPhone = formatPhone(userPhone);

    // CI 중복 체크
    const duplicateMbId = await checkDuplicateCI(dupinfo, currentMbId);
    if (duplicateMbId) {
        if (duplicateMbId === '(탈퇴 또는 기존 회원)') {
            return {
                ...emptyResult,
                error: '이미 본인인증에 사용된 정보입니다. 가입된 회원계정이 있거나 탈퇴된 계정일 수 있습니다.'
            };
        }
        return {
            ...emptyResult,
            error: `입력하신 본인확인 정보로 이미 가입된 내역이 존재합니다.\n회원아이디 : ${duplicateMbId}`
        };
    }

    // 성인 인증
    const adult = isAdult(userBirthday);

    // 해시 데이터 생성 (PHP와 동일)
    const md5CertNo = createHash('sha1').update(certNo).digest('hex');
    const certHash = createHash('sha1')
        .update(certType + userBirthday + dupinfo + md5CertNo)
        .digest('hex');

    // 기존 회원인 경우 DB 업데이트
    if (currentMbId) {
        try {
            await pool.execute(
                `UPDATE g5_member SET mb_certify = ?, mb_dupinfo = ?, mb_adult = ? WHERE mb_id = ?`,
                [certType, dupinfo, adult ? 1 : 0, currentMbId]
            );
            await insertMemberCertHistory(currentMbId, '', '', '', certType, dupinfo);
        } catch (err) {
            console.error('[cert-inicis] member update failed:', err);
        }
    }

    return {
        success: true,
        certType,
        certNo: md5CertNo,
        certHash,
        dupinfo,
        name: userName,
        phone: formattedPhone,
        birthday: userBirthday,
        adult
    };
}

/**
 * 전화번호 하이픈 포맷팅
 * PHP: hyphen_hp_number()
 */
function formatPhone(phone: string): string {
    const cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length === 11) {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return cleaned;
}
