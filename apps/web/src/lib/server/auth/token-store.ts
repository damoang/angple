/**
 * Refresh Token 저장소
 *
 * Refresh token 로테이션 + 폐기(revocation) 구현
 * - 토큰 발급 시 SHA-256 해시를 DB에 저장
 * - 갱신 시 기존 토큰 폐기 + 새 토큰 발급 (rotation)
 * - 로그아웃 시 해당 토큰 폐기
 * - 토큰 재사용 탐지 시 전체 패밀리 폐기 (탈취 방지)
 */
import { createHash, randomBytes } from 'crypto';
import pool from '$lib/server/db.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';

/** 토큰 해시 생성 (SHA-256) */
export function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

/** 토큰 패밀리 ID 생성 (새 로그인 세션마다 고유) */
export function generateFamilyId(): string {
    return randomBytes(32).toString('hex');
}

interface RefreshTokenRow extends RowDataPacket {
    id: number;
    token_hash: string;
    mb_id: string;
    family_id: string;
    ip: string | null;
    user_agent: string | null;
    created_at: Date;
    expires_at: Date;
    revoked_at: Date | null;
}

/**
 * 새 refresh token을 DB에 저장
 */
export async function storeRefreshToken(
    tokenHash: string,
    mbId: string,
    familyId: string,
    expiresAt: Date,
    metadata?: { ip?: string; userAgent?: string }
): Promise<void> {
    await pool.query<ResultSetHeader>(
        `INSERT INTO angple_refresh_tokens (token_hash, mb_id, family_id, ip, user_agent, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            tokenHash,
            mbId,
            familyId,
            metadata?.ip ?? null,
            metadata?.userAgent?.substring(0, 512) ?? null,
            expiresAt
        ]
    );
}

/**
 * 토큰 해시로 유효한 토큰 조회
 * @returns 유효한 토큰 정보 또는 null (만료/폐기된 경우)
 */
export async function findValidToken(
    tokenHash: string
): Promise<{ mbId: string; familyId: string } | null> {
    const [rows] = await pool.query<RefreshTokenRow[]>(
        `SELECT mb_id, family_id, revoked_at, expires_at
         FROM angple_refresh_tokens
         WHERE token_hash = ?
         LIMIT 1`,
        [tokenHash]
    );

    if (rows.length === 0) return null;

    const row = rows[0];

    // 이미 폐기된 토큰 → 재사용 공격 탐지 → 패밀리 전체 폐기
    if (row.revoked_at) {
        await revokeTokenFamily(row.family_id);
        console.warn(
            `[AUTH] Refresh token reuse detected! family=${row.family_id} mb_id=${row.mb_id}`
        );
        return null;
    }

    // 만료 확인
    if (new Date() > new Date(row.expires_at)) {
        return null;
    }

    return { mbId: row.mb_id, familyId: row.family_id };
}

/**
 * 특정 토큰 폐기
 */
export async function revokeToken(tokenHash: string): Promise<void> {
    await pool.query<ResultSetHeader>(
        `UPDATE angple_refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL`,
        [tokenHash]
    );
}

/**
 * 토큰 패밀리 전체 폐기 (탈취 탐지 시)
 */
export async function revokeTokenFamily(familyId: string): Promise<void> {
    await pool.query<ResultSetHeader>(
        `UPDATE angple_refresh_tokens SET revoked_at = NOW() WHERE family_id = ? AND revoked_at IS NULL`,
        [familyId]
    );
}

/**
 * 사용자의 모든 refresh token 폐기 (비밀번호 변경, 모든 기기 로그아웃)
 */
export async function revokeAllUserTokens(mbId: string): Promise<void> {
    await pool.query<ResultSetHeader>(
        `UPDATE angple_refresh_tokens SET revoked_at = NOW() WHERE mb_id = ? AND revoked_at IS NULL`,
        [mbId]
    );
}

/**
 * 만료된 토큰 정리 (주기적 호출)
 */
export async function cleanupExpiredTokens(): Promise<number> {
    const [result] = await pool.query<ResultSetHeader>(
        `DELETE FROM angple_refresh_tokens WHERE expires_at < NOW()`
    );
    return result.affectedRows;
}
