/**
 * 소셜 회원가입 로직
 * PHP register_form_update.php 호환
 */
import pool from '$lib/server/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { createHash, randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * Adler-32 체크섬 구현 (PHP의 hash('adler32') 호환)
 * Node.js에는 내장 adler32가 없으므로 직접 구현
 */
export function adler32(buf: Buffer): number {
    let a = 1;
    let b = 0;
    const MOD = 65521;

    for (let i = 0; i < buf.length; i++) {
        a = (a + buf[i]) % MOD;
        b = (b + a) % MOD;
    }

    return (b << 16) | a;
}

/**
 * PHP 호환 소셜 mb_id 생성
 * PHP: strtolower(provider) . '_' . hash('adler32', md5(identifier))
 */
export function generateSocialMbId(provider: string, identifier: string): string {
    const md5Hash = createHash('md5').update(identifier).digest('hex');
    const adlerValue = adler32(Buffer.from(md5Hash, 'utf-8')) >>> 0;
    return `${provider.toLowerCase()}_${adlerValue.toString(16).padStart(8, '0')}`;
}

/** g5_member.mb_id 컬럼 길이. 이 값을 넘기면 DB가 조용히 절단한다. */
export const MB_ID_MAX_LENGTH = 20;

/**
 * mb_id가 이미 점유됐을 때 붙이는 충돌 회피 접미사.
 *
 * ⚠️ 접미사를 길게 잡으면 안 된다. g5_member.mb_id는 varchar(20)이라 넘치는 부분이
 * 조용히 잘려 저장되는데, g5_member_social_profiles.mb_id는 varchar(255)라
 * 잘리지 않는다. 두 테이블의 mb_id가 어긋나면 findSocialProfile이 존재하지 않는
 * 회원을 가리켜 **그 계정은 소셜 로그인이 영구히 불가능해진다**.
 * (2026-07-23 실측: 그렇게 갇힌 계정 62건, 최근 두 달에만 46건)
 *
 * base는 `provider_adler32` 형태로 최대 15자(google_)이므로 4자 접미사까지 안전하다.
 */
export function appendMbIdSuffix(baseMbId: string): string {
    const suffix = randomBytes(2).toString('hex'); // 4자
    const candidate = `${baseMbId}_${suffix}`;
    if (candidate.length > MB_ID_MAX_LENGTH) {
        // base 자체가 이미 길면 접미사 자리를 확보하기 위해 base를 줄인다.
        return `${baseMbId.slice(0, MB_ID_MAX_LENGTH - suffix.length - 1)}_${suffix}`;
    }
    return candidate;
}

/**
 * 소셜 재가입 시 이미 그 소셜 계정으로 만들어진 계정이 있는지 판정한다.
 *
 * `generateSocialMbId`는 결정적이라 mb_id가 충돌한다는 것은 **같은 소셜 계정**이라는 뜻이다.
 * 즉 점유 계정은 동일인의 것이 확실하므로, 새 계정을 만들 게 아니라 복구를 안내해야 한다.
 * (2026-07-23 실측: 같은 base를 공유하는 198계정 90묶음 중 둘 이상이 활동한 묶음 0개
 *  — 다중이가 아니라 재가입이 막혀 쌓인 빈 계정이었다)
 *
 * - `none`        점유 없음 → 정상 가입
 * - `blocked`     이용제한 중 → 계정 생성 금지. 제재 회피 재가입 통로를 막는다
 * - `recoverable` 그 외(탈퇴/활성) → 복구 안내 대상
 */
export type OccupantKind = 'none' | 'blocked' | 'recoverable';

export interface OccupantInfo {
    kind: OccupantKind;
    mbId: string;
    nick: string;
    joinedAt: string;
    postCount: number;
    withdrawn: boolean;
}

export async function inspectSocialMbIdOccupant(
    provider: string,
    identifier: string
): Promise<OccupantInfo> {
    const mbId = generateSocialMbId(provider, identifier);
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT mb_id, mb_nick, mb_datetime, mb_leave_date, mb_intercept_date
		   FROM g5_member WHERE mb_id = ? LIMIT 1`,
        [mbId]
    );
    const row = rows[0];
    if (!row) {
        return { kind: 'none', mbId, nick: '', joinedAt: '', postCount: 0, withdrawn: false };
    }

    // mb_intercept_date는 YYYYMMDD 문자열. 99991231 = 영구.
    // 만료된 제재는 차단 대상이 아니다.
    const intercept = String(row.mb_intercept_date || '');
    const today = new Date();
    const todayStr =
        `${today.getFullYear()}` +
        `${String(today.getMonth() + 1).padStart(2, '0')}` +
        `${String(today.getDate()).padStart(2, '0')}`;
    const blocked = intercept.length === 8 && intercept >= todayStr;

    const [cnt] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) AS cnt FROM g5_board_new WHERE mb_id = ?',
        [mbId]
    );

    return {
        kind: blocked ? 'blocked' : 'recoverable',
        mbId,
        nick: row.mb_nick || '',
        joinedAt: row.mb_datetime ? String(row.mb_datetime) : '',
        postCount: Number(cnt[0]?.cnt || 0),
        withdrawn: Boolean(row.mb_leave_date)
    };
}

/**
 * 탈퇴 상태인 옛 계정을 되살린다. 소셜 로그인 자기증명이 본인 확인을 대신한다
 * (같은 소셜 sub이어야만 이 경로에 도달하므로 DI보다 강한 근거다).
 */
export async function reactivateMember(mbId: string, reason: string): Promise<void> {
    await pool.query(
        `UPDATE g5_member
		    SET mb_leave_date = '',
		        mb_leave_reason = '',
		        mb_memo = CONCAT(IFNULL(mb_memo,''), '\\n', DATE_FORMAT(NOW(),'%Y%m%d'), ' ', ?)
		  WHERE mb_id = ?`,
        [reason, mbId]
    );
}

/** g5_config에서 가입 레벨 조회 */
export async function getRegisterLevel(): Promise<number> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT cf_register_level FROM g5_config LIMIT 1'
    );
    return rows[0]?.cf_register_level ?? 2;
}

/** g5_config에서 금지 닉네임/아이디 목록 조회 */
export async function getProhibitList(): Promise<string[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT cf_prohibit_id FROM g5_config LIMIT 1'
    );
    const list = rows[0]?.cf_prohibit_id || '';
    return list
        .split(',')
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean);
}

/** 닉네임 중복 체크 */
export async function isNicknameTaken(nickname: string): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as cnt FROM g5_member WHERE mb_nick = ?',
        [nickname]
    );
    return (rows[0]?.cnt || 0) > 0;
}

/** mb_id 중복 체크 */
export async function isMbIdTaken(mbId: string): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as cnt FROM g5_member WHERE mb_id = ?',
        [mbId]
    );
    return (rows[0]?.cnt || 0) > 0;
}

/**
 * 광고주 초대 플로우에서 이전에 생성된 임시 계정 찾기.
 * 같은 소셜 identifier로 생성된 tmp_ 닉네임 계정이 있으면 재사용하여 중복 방지.
 */
export async function findExistingTempAccount(baseMbId: string): Promise<{ mb_id: string } | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT mb_id FROM g5_member
         WHERE (mb_id = ? OR mb_id LIKE ?) AND mb_nick LIKE 'tmp\\_%' AND mb_leave_date = ''
         ORDER BY mb_datetime DESC LIMIT 1`,
        [baseMbId, `${baseMbId}_%`]
    );
    return rows[0] ? { mb_id: rows[0].mb_id as string } : null;
}

/**
 * 닉네임 검증 (PHP register.lib.php 호환)
 * - 빈 값 불가
 * - 2~20자
 * - 한글/영문/숫자/점/밑줄 허용
 * - 연속 점 불가
 * - 금지어 불가
 * - 중복 불가
 */
export async function validateNickname(
    nickname: string
): Promise<{ valid: boolean; error?: string }> {
    if (!nickname || !nickname.trim()) {
        return { valid: false, error: '닉네임을 입력해주세요.' };
    }

    const trimmed = nickname.trim();

    if (trimmed.length < 2 || trimmed.length > 20) {
        return { valid: false, error: '닉네임은 2~20자로 입력해주세요.' };
    }

    // 허용 문자: 한글, 영문, 숫자, 점, 밑줄
    if (!/^[가-힣a-zA-Z0-9._]+$/.test(trimmed)) {
        return { valid: false, error: '닉네임은 한글, 영문, 숫자, 점, 밑줄만 사용 가능합니다.' };
    }

    // 연속 점 불가
    if (/\.\./.test(trimmed)) {
        return { valid: false, error: '닉네임에 연속된 점(.)은 사용할 수 없습니다.' };
    }

    // 금지어 체크
    const prohibitList = await getProhibitList();
    if (prohibitList.includes(trimmed.toLowerCase())) {
        return { valid: false, error: '사용할 수 없는 닉네임입니다.' };
    }

    // 중복 체크
    if (await isNicknameTaken(trimmed)) {
        return { valid: false, error: '이미 사용 중인 닉네임입니다.' };
    }

    return { valid: true };
}

/**
 * 아이디 검증 (초대 플로우에서 사용자가 직접 입력)
 * - 3~20자
 * - 영문 소문자, 숫자, 밑줄 허용
 * - 금지어 불가
 * - 중복 불가
 */
export async function validateMbId(mbId: string): Promise<{ valid: boolean; error?: string }> {
    if (!mbId || !mbId.trim()) {
        return { valid: false, error: '아이디를 입력해주세요.' };
    }

    const trimmed = mbId.trim();

    if (trimmed.length < 3 || trimmed.length > 20) {
        return { valid: false, error: '아이디는 3~20자로 입력해주세요.' };
    }

    if (!/^[a-z0-9_]+$/.test(trimmed)) {
        return { valid: false, error: '아이디는 영문 소문자, 숫자, 밑줄만 사용 가능합니다.' };
    }

    // 금지어 체크
    const prohibitList = await getProhibitList();
    if (prohibitList.includes(trimmed.toLowerCase())) {
        return { valid: false, error: '사용할 수 없는 아이디입니다.' };
    }

    // 중복 체크
    if (await isMbIdTaken(trimmed)) {
        return { valid: false, error: '이미 사용 중인 아이디입니다.' };
    }

    return { valid: true };
}

/**
 * g5_member에 새 회원 INSERT
 * PHP register_form_update.php 기반 필수 컬럼
 */
export async function createMember(params: {
    mb_id: string;
    mb_nick: string;
    mb_email: string;
    mb_name: string;
    mb_ip: string;
    skipNickLock?: boolean;
}): Promise<void> {
    // 모든 소셜 가입 경로가 이 함수를 지난다. 여기서 막으면 어느 경로로 오든
    // 절단된 mb_id로 계정이 만들어지지 않는다(조용한 절단 → 시끄러운 실패).
    if (params.mb_id.length > MB_ID_MAX_LENGTH) {
        throw new Error(
            `mb_id 길이 초과(${params.mb_id.length}자 > ${MB_ID_MAX_LENGTH}자): ${params.mb_id}`
        );
    }

    const registerLevel = await getRegisterLevel();

    // mb_password는 소셜 로그인이므로 랜덤 해시 (직접 로그인 불가)
    const randomPassword = await bcrypt.hash(randomBytes(32).toString('hex'), 10);

    try {
        await pool.query<ResultSetHeader>(
            `INSERT INTO g5_member (
				mb_id, mb_password, mb_name, mb_nick, mb_email,
				mb_level, mb_datetime, mb_ip, mb_login_ip, mb_today_login,
				mb_nick_date, mb_open_date, mb_email_certify,
				mb_mailling, mb_sms, mb_open, mb_signature, mb_profile,
				mb_memo, mb_lost_certify, mb_homepage, mb_tel, mb_hp, mb_zip1, mb_zip2,
				mb_addr1, mb_addr2, mb_addr3, mb_addr_jibeon,
				mb_recommend, mb_point, mb_leave_date, mb_intercept_date
			) VALUES (
				?, ?, ?, ?, ?,
				?, NOW(), ?, ?, NOW(),
				?, CURDATE(), NOW(),
				0, 0, 0, '', '',
				'', '', '', '', '', '', '',
				'', '', '', '',
				'', 0, '', ''
			)`,
            [
                params.mb_id,
                randomPassword,
                params.mb_name,
                params.mb_nick,
                params.mb_email,
                registerLevel,
                params.mb_ip,
                params.mb_ip,
                params.skipNickLock ? '' : new Date().toISOString().slice(0, 10)
            ]
        );
    } catch (err: unknown) {
        const mysqlError = err as { code?: string };
        if (mysqlError.code === 'ER_DUP_ENTRY') {
            throw new Error('이미 가입된 회원이거나 사용 중인 닉네임입니다.');
        }
        throw err;
    }
}
