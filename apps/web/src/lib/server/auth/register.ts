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
    const adlerValue = adler32(Buffer.from(md5Hash, 'utf-8'));
    return `${provider.toLowerCase()}_${adlerValue.toString(16).padStart(8, '0')}`;
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
 * g5_member에 새 회원 INSERT
 * PHP register_form_update.php 기반 필수 컬럼
 */
export async function createMember(params: {
    mb_id: string;
    mb_nick: string;
    mb_email: string;
    mb_name: string;
    mb_ip: string;
}): Promise<void> {
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
				CURDATE(), CURDATE(), NOW(),
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
                params.mb_ip
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
