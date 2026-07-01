/**
 * 회원 탈퇴 숙려기간(30일) 관련 서버 유틸리티
 *
 * 백엔드(angple-backend)가 탈퇴 신청/취소의 원본 로직을 담당한다.
 *  - POST   /api/v1/members/me/leave  : 탈퇴 신청(숙려 상태 진입)
 *  - DELETE /api/v1/members/me/leave  : 숙려기간 내 탈퇴 취소
 *
 * 이 모듈은 프론트(SvelteKit)에서
 *  1) g5_member.mb_leave_date / mb_leave_reason 로 "숙려 중(취소 가능)" 여부를 판정하고,
 *  2) 백엔드 탈퇴/취소 API를 호출하며,
 *  3) 재로그인 시 숙려 취소 화면으로 넘길 때 사용하는 단기 서명 토큰을 발급/검증한다.
 */
import { SignJWT, jwtVerify } from 'jose';
import { env } from '$env/dynamic/private';
import type { MemberRow } from './oauth/types.js';

const BACKEND_URL = env.BACKEND_URL || 'http://localhost:8090';
const JWT_SECRET = env.JWT_SECRET || '';
const secret = new TextEncoder().encode(JWT_SECRET);

/** 숙려기간(일) — 백엔드와 동일하게 30일 */
export const WITHDRAWAL_GRACE_DAYS = 30;

/** 재로그인 → 취소 화면 인계용 단기 쿠키 이름 */
export const WITHDRAWAL_GRACE_COOKIE = 'withdrawal_grace';

/** 관리자 처리 탈퇴 사유 — 재로그인으로 취소 불가(영구 차단) */
const PROTECTED_LEAVE_REASONS = new Set([
    'admin',
    'terms_violation',
    'contract_withdrawal',
    'account_abuse'
]);

/** YYYYMMDD 문자열을 자정 기준 Date 로 파싱. 실패 시 null. */
function parseLeaveDate(raw: string | null | undefined): Date | null {
    if (!raw) return null;
    const compact = String(raw).replace(/[^0-9]/g, '');
    if (compact.length < 8) return null;
    const year = Number(compact.slice(0, 4));
    const month = Number(compact.slice(4, 6));
    const day = Number(compact.slice(6, 8));
    if (!year || !month || !day) return null;
    const d = new Date(year, month - 1, day, 0, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
}

function toIsoDate(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export interface WithdrawalGraceStatus {
    /** 숙려 중이며 재로그인으로 취소 가능한 상태 */
    inGrace: boolean;
    /** 신청일 (YYYY-MM-DD) */
    leaveDate: string;
    /** 확정 예정일 (YYYY-MM-DD, 신청일 + 30일) */
    deadline: string;
    /** 남은 일수 (0 이상) */
    daysRemaining: number;
}

/**
 * g5_member 행으로 탈퇴 숙려 상태를 계산한다.
 *  - mb_leave_date 미설정 → null (정상 회원)
 *  - 관리자 처리 탈퇴(PROTECTED_LEAVE_REASONS) → inGrace=false (영구 차단)
 *  - 신청일 + 30일 경과 → inGrace=false (확정 대상, 취소 불가)
 *  - 그 외 자발적 탈퇴 & 30일 이내 → inGrace=true (취소 가능)
 */
export function computeWithdrawalGrace(member: MemberRow): WithdrawalGraceStatus | null {
    if (!member.mb_leave_date) return null;

    const leaveDate = parseLeaveDate(member.mb_leave_date);
    if (!leaveDate) {
        // 날짜 파싱 불가 — 안전하게 취소 불가로 처리
        return { inGrace: false, leaveDate: '', deadline: '', daysRemaining: 0 };
    }

    const deadline = new Date(leaveDate);
    deadline.setDate(deadline.getDate() + WITHDRAWAL_GRACE_DAYS);

    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysRemaining = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / msPerDay));

    const reason = (member.mb_leave_reason || '').trim();
    const isProtected = PROTECTED_LEAVE_REASONS.has(reason);
    const inGrace = !isProtected && daysRemaining > 0;

    return {
        inGrace,
        leaveDate: toIsoDate(leaveDate),
        deadline: toIsoDate(deadline),
        daysRemaining
    };
}

/** 백엔드 탈퇴/취소 인증 헤더 구성 (Bearer + 내부 신뢰 헤더) */
function buildAuthHeaders(accessToken: string, mbId: string, level: number): HeadersInit {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
    };
    // 프록시(/api/v1/[...path])와 동일한 내부 신뢰 헤더 — Bearer 검증 실패 대비.
    headers['X-Internal-User-ID'] = mbId;
    headers['X-Internal-User-Level'] = String(level || 0);
    headers['X-Internal-Auth'] = 'sveltekit-session';
    headers['X-Internal-Secret'] = env.INTERNAL_SECRET || '';
    return headers;
}

export interface LeaveApiResult {
    ok: boolean;
    status: number;
    message?: string;
    deadline?: string;
    daysRemaining?: number;
    leaveStatus?: string;
}

/** 백엔드 탈퇴 신청 (POST /api/v1/members/me/leave) */
export async function requestMemberLeave(
    accessToken: string,
    mbId: string,
    level: number,
    reason?: string
): Promise<LeaveApiResult> {
    const res = await fetch(`${BACKEND_URL}/api/v1/members/me/leave`, {
        method: 'POST',
        headers: buildAuthHeaders(accessToken, mbId, level),
        body: JSON.stringify(reason ? { reason } : {})
    });
    const data = await res.json().catch(() => ({}) as Record<string, unknown>);
    const withdrawal = (data?.data?.withdrawal ?? {}) as Record<string, unknown>;
    return {
        ok: res.ok && data?.success !== false,
        status: res.status,
        message: (data?.data?.message as string) || (data?.message as string) || undefined,
        deadline: (withdrawal.deadline as string) || undefined,
        daysRemaining: (withdrawal.days_remaining as number) ?? undefined,
        leaveStatus: (withdrawal.status as string) || undefined
    };
}

/** 백엔드 탈퇴 취소 (DELETE /api/v1/members/me/leave) */
export async function cancelMemberLeave(
    accessToken: string,
    mbId: string,
    level: number
): Promise<LeaveApiResult> {
    const res = await fetch(`${BACKEND_URL}/api/v1/members/me/leave`, {
        method: 'DELETE',
        headers: buildAuthHeaders(accessToken, mbId, level)
    });
    const data = await res.json().catch(() => ({}) as Record<string, unknown>);
    return {
        ok: res.ok && data?.success !== false,
        status: res.status,
        message: (data?.data?.message as string) || (data?.message as string) || undefined
    };
}

const GRACE_TOKEN_ISSUER = 'angple';
const GRACE_TOKEN_PURPOSE = 'withdrawal_grace';

/**
 * 재로그인 → 취소 화면 인계용 단기 서명 토큰 발급 (15분).
 * mb_id 위조를 막기 위해 서명하며, httpOnly 쿠키로만 전달한다.
 */
export async function signWithdrawalGraceToken(mbId: string): Promise<string> {
    return new SignJWT({ sub: mbId, purpose: GRACE_TOKEN_PURPOSE })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .setIssuer(GRACE_TOKEN_ISSUER)
        .sign(secret);
}

/** 취소 화면 인계 토큰 검증 → mb_id 반환 (실패 시 null) */
export async function verifyWithdrawalGraceToken(token: string): Promise<string | null> {
    try {
        const { payload } = await jwtVerify(token, secret, { issuer: GRACE_TOKEN_ISSUER });
        if (payload.purpose !== GRACE_TOKEN_PURPOSE) return null;
        return (payload.sub as string) || null;
    } catch {
        return null;
    }
}
