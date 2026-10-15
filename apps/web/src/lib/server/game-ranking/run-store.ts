/**
 * 발급한 판(runId·seed) 보관 — Redis. 여러 파드가 같이 써도 안전하다.
 *
 * 키 (CACHE_NAMESPACE 가 있으면 앞에 붙는다 — 카나리와 운영이 섞이지 않게)
 * - game:run:{runId}            판 JSON {runId, seed, mbId, gameId, variant, startedAt}. SET NX EX 2시간
 * - game:cur:{gameId}:{mbId}    그 회원의 지금 판 runId. EX 2시간. 새 판을 받으면 덮어써 이전 판은 무효(동시 1판)
 * - game:gap:{gameId}:{mbId}    시작 간격. SET NX PX 5초 — 있으면 새 판을 주지 않는다
 *
 * 꺼낼 때(take)는 Lua 하나로 「판이 있고 · 내 판이고 · 지금 판이면」 두 키를 지우고 돌려준다 → 1회용.
 * 남의 판은 지우지 않는다(남의 runId 로 그 사람 판을 날리지 못하게).
 */
import { getRedis } from '$lib/server/redis';
import { redisKey } from '$lib/server/cache';

/** 판 수명 */
export const RUN_TTL_SEC = 2 * 60 * 60;
/** 회원당 시작 간격 */
export const START_GAP_MS = 5000;
/** Redis 응답 대기 상한 — 넘으면 「준비 안 됨」으로 본다(게임은 로컬로 계속) */
const REDIS_TIMEOUT_MS = 1500;

export interface IssuedRun {
    runId: string;
    seed: number;
    mbId: string;
    gameId: string;
    variant: string;
    /** 서버 시각(ms) */
    startedAt: number;
}

export interface RunStore {
    /** 새 판을 맡긴다. 시작 간격 안이면 'rate_limited' */
    issue(run: IssuedRun): Promise<'ok' | 'rate_limited'>;
    /** 판을 꺼낸다(1회). 없음·남의 판·지난 판이면 null */
    take(gameId: string, mbId: string, runId: string): Promise<IssuedRun | null>;
}

export function runKey(runId: string): string {
    return redisKey('game:run', runId);
}

export function curKey(gameId: string, mbId: string): string {
    return redisKey('game:cur', `${gameId}:${mbId}`);
}

export function gapKey(gameId: string, mbId: string): string {
    return redisKey('game:gap', `${gameId}:${mbId}`);
}

/**
 * KEYS[1]=run 키, KEYS[2]=cur 키 / ARGV[1]=runId, ARGV[2]=mbId, ARGV[3]=gameId
 * 돌려주는 값: 판 JSON 또는 nil
 */
const TAKE_SCRIPT = `
local v = redis.call('GET', KEYS[1])
if not v then return false end
local ok, run = pcall(cjson.decode, v)
if not ok or type(run) ~= 'table' then return false end
if run.mbId ~= ARGV[2] or run.gameId ~= ARGV[3] or run.runId ~= ARGV[1] then return false end
redis.call('DEL', KEYS[1])
if redis.call('GET', KEYS[2]) ~= ARGV[1] then return false end
redis.call('DEL', KEYS[2])
return v
`;

function withTimeout<T>(p: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const t = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('redis timeout')), REDIS_TIMEOUT_MS);
        timer.unref?.();
    });
    return Promise.race([p, t]).finally(() => clearTimeout(timer));
}

function parseRun(raw: unknown): IssuedRun | null {
    if (typeof raw !== 'string') return null;
    try {
        const r = JSON.parse(raw) as Partial<IssuedRun>;
        if (
            typeof r.runId !== 'string' ||
            typeof r.mbId !== 'string' ||
            typeof r.gameId !== 'string' ||
            typeof r.variant !== 'string' ||
            typeof r.seed !== 'number' ||
            typeof r.startedAt !== 'number'
        ) {
            return null;
        }
        return r as IssuedRun;
    } catch {
        return null;
    }
}

/** Redis 판 보관소 */
export const redisRunStore: RunStore = {
    async issue(run) {
        const redis = getRedis();
        const gap = await withTimeout(
            redis.set(gapKey(run.gameId, run.mbId), '1', 'PX', START_GAP_MS, 'NX')
        );
        if (gap !== 'OK') return 'rate_limited';
        const set = await withTimeout(
            redis.set(runKey(run.runId), JSON.stringify(run), 'EX', RUN_TTL_SEC, 'NX')
        );
        if (set !== 'OK') throw new Error('run id collision');
        await withTimeout(redis.set(curKey(run.gameId, run.mbId), run.runId, 'EX', RUN_TTL_SEC));
        return 'ok';
    },
    async take(gameId, mbId, runId) {
        const redis = getRedis();
        const raw = await withTimeout(
            redis.eval(TAKE_SCRIPT, 2, runKey(runId), curKey(gameId, mbId), runId, mbId, gameId)
        );
        return parseRun(raw);
    }
};
