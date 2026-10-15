/**
 * 회원 카드(닉네임·프로필 사진·탈퇴 여부) 서버사이드 배치 조회
 *
 * 같은 회원 목록에 대해 닉네임·사진 조회와 탈퇴 조회를 따로 하던 것을 한 번으로 합친다.
 * - 캐시 없음: 호출한 요청 안에서 한 번만 읽는다.
 * - 결과 맵의 키는 DB 의 mb_id 그대로다(기존 조회들과 같은 키 규칙 — 소문자화하지 않는다).
 * - 탈퇴 판정은 withdrawn-members.ts 와 같은 조건(`mb_leave_date != ''`, NULL 은 탈퇴 아님)이고,
 *   그 함수와 마찬가지로 영문·숫자·밑줄로만 된 id 만 탈퇴로 본다.
 */
import type { RowDataPacket } from 'mysql2';
import pool from '$lib/server/db';

/** 한 번에 조회하는 회원 수 상한 — member-images / withdrawn-members 와 같다. */
const MAX_IDS = 200;
/** withdrawn-members.ts 가 탈퇴 조회 대상으로 인정하는 id 형식. */
const WITHDRAWN_ID_PATTERN = /^[a-zA-Z0-9_]+$/;

export interface MemberCard {
    /** mb_nick (없으면 빈 문자열) */
    nick: string;
    /** mb_image_url (없으면 빈 문자열) */
    image: string;
    /** mb_image_updated_at 의 unix epoch 초 (없으면 undefined) */
    imageUpdatedAt?: number;
    /** 탈퇴 회원 여부 */
    isLeft: boolean;
}

/**
 * 회원 카드 배치 조회 (쿼리 1회)
 * @param ids mb_id 배열 (중복·빈 값 허용 — 내부에서 정리)
 * @returns mb_id → MemberCard 맵 (DB 에 없는 회원은 포함 안 됨)
 */
export async function fetchMemberCards(ids: string[]): Promise<Map<string, MemberCard>> {
    const nonEmptyIds = ids.filter((id) => typeof id === 'string' && id !== '');
    const uniqueIds = [...new Set(nonEmptyIds)].slice(0, MAX_IDS);

    const cards = new Map<string, MemberCard>();
    if (uniqueIds.length === 0) return cards;

    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT mb_id, mb_nick, COALESCE(mb_image_url, '') AS mb_image_url, mb_image_updated_at,
                (mb_leave_date IS NOT NULL AND mb_leave_date <> '') AS is_left
         FROM g5_member
         WHERE mb_id IN (?)`,
        [uniqueIds]
    );

    for (const row of rows) {
        const memberId = String(row.mb_id);
        cards.set(memberId, {
            nick: row.mb_nick ? String(row.mb_nick) : '',
            image: row.mb_image_url ? String(row.mb_image_url) : '',
            imageUpdatedAt: row.mb_image_updated_at
                ? Math.floor(new Date(row.mb_image_updated_at).getTime() / 1000)
                : undefined,
            isLeft: Number(row.is_left) === 1 && WITHDRAWN_ID_PATTERN.test(memberId)
        });
    }

    return cards;
}
