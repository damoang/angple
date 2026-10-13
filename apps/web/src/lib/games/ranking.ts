/**
 * 온라인 대전 랭킹(장기·오목 공용) — 응답 정리·내 순위 한 줄 만들기 (순수 함수).
 *
 * 공개 API `GET /{game}-ws/ranking` 응답: { ranking: [{ nickname, wins, losses, draws, rating }] }
 * 서버는 점수 상위 20명만 준다.
 */

export interface RankingRow {
    nickname: string;
    wins: number;
    losses: number;
    draws: number;
    rating: number;
}

/** 카드에 평소 보여 주는 줄 수 */
export const RANKING_TOP = 10;
/** 서버가 주는 최대 줄 수 */
export const RANKING_MAX = 20;

/** 응답을 표시용 줄로 정리한다 — 모양이 이상하면 빈 배열, 닉네임 없는 줄은 버린다 */
export function toRankingRows(data: unknown): RankingRow[] {
    const list = (data as { ranking?: unknown } | null)?.ranking;
    if (!Array.isArray(list)) return [];
    return list
        .map((r: Record<string, unknown> | null) => ({
            nickname: String(r?.nickname ?? '').trim(),
            wins: Number(r?.wins) || 0,
            losses: Number(r?.losses) || 0,
            draws: Number(r?.draws) || 0,
            rating: Number(r?.rating) || 0
        }))
        .filter((r) => r.nickname !== '')
        .slice(0, RANKING_MAX);
}

/** 내 닉네임의 순위 자리(0부터), 없거나 비로그인이면 -1 */
export function findMyIndex(rows: RankingRow[], myNick: string): number {
    if (!myNick) return -1;
    return rows.findIndex((r) => r.nickname === myNick);
}

/** 내 순위 한 줄 (myNick 이 빈 문자열이면 비로그인) */
export function myRankLine(rows: RankingRow[], myNick: string): string {
    if (!myNick) return '로그인하고 온라인 대전에서 순위에 도전해 보세요';
    const i = findMyIndex(rows, myNick);
    if (i >= 0) {
        const r = rows[i];
        return `내 순위 ${i + 1}위 · ${r.wins}승 ${r.losses}패 ${r.draws}무 · ${r.rating}점`;
    }
    // 공개 API 는 상위 20명만 준다 — 그 밖이면 정확한 순위를 알 수 없다
    return rows.length >= RANKING_MAX
        ? `내 순위: TOP ${rows.length} 밖 — 온라인 대전에서 점수를 올려 보세요`
        : '아직 순위에 없어요 — 온라인 대전 첫 판으로 이름을 올려 보세요';
}

/** 제목의 TOP 숫자 — 실제로 보여 주는 줄 수 */
export function rankingTitleCount(rows: RankingRow[], expanded: boolean): number {
    return expanded ? rows.length : Math.min(RANKING_TOP, rows.length);
}
