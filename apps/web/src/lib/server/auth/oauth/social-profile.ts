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
        'SELECT * FROM g5_member_social_profiles WHERE provider = ? AND identifier = ? AND mb_id != "" ORDER BY mp_register_day ASC LIMIT 1',
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
 * 소셜 계정 추가 연결 전용 함수 (#12037).
 *
 * `upsertSocialProfile` 와 달리 다른 회원에게 연결된 동일 (provider, identifier) 행을
 * **삭제하지 않고** 충돌 시 에러를 던진다. 신규가입/재로그인 흐름에서는 기존
 * `upsertSocialProfile` 를 그대로 사용한다.
 *
 * 동작:
 * - 동일 (provider, identifier) 가 다른 mb_id 에 연결돼 있으면 `already_linked_other` throw
 * - 동일 mb_id 에 이미 동일 (provider, identifier) 가 있으면 idempotent 처리 (UPDATE only)
 * - 동일 mb_id 에 같은 provider 의 다른 identifier 가 있으면 갱신
 *   (한 회원이 한 provider 에 여러 identifier 를 가지지 않는다는 기존 제약 유지)
 * - 그 외 → INSERT
 */
export async function linkSocialProfile(
    mbId: string,
    provider: string,
    profile: OAuthUserProfile
): Promise<void> {
    const providerLower = provider.toLowerCase();
    const objectSha = createHash('sha1').update(JSON.stringify(profile)).digest('hex');

    // 다른 mb_id 가 동일 (provider, identifier) 에 이미 연결돼 있으면 차단
    const conflicting = await findSocialProfile(providerLower, profile.identifier);
    if (conflicting && conflicting.mb_id !== mbId) {
        const err = new Error('already_linked_other');
        (err as Error & { code: string }).code = 'already_linked_other';
        throw err;
    }

    // 동일 mb_id + 동일 provider 의 기존 행이 있으면 UPDATE (idempotent / identifier 갱신)
    const existing = await findSocialProfileByMember(mbId, providerLower);
    if (existing) {
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
        return;
    }

    // 신규 INSERT
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
