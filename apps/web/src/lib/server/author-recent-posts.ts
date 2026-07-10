/**
 * 작성자 최근 글 SSR 셀렉터 (SEO 내부링크 강화, #83)
 *
 * member-activity(fetchMemberActivity) 결과에서 글 상세 하단에 노출할
 * "작성자의 최근 글"을 고른다. 선택 결과는 +page.server.ts 에서 await 되어
 * SSR HTML 앵커로 렌더된다 — 크롤러가 클라이언트 fetch 없이 내부링크를
 * 발견할 수 있게 하는 것이 목적.
 *
 * 필터 규칙:
 * - 현재 보고 있는 글 제외
 * - 삭제된 글(deleted_at) 제외
 * - 익명 게시판(message) 글 제외 — 마음메시지 익명 유출 전례(#1729) 방어
 * (비밀글은 백엔드 activity feed 동기화 단계에서 이미 제외됨 — member_activity_sync)
 */
import type { MemberActivity } from '$lib/server/member-activity';

/** SSR 섹션에 렌더되는 작성자 최근 글 1건 */
export interface AuthorRecentPost {
    bo_table: string;
    wr_id: number;
    wr_subject: string;
    wr_datetime: string;
    href: string;
}

/** 작성자 프로필이 노출되면 안 되는 익명 게시판 */
const ANONYMOUS_BOARDS = new Set(['message']);

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

/**
 * 활동 데이터에서 SSR 노출 대상 최근 글 limit개를 선별한다.
 * 입력이 비정형이어도 크래시 없이 빈 배열로 수렴한다.
 */
export function selectAuthorRecentPosts(
    activity: MemberActivity,
    currentBoardId: string,
    currentPostId: string,
    limit = 3
): AuthorRecentPost[] {
    const result: AuthorRecentPost[] = [];

    for (const raw of activity.recentPosts) {
        if (result.length >= limit) break;
        if (!isRecord(raw)) continue;

        const boTable = typeof raw.bo_table === 'string' ? raw.bo_table : '';
        const wrId = Number(raw.wr_id);
        if (!boTable || !Number.isFinite(wrId) || wrId <= 0) continue;

        // 삭제된 글 제외
        if (raw.deleted_at) continue;
        // 익명 게시판 글 제외
        if (ANONYMOUS_BOARDS.has(boTable)) continue;
        // 현재 글 제외
        if (boTable === currentBoardId && String(wrId) === currentPostId) continue;

        result.push({
            bo_table: boTable,
            wr_id: wrId,
            wr_subject: typeof raw.wr_subject === 'string' ? raw.wr_subject : '',
            wr_datetime: typeof raw.wr_datetime === 'string' ? raw.wr_datetime : '',
            href: typeof raw.href === 'string' && raw.href ? raw.href : `/${boTable}/${wrId}`
        });
    }

    return result;
}
