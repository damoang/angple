/**
 * 최저 유일 번호 순수 로직 — 백엔드 domain/giving/method.go 와 동작 일치.
 * 서버가 권위이나, 종료 후 전량 공개 시 클라이언트가 당첨을 재계산·검증할 수 있게 한다.
 */

/**
 * "1,3,5-10,15~20" 형식을 정렬·중복제거된 양의 정수 배열로 파싱.
 * 0으로만 된 토큰·소숫점 토큰은 무시. 레거시 parseAndValidateBidNumbers 이식.
 */
export function parseBidNumbers(input: string): number[] {
    const seen = new Set<number>();
    for (const rawPart of input.split(',')) {
        const part = rawPart.trim();
        if (!part) continue;
        if (part.includes('.') || /^0+$/.test(part)) continue;
        if (part.includes('-') || part.includes('~')) {
            const m = part.split(/[-~]/);
            if (m.length === 2) {
                const start = parseIntSafe(m[0]);
                const end = parseIntSafe(m[1]);
                if (start > 0 && end > 0 && start <= end) {
                    for (let i = start; i <= end; i++) {
                        seen.add(i);
                        if (seen.size >= 100000) break;
                    }
                }
            }
            continue;
        }
        const n = parseIntSafe(part);
        if (n > 0) seen.add(n);
    }
    return [...seen].sort((a, b) => a - b);
}

function parseIntSafe(s: string): number {
    const n = parseInt(s.trim(), 10);
    return Number.isFinite(n) ? n : 0;
}

export interface LowestUniqueResult {
    hasWinner: boolean;
    winningNumber: number | null;
    winnerMbId: string | null;
}

/**
 * bidsByNumber: 번호 → 그 번호를 고른 mb_id 목록.
 * 정확히 1명이 고른 번호가 "유일 번호"이며, 그 중 최저 번호 보유자가 당첨.
 */
export function lowestUniqueWinner(bidsByNumber: Map<number, string[]>): LowestUniqueResult {
    const uniques: number[] = [];
    for (const [num, bidders] of bidsByNumber) {
        if (bidders.length === 1) uniques.push(num);
    }
    if (uniques.length === 0) {
        return { hasWinner: false, winningNumber: null, winnerMbId: null };
    }
    uniques.sort((a, b) => a - b);
    const win = uniques[0];
    return {
        hasWinner: true,
        winningNumber: win,
        winnerMbId: bidsByNumber.get(win)![0]
    };
}

/** 응모 스냅샷 목록에서 번호별 응모자 맵을 구성. */
export function buildBidsByNumber(
    bids: Array<{ mb_id: string; numbers: string }>
): Map<number, string[]> {
    const map = new Map<number, string[]>();
    for (const b of bids) {
        for (const n of parseBidNumbers(b.numbers)) {
            const arr = map.get(n);
            if (arr) arr.push(b.mb_id);
            else map.set(n, [b.mb_id]);
        }
    }
    return map;
}
