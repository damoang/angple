/**
 * 회원 프로필 관리 (닉네임/이메일/비밀번호/설정 변경)
 * PHP member_confirm_update.php 호환
 */
import pool from '$lib/server/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { validateNickname } from './register.js';
import { sendMail } from '$lib/server/mailer.js';
import { env } from '$env/dynamic/private';

const SITE_URL = env.SITE_URL || 'https://damoang.net';
const SITE_NAME = env.VITE_SITE_NAME || 'Angple';

/** 프로필 전체 정보 조회 */
export interface MemberFullProfile {
    mb_id: string;
    mb_nick: string;
    mb_email: string;
    mb_homepage: string;
    mb_signature: string;
    mb_open: number;
    mb_mailling: number;
    mb_nick_date: string;
    mb_hp: string;
    mb_password: string;
    mb_leave_date: string;
    mb_intercept_date: string;
    mb_level: number;
    mb_image_url: string;
    mb_certify: string;
}

/** 프로필 전체 정보 조회 */
export async function getMemberFullProfile(mbId: string): Promise<MemberFullProfile | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT mb_id, mb_nick, mb_email, mb_homepage, mb_signature,
		        mb_open, mb_mailling, mb_nick_date, mb_hp, mb_password,
		        mb_leave_date, mb_intercept_date, mb_level, mb_image_url, mb_certify
		 FROM g5_member WHERE mb_id = ? LIMIT 1`,
        [mbId]
    );
    return (rows[0] as MemberFullProfile) || null;
}

/**
 * 닉네임 변경
 * - register.ts의 validateNickname() 재사용
 * - mb_nick_date 30일 쿨다운 체크
 */
export async function updateNickname(
    mbId: string,
    newNick: string
): Promise<{ success: boolean; error?: string }> {
    const trimmed = newNick.trim();

    // 현재 프로필 조회
    const profile = await getMemberFullProfile(mbId);
    if (!profile) return { success: false, error: '회원 정보를 찾을 수 없습니다.' };

    // 같은 닉네임이면 스킵
    if (profile.mb_nick === trimmed) {
        return { success: false, error: '현재 닉네임과 동일합니다.' };
    }

    // 30일 쿨다운 체크
    if (profile.mb_nick_date) {
        const lastChange = new Date(profile.mb_nick_date);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 30) {
            const remaining = 30 - diffDays;
            return {
                success: false,
                error: `닉네임은 30일에 한 번만 변경할 수 있습니다. (${remaining}일 후 변경 가능)`
            };
        }
    }

    // 닉네임 유효성 검사 (중복 체크 포함)
    const validation = await validateNickname(trimmed);
    if (!validation.valid) {
        return { success: false, error: validation.error };
    }

    // UPDATE
    await pool.query<ResultSetHeader>(
        'UPDATE g5_member SET mb_nick = ?, mb_nick_date = CURDATE() WHERE mb_id = ?',
        [trimmed, mbId]
    );

    return { success: true };
}

/**
 * 이메일 변경 요청 (인증 메일 발송)
 * - 형식 검증 + 중복 체크 → 인증 토큰 생성 → 메일 발송
 * - mb_email_certify2에 "새이메일|토큰|타임스탬프" 저장
 */
export async function updateEmail(
    mbId: string,
    newEmail: string
): Promise<{ success: boolean; error?: string; message?: string }> {
    const trimmed = newEmail.trim().toLowerCase();

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
        return { success: false, error: '올바른 이메일 형식이 아닙니다.' };
    }

    // 현재 프로필 조회
    const profile = await getMemberFullProfile(mbId);
    if (!profile) return { success: false, error: '회원 정보를 찾을 수 없습니다.' };

    // 같은 이메일이면 스킵
    if (profile.mb_email === trimmed) {
        return { success: false, error: '현재 이메일과 동일합니다.' };
    }

    // 중복 체크 (다른 회원)
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as cnt FROM g5_member WHERE mb_email = ? AND mb_id != ?',
        [trimmed, mbId]
    );
    if ((rows[0]?.cnt || 0) > 0) {
        return { success: false, error: '이미 사용 중인 이메일입니다.' };
    }

    // 인증 토큰 생성
    const token = randomBytes(24).toString('hex');
    const timestamp = Date.now().toString(36);

    // mb_email_certify2에 "새이메일|토큰|타임스탬프" 저장
    await pool.query<ResultSetHeader>(
        'UPDATE g5_member SET mb_email_certify2 = ? WHERE mb_id = ?',
        [`${trimmed}|${token}|${timestamp}`, mbId]
    );

    // 인증 메일 발송
    const verifyUrl = `${SITE_URL}/member/settings/verify-email?token=${token}&mb_id=${encodeURIComponent(mbId)}`;
    await sendMail({
        to: trimmed,
        subject: `[${SITE_NAME}] 이메일 변경 인증`,
        html: `
            <div style="max-width:600px;margin:0 auto;font-family:sans-serif;">
                <h2 style="color:#333;">이메일 변경 인증</h2>
                <p>${profile.mb_nick}님, 안녕하세요.</p>
                <p>이메일을 <strong>${trimmed}</strong>으로 변경하시려면 아래 버튼을 클릭해주세요.</p>
                <p style="margin:30px 0;">
                    <a href="${verifyUrl}"
                       style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
                        이메일 변경 확인
                    </a>
                </p>
                <p style="color:#666;font-size:14px;">
                    이 링크는 24시간 동안 유효합니다.<br/>
                    본인이 요청하지 않았다면 이 메일을 무시하세요.
                </p>
                <hr style="border:0;border-top:1px solid #eee;margin:30px 0;">
                <p style="color:#999;font-size:12px;">${SITE_NAME}</p>
            </div>
        `
    });

    return {
        success: true,
        message: `${trimmed}으로 인증 메일을 발송했습니다. 메일의 링크를 클릭해주세요.`
    };
}

/**
 * 이메일 변경 인증 토큰 검증 및 변경 확정
 * - mb_email_certify2에서 토큰 검증 → 이메일 변경
 */
export async function confirmEmailChange(
    mbId: string,
    token: string
): Promise<{ success: boolean; error?: string; newEmail?: string }> {
    const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT mb_email_certify2 FROM g5_member WHERE mb_id = ? LIMIT 1',
        [mbId]
    );

    if (!rows[0]?.mb_email_certify2) {
        return { success: false, error: '이메일 변경 요청을 찾을 수 없습니다.' };
    }

    const parts = (rows[0].mb_email_certify2 as string).split('|');
    if (parts.length < 3) {
        return { success: false, error: '잘못된 인증 정보입니다.' };
    }

    const [storedEmail, storedToken, storedTimestamp] = parts;

    // 토큰 검증
    if (storedToken !== token) {
        return { success: false, error: '유효하지 않은 인증 링크입니다.' };
    }

    // 만료 체크 (24시간)
    const createdAt = parseInt(storedTimestamp, 36);
    if (Date.now() - createdAt > TOKEN_EXPIRY_MS) {
        return {
            success: false,
            error: '만료된 인증 링크입니다. 이메일 변경을 다시 요청해주세요.'
        };
    }

    // 중복 체크 (토큰 생성 후 다른 회원이 같은 이메일 등록했을 수 있음)
    const [dupRows] = await pool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as cnt FROM g5_member WHERE mb_email = ? AND mb_id != ?',
        [storedEmail, mbId]
    );
    if ((dupRows[0]?.cnt || 0) > 0) {
        return { success: false, error: '이미 다른 회원이 사용 중인 이메일입니다.' };
    }

    // 이메일 변경 확정 + 인증 정보 초기화
    await pool.query<ResultSetHeader>(
        'UPDATE g5_member SET mb_email = ?, mb_email_certify2 = ? WHERE mb_id = ?',
        [storedEmail, '', mbId]
    );

    return { success: true, newEmail: storedEmail };
}

/**
 * 비밀번호 변경
 * - 현재 비밀번호 검증 → 새 비밀번호 해싱 → UPDATE
 */
export async function changePassword(
    mbId: string,
    currentPw: string,
    newPw: string
): Promise<{ success: boolean; error?: string }> {
    if (!currentPw || !newPw) {
        return { success: false, error: '비밀번호를 입력해주세요.' };
    }

    if (newPw.length < 4) {
        return { success: false, error: '새 비밀번호는 4자 이상이어야 합니다.' };
    }

    // 현재 비밀번호 조회
    const profile = await getMemberFullProfile(mbId);
    if (!profile) return { success: false, error: '회원 정보를 찾을 수 없습니다.' };

    // 현재 비밀번호 검증
    const isMatch = await bcrypt.compare(currentPw, profile.mb_password);
    if (!isMatch) {
        return { success: false, error: '현재 비밀번호가 일치하지 않습니다.' };
    }

    // 새 비밀번호 해싱
    const hashedPw = await bcrypt.hash(newPw, 10);

    // UPDATE
    await pool.query<ResultSetHeader>('UPDATE g5_member SET mb_password = ? WHERE mb_id = ?', [
        hashedPw,
        mbId
    ]);

    return { success: true };
}

/**
 * 프로필 설정 업데이트
 * - 홈페이지, 서명, 프로필 공개, 메일링
 */
export async function updateProfile(
    mbId: string,
    fields: {
        mb_homepage?: string;
        mb_signature?: string;
        mb_open?: number;
        mb_mailling?: number;
        mb_image_url?: string;
    }
): Promise<{ success: boolean; error?: string }> {
    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (fields.mb_image_url !== undefined) {
        // 빈 문자열(삭제) 또는 S3/CDN URL만 허용
        const ALLOWED_CDN_PREFIXES = ['https://s3.damoang.net/', 'https://cdn.damoang.net/'];
        if (
            fields.mb_image_url &&
            !ALLOWED_CDN_PREFIXES.some((p) => fields.mb_image_url!.startsWith(p))
        ) {
            return { success: false, error: '유효하지 않은 이미지 URL입니다.' };
        }
        updates.push('mb_image_url = ?');
        values.push(fields.mb_image_url);
    }

    if (fields.mb_homepage !== undefined) {
        // URL 형식 검증 (빈 문자열 허용)
        if (fields.mb_homepage && !/^https?:\/\/.+/.test(fields.mb_homepage)) {
            return {
                success: false,
                error: '홈페이지 URL은 http:// 또는 https://로 시작해야 합니다.'
            };
        }
        updates.push('mb_homepage = ?');
        values.push(fields.mb_homepage);
    }

    if (fields.mb_signature !== undefined) {
        // 서명 길이 제한 (255자)
        if (fields.mb_signature.length > 255) {
            return { success: false, error: '서명은 255자 이내로 입력해주세요.' };
        }
        updates.push('mb_signature = ?');
        values.push(fields.mb_signature);
    }

    if (fields.mb_open !== undefined) {
        updates.push('mb_open = ?');
        values.push(fields.mb_open ? 1 : 0);
    }

    if (fields.mb_mailling !== undefined) {
        updates.push('mb_mailling = ?');
        values.push(fields.mb_mailling ? 1 : 0);
    }

    if (updates.length === 0) {
        return { success: false, error: '변경할 항목이 없습니다.' };
    }

    values.push(mbId);
    await pool.query<ResultSetHeader>(
        `UPDATE g5_member SET ${updates.join(', ')} WHERE mb_id = ?`,
        values
    );

    return { success: true };
}
