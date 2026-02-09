/**
 * g5_member_social_profiles 테이블 CRUD
 * 기존 PHP social_user_profile_replace() 호환
 */
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';
import type { OAuthUserProfile, SocialProfileRow } from './types.js';
import { createHash } from 'crypto';

/** 프로바이더 + identifier로 소셜 프로필 조회 */
export async function findSocialProfile(
    provider: string,
    identifier: string
): Promise<SocialProfileRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM g5_member_social_profiles WHERE provider = ? AND identifier = ? AND mb_id != "" LIMIT 1',
        [provider.toLowerCase(), identifier]
    );
    return (rows[0] as SocialProfileRow) || null;
}

/** mb_id + provider로 소셜 프로필 조회 */
export async function findSocialProfileByMember(
    mbId: string,
    provider: string
): Promise<SocialProfileRow | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM g5_member_social_profiles WHERE mb_id = ? AND provider = ? LIMIT 1',
        [mbId, provider.toLowerCase()]
    );
    return (rows[0] as SocialProfileRow) || null;
}

/** mb_id로 연결된 모든 소셜 프로필 조회 */
export async function getSocialProfilesByMember(mbId: string): Promise<SocialProfileRow[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM g5_member_social_profiles WHERE mb_id = ? ORDER BY mp_register_day',
        [mbId]
    );
    return rows as SocialProfileRow[];
}

/** 소셜 프로필 삭제 (연결 해제) */
export async function deleteSocialProfile(mpNo: number, mbId: string): Promise<boolean> {
    const [result] = await pool.query<RowDataPacket[]>(
        'DELETE FROM g5_member_social_profiles WHERE mp_no = ? AND mb_id = ?',
        [mpNo, mbId]
    );
    return (result as unknown as { affectedRows: number }).affectedRows > 0;
}


/**
 * 소셜 프로필 저장/업데이트
 * PHP의 social_user_profile_replace() 호환
 */
export async function upsertSocialProfile(
    mbId: string,
    provider: string,
    profile: OAuthUserProfile
): Promise<void> {
    const providerLower = provider.toLowerCase();
    const objectSha = createHash('sha1').update(JSON.stringify(profile)).digest('hex');

    // 다른 회원에게 연결된 동일 프로바이더+identifier 레코드 삭제
    await pool.query(
        'DELETE FROM g5_member_social_profiles WHERE provider = ? AND identifier = ? AND mb_id != ?',
        [providerLower, profile.identifier, mbId]
    );

    // 기존 레코드 확인
    const existing = await findSocialProfileByMember(mbId, providerLower);

    if (existing) {
        // 업데이트
        await pool.query(
            `UPDATE g5_member_social_profiles
			 SET object_sha = ?, identifier = ?, profileurl = ?, photourl = ?,
			     displayname = ?, mp_latest_day = NOW()
			 WHERE mp_no = ?`,
            [
                objectSha,
                profile.identifier,
                profile.profileUrl || '',
                profile.photoUrl || '',
                profile.displayName || '',
                existing.mp_no
            ]
        );
    } else {
        // 신규 등록
        await pool.query(
            `INSERT INTO g5_member_social_profiles
			 (mb_id, provider, object_sha, identifier, profileurl, photourl, displayname, description, mp_register_day, mp_latest_day)
			 VALUES (?, ?, ?, ?, ?, ?, ?, '', NOW(), NOW())`,
            [
                mbId,
                providerLower,
                objectSha,
                profile.identifier,
                profile.profileUrl || '',
                profile.photoUrl || '',
                profile.displayName || ''
            ]
        );
    }
}
