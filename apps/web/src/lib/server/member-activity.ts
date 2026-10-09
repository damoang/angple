/**
 * 작성자 최근 활동 서버사이드 조회 (SSR용)
 *
 * routes/api/members/[id]/activity/+server.ts 의 백엔드 호출 로직을 공유 모듈로 추출.
 * +page.server.ts 에서 SSR 스트리밍으로 직접 호출하여 클릭-API(CDN 요청)를 제거한다.
 * 최고 트래픽 페이지(글 상세)이므로 per-author Redis 캐시(60s)로 origin/DB 부하를 억제한다.
 */
import { backendFetch } from '$lib/server/backend-fetch';
import { getRedis } from '$lib/server/redis';
import { encodeEmails, stripEmailMarkers } from '$lib/utils/email-reveal.js';

export interface MemberActivity {
    recentPosts: unknown[];
    recentComments: unknown[];
}

const EMPTY: MemberActivity = { recentPosts: [], recentComments: [] };
const CACHE_TTL_SEC = 60;

/**
 * 최근 댓글 미리보기(평문)의 이메일 주소를 「[이메일]」로 가린다 — 본문·댓글의 「이메일 보기」
 * 처리(utils/email-reveal.ts)와 같은 수집 방지. 미리보기는 글자 그대로 표시되므로 버튼 대신 글자.
 */
export function maskActivityEmails<T extends { recentComments?: unknown }>(data: T): T {
    if (!Array.isArray(data.recentComments)) return data;
    for (const c of data.recentComments as Array<{ preview?: unknown } | null>) {
        if (c && typeof c.preview === 'string') {
            c.preview = stripEmailMarkers(encodeEmails(c.preview));
        }
    }
    return data;
}

/**
 * 작성자(authorId)의 최근 글/댓글을 조회한다. 실패/유효하지 않은 입력 시 빈 결과 반환(크래시 방지).
 */
export async function fetchMemberActivity(authorId: string, limit = 5): Promise<MemberActivity> {
    if (!authorId || !/^[a-zA-Z0-9_-]+$/.test(authorId)) {
        return EMPTY;
    }

    const cacheKey = `member_activity:${authorId}:l${limit}`;

    try {
        const cached = await getRedis().get(cacheKey);
        if (cached) {
            return maskActivityEmails(JSON.parse(cached) as MemberActivity);
        }
    } catch {
        // Redis 장애 → 백엔드 직접 조회로 진행
    }

    try {
        // 스트리밍(auxiliaryData) 블로킹 방지를 위한 타임아웃 — 느린 활동 조회가 본문 렌더를 막지 않게.
        const res = await backendFetch(
            `/api/v1/members/${encodeURIComponent(authorId)}/activity?limit=${limit}`,
            { timeout: 2000 }
        );
        const data = (await res.json()) as Partial<MemberActivity>;
        const result: MemberActivity = maskActivityEmails({
            recentPosts: Array.isArray(data.recentPosts) ? data.recentPosts : [],
            recentComments: Array.isArray(data.recentComments) ? data.recentComments : []
        });
        try {
            await getRedis().setex(cacheKey, CACHE_TTL_SEC, JSON.stringify(result));
        } catch {
            // 캐시 저장 실패는 무시
        }
        return result;
    } catch {
        return EMPTY;
    }
}
