/**
 * 서버사이드 세션 스토어
 *
 * Lucia v3 패턴 참고: crypto-random 세션 ID + SHA-256 해시 DB 저장
 * - 세션 ID: 32 bytes hex (브라우저 쿠키)
 * - DB에는 SHA-256 해시만 저장 (DB 유출 시 세션 탈취 불가)
 * - CSRF 토큰 포함 (Double-submit cookie 패턴)
 */
import { randomBytes, createHash } from 'crypto';
import pool from '$lib/server/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

/** 세션 수명: 30일 */
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** 슬라이딩 윈도우: 마지막 활동 후 15일 이내에 재접속하면 갱신 */
const SESSION_REFRESH_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000;

export interface SessionData {
    sessionId: string; // 원본 세션 ID (쿠키에 저장, DB에는 해시만)
    mbId: string;
    csrfToken: string;
    ip: string | null;
    userAgent: string | null;
    createdAt: Date;
    lastActiveAt: Date;
    expiresAt: Date;
}

interface SessionRow extends RowDataPacket {
    id: number;
    session_id_hash: string;
    mb_id: string;
    csrf_token: string;
    ip: string | null;
    user_agent: string | null;
    created_at: Date;
    last_active_at: Date;
    expires_at: Date;
}

/** 세션 ID 생성 (32 bytes → 64 hex chars) */
function generateSessionId(): string {
    return randomBytes(32).toString('hex');
}

/** CSRF 토큰 생성 (32 bytes → 64 hex chars) */
function generateCsrfToken(): string {
    return randomBytes(32).toString('hex');
}

/** SHA-256 해시 */
function hashSessionId(sessionId: string): string {
    return createHash('sha256').update(sessionId).digest('hex');
}

/**
 * 새 세션 생성
 * @returns 세션 ID (쿠키에 저장할 원본 값) + CSRF 토큰
 */
export async function createSession(
    mbId: string,
    metadata?: { ip?: string; userAgent?: string }
): Promise<{ sessionId: string; csrfToken: string; expiresAt: Date }> {
    const sessionId = generateSessionId();
    const sessionIdHash = hashSessionId(sessionId);
    const csrfToken = generateCsrfToken();
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

    await pool.query<ResultSetHeader>(
        `INSERT INTO angple_sessions (session_id_hash, mb_id, csrf_token, ip, user_agent, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            sessionIdHash,
            mbId,
            csrfToken,
            metadata?.ip ?? null,
            metadata?.userAgent?.substring(0, 512) ?? null,
            expiresAt
        ]
    );

    return { sessionId, csrfToken, expiresAt };
}

/**
 * 세션 조회 (유효성 검증 포함)
 * - 만료 확인
 * - 슬라이딩 윈도우 갱신
 * @returns 유효한 세션 데이터 또는 null
 */
export async function getSession(sessionId: string): Promise<SessionData | null> {
    const sessionIdHash = hashSessionId(sessionId);

    const [rows] = await pool.query<SessionRow[]>(
        `SELECT mb_id, csrf_token, ip, user_agent, created_at, last_active_at, expires_at
         FROM angple_sessions
         WHERE session_id_hash = ?
         LIMIT 1`,
        [sessionIdHash]
    );

    if (rows.length === 0) return null;

    const row = rows[0];
    const now = new Date();

    // 만료 확인
    if (now > new Date(row.expires_at)) {
        // 만료된 세션 삭제
        await pool.query<ResultSetHeader>(`DELETE FROM angple_sessions WHERE session_id_hash = ?`, [
            sessionIdHash
        ]);
        return null;
    }

    // 슬라이딩 윈도우: 마지막 활동 후 일정 시간 지나면 만료 시간 갱신
    const lastActive = new Date(row.last_active_at);
    if (now.getTime() - lastActive.getTime() > SESSION_REFRESH_THRESHOLD_MS) {
        const newExpiresAt = new Date(now.getTime() + SESSION_MAX_AGE_MS);
        await pool.query<ResultSetHeader>(
            `UPDATE angple_sessions SET last_active_at = NOW(), expires_at = ? WHERE session_id_hash = ?`,
            [newExpiresAt, sessionIdHash]
        );
    } else {
        // 활동 시간만 업데이트 (5분 간격으로 제한하여 DB 부하 감소)
        if (now.getTime() - lastActive.getTime() > 5 * 60 * 1000) {
            await pool.query<ResultSetHeader>(
                `UPDATE angple_sessions SET last_active_at = NOW() WHERE session_id_hash = ?`,
                [sessionIdHash]
            );
        }
    }

    return {
        sessionId,
        mbId: row.mb_id,
        csrfToken: row.csrf_token,
        ip: row.ip,
        userAgent: row.user_agent,
        createdAt: new Date(row.created_at),
        lastActiveAt: new Date(row.last_active_at),
        expiresAt: new Date(row.expires_at)
    };
}

/**
 * 세션 파괴 (로그아웃)
 */
export async function destroySession(sessionId: string): Promise<void> {
    const sessionIdHash = hashSessionId(sessionId);
    await pool.query<ResultSetHeader>(`DELETE FROM angple_sessions WHERE session_id_hash = ?`, [
        sessionIdHash
    ]);
}

/**
 * 사용자의 모든 세션 파괴 ("모든 기기에서 로그아웃")
 */
export async function destroyAllUserSessions(mbId: string): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
        `DELETE FROM angple_sessions WHERE mb_id = ?`,
        [mbId]
    );
    return result.affectedRows;
}

/**
 * 만료된 세션 정리 (주기적 호출)
 */
export async function cleanupExpiredSessions(): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
        `DELETE FROM angple_sessions WHERE expires_at < NOW()`
    );
    return result.affectedRows;
}

/** 세션 쿠키 설정 상수 */
export const SESSION_COOKIE_NAME = 'angple_sid';
export const CSRF_COOKIE_NAME = 'angple_csrf';
export const SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30일 (초 단위)
