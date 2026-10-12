/**
 * 앙쌓기 점수판 — 공개 GET /stack-ws/leaderboard?board=… (인증 불요, 닉네임만 공개).
 *
 *   혼자하기 줄: { rank, nickname, score, lines, level, achievedAt? }
 *   대전 줄:     { rank, nickname, rating, wins, losses, draws }
 *
 * achievedAt 은 기록을 세운 시각(RFC3339, 서버는 +09:00 으로 준다). 예전 서버는 이 필드가 없다 → 빈칸.
 * 시각은 브라우저 시간대와 상관없이 항상 한국 시간(KST, UTC+9)으로 보여 준다.
 */
import { STACK_API_BASE } from './solo-record';

export type BoardId = 'solo_week' | 'solo_all' | 'vs_attack' | 'vs_sprint40' | 'vs_survival';

/** 점수판 한 장에 보여 주는 줄 수 */
export const LEADERBOARD_SIZE = 10;

export interface SoloRow {
    rank: number;
    nickname: string;
    score: number;
    lines: number;
    level: number;
    /** 기록을 세운 시각(RFC3339). 예전 서버 응답에는 없다 */
    achievedAt?: string;
}

export interface VersusRow {
    rank: number;
    nickname: string;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
}

export interface LeaderboardData {
    rows: Array<SoloRow | VersusRow>;
    weekStart?: string;
}

/** 한국 표준시 오프셋(일광절약 없음) */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
/** 시간대가 붙은 RFC3339 만 받는다 — 시간대 없는 문자열은 브라우저마다 해석이 달라서 버린다 */
const RFC3339_WITH_ZONE =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

/** 순간(ms)을 KST 달력 칸으로 — getUTC* 로 읽으므로 브라우저 시간대가 끼어들지 않는다 */
function kstParts(ms: number) {
    const d = new Date(ms + KST_OFFSET_MS);
    return {
        y: d.getUTCFullYear(),
        mo: d.getUTCMonth() + 1,
        d: d.getUTCDate(),
        h: d.getUTCHours(),
        mi: d.getUTCMinutes()
    };
}

function pad2(n: number): string {
    return n < 10 ? `0${n}` : String(n);
}

/**
 * 기록 시각을 KST 로 짧게 쓴다 — 오늘(KST)이면 `HH:mm`, 아니면 `M월 D일 HH:mm`.
 * 비었거나 형식이 틀리면 빈 문자열(표에서 빈칸).
 */
export function formatAchievedAt(iso: unknown, now: Date | number): string {
    if (typeof iso !== 'string' || !RFC3339_WITH_ZONE.test(iso)) return '';
    const ms = Date.parse(iso);
    const nowMs = typeof now === 'number' ? now : now.getTime();
    if (!Number.isFinite(ms) || !Number.isFinite(nowMs)) return '';
    const t = kstParts(ms);
    const today = kstParts(nowMs);
    const hm = `${pad2(t.h)}:${pad2(t.mi)}`;
    if (t.y === today.y && t.mo === today.mo && t.d === today.d) return hm;
    return `${t.mo}월 ${t.d}일 ${hm}`;
}

/**
 * 점수판 한 장을 불러온다(최대 LEADERBOARD_SIZE 줄). 실패하면 throw.
 * fresh=true 면 브라우저 HTTP 캐시를 건너뛴다 — 기록을 낸 직후 다시 볼 때만 쓴다.
 */
export async function fetchLeaderboard(
    board: BoardId,
    opts: { fresh?: boolean; fetchFn?: typeof fetch } = {}
): Promise<LeaderboardData> {
    const fetchFn = opts.fetchFn ?? fetch;
    const r = await fetchFn(
        `${STACK_API_BASE}/leaderboard?board=${board}`,
        opts.fresh ? { cache: 'no-cache' } : undefined
    );
    if (!r.ok) throw new Error(String(r.status));
    const body = await r.json();
    const rows = Array.isArray(body?.rows) ? body.rows.slice(0, LEADERBOARD_SIZE) : [];
    return {
        rows,
        weekStart: typeof body?.weekStart === 'string' ? body.weekStart : undefined
    };
}
