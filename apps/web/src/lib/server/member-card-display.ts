/**
 * 회원 카드 → 글쓴이 표시 정보(사진·탈퇴 여부) 변환 (순수 함수)
 *
 * 게시판 목록·글 보기 SSR 이 사진(member-images.ts)·탈퇴(withdrawn-members.ts)를 따로 조회하던 것을
 * 회원 카드 한 번으로 바꾸면서, 결과 값이 기존과 같도록 맞춘다.
 * - 두 기존 함수와 같이 영문·숫자·밑줄로만 된 id 만 대상으로 본다(아니면 사진 없음·탈퇴 아님).
 * - 사진은 URL 이 비어 있지 않을 때만, 시각은 unix epoch 초(없으면 undefined).
 * - 카드에 없는 회원은 사진 없음·탈퇴 아님.
 */
import type { MemberCard } from './member-card.js';

/** member-images.ts / withdrawn-members.ts 가 조회 대상으로 인정하는 id 형식. */
const MEMBER_ID_PATTERN = /^[a-zA-Z0-9_]+$/;

export interface AuthorDisplay {
    /** 사진(없으면 undefined) — 기존 MemberImageInfo 와 같은 모양 */
    image?: { url: string; updated_at?: number };
    /** 탈퇴 회원 여부 */
    isLeft: boolean;
}

/** 카드 조회 대상 id — 비어 있지 않고 형식에 맞는 것만, 중복 제거. */
export function memberCardLookupIds(ids: Array<string | null | undefined>): string[] {
    const valid = ids.filter(
        (id): id is string => typeof id === 'string' && id !== '' && MEMBER_ID_PATTERN.test(id)
    );
    return [...new Set(valid)];
}

/** 한 글쓴이의 표시 정보. */
export function authorDisplayFromCards(
    cards: Map<string, MemberCard>,
    authorId: string | null | undefined
): AuthorDisplay {
    if (!authorId || !MEMBER_ID_PATTERN.test(authorId)) return { isLeft: false };
    const card = cards.get(authorId);
    if (!card) return { isLeft: false };
    const display: AuthorDisplay = { isLeft: card.isLeft };
    if (card.image) {
        display.image = { url: card.image, updated_at: card.imageUpdatedAt };
    }
    return display;
}
