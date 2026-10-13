/**
 * 장기 AI 호출부 — 브라우저에선 Web Worker 로, Worker 를 못 쓰면 메인 스레드로 탐색한다.
 *
 * Worker 는 `?worker&inline`(blob URL)으로 띄운다. 정적 파일이 다른 출처에서 서빙되면
 * `new Worker(url)` 가 동일 출처 규칙에 막히기 때문이다(CSP worker-src 는 'self' blob: 허용).
 * 동적 import 라 SSR 에선 Worker 코드를 불러오지 않는다.
 */
import { searchBestMove, THINK_TIME_LIMIT_MS, type Difficulty, type SearchResult } from './ai';
import type { JanggiPiece } from './rules';
import type { AiWorkerRequest, AiWorkerResponse } from './ai.worker';

/** Worker 가 상한보다 이만큼 더 늦으면 고장으로 보고 메인 스레드로 넘어간다. */
const WORKER_GRACE_MS = 2500;
/** 메인 스레드 폴백 시 생각 시간 상한 — 화면 멈춤을 짧게. */
const FALLBACK_TIME_LIMIT_MS = 1500;

export type ThinkOutcome =
    | { kind: 'move'; result: SearchResult }
    /** 합법수 없음 = 외통 */
    | { kind: 'none' }
    /** 탐색 자체가 실패 — 호출부가 대체 수를 둔다 */
    | { kind: 'error' }
    /** reset()/dispose() 로 취소됨 — 무시 */
    | { kind: 'cancelled' };

export interface JanggiAi {
    think(pieces: JanggiPiece[], team: number, difficulty: Difficulty): Promise<ThinkOutcome>;
    /** 진행 중 탐색을 버리고 Worker 를 새로 띄울 준비를 한다(새 판·설정 바꾸기). */
    reset(): void;
    dispose(): void;
}

function toOutcome(result: SearchResult | null): ThinkOutcome {
    return result ? { kind: 'move', result } : { kind: 'none' };
}

function runOnMainThread(
    pieces: JanggiPiece[],
    team: number,
    difficulty: Difficulty
): Promise<ThinkOutcome> {
    return new Promise((resolve) => {
        // 「생각 중…」 표시가 먼저 그려지도록 한 틱 미룬다.
        setTimeout(() => {
            try {
                resolve(
                    toOutcome(
                        searchBestMove(pieces, team, difficulty, {
                            timeLimitMs: FALLBACK_TIME_LIMIT_MS
                        })
                    )
                );
            } catch {
                resolve({ kind: 'error' });
            }
        }, 30);
    });
}

type Pending = (r: AiWorkerResponse | 'cancelled' | 'failed') => void;

export function createJanggiAi(): JanggiAi {
    let worker: Worker | null = null;
    let workerBroken = false;
    let seq = 0;
    // 새 판마다 올린다 — 이전 판 탐색 결과는 버린다.
    let epoch = 0;
    const pending = new Map<number, Pending>();

    function settleAll(reason: 'cancelled' | 'failed') {
        const cbs = [...pending.values()];
        pending.clear();
        for (const cb of cbs) cb(reason);
    }

    function killWorker() {
        worker?.terminate();
        worker = null;
    }

    async function ensureWorker(): Promise<Worker | null> {
        if (worker || workerBroken) return worker;
        if (typeof window === 'undefined' || typeof Worker === 'undefined') {
            workerBroken = true;
            return null;
        }
        try {
            const mod = await import('./ai.worker?worker&inline');
            if (worker) return worker;
            const w: Worker = new mod.default({ name: 'janggi-ai' });
            w.onmessage = (e: MessageEvent<AiWorkerResponse>) => {
                const cb = pending.get(e.data.id);
                if (cb) {
                    pending.delete(e.data.id);
                    cb(e.data);
                }
            };
            w.onerror = () => {
                workerBroken = true;
                if (worker === w) killWorker();
                settleAll('failed');
            };
            worker = w;
        } catch {
            workerBroken = true;
            worker = null;
        }
        return worker;
    }

    async function think(
        pieces: JanggiPiece[],
        team: number,
        difficulty: Difficulty
    ): Promise<ThinkOutcome> {
        const myEpoch = epoch;
        const plain = pieces.map((p) => ({
            kind: p.kind,
            team: p.team,
            x: p.x,
            y: p.y,
            alive: p.alive
        }));
        const w = await ensureWorker();
        if (myEpoch !== epoch) return { kind: 'cancelled' };
        if (!w) return runOnMainThread(plain, team, difficulty);

        const id = ++seq;
        const response = await new Promise<AiWorkerResponse | 'cancelled' | 'failed'>((resolve) => {
            const timer = setTimeout(() => {
                if (pending.has(id)) {
                    pending.delete(id);
                    resolve('failed');
                }
            }, THINK_TIME_LIMIT_MS + WORKER_GRACE_MS);
            pending.set(id, (r) => {
                clearTimeout(timer);
                resolve(r);
            });
            const req: AiWorkerRequest = {
                id,
                pieces: plain,
                team,
                difficulty,
                timeLimitMs: THINK_TIME_LIMIT_MS
            };
            try {
                w.postMessage(req);
            } catch {
                pending.delete(id);
                clearTimeout(timer);
                resolve('failed');
            }
        });

        if (response === 'cancelled' || myEpoch !== epoch) return { kind: 'cancelled' };
        if (response !== 'failed' && !response.error) return toOutcome(response.result);
        // Worker 고장·지연 — 이번 수부터 메인 스레드로 이어 간다.
        workerBroken = true;
        killWorker();
        return runOnMainThread(plain, team, difficulty);
    }

    function reset() {
        epoch++;
        // 돌던 탐색이 다음 요청을 늦추지 않도록 Worker 를 버리고, 다음 think 때 새로 띄운다.
        if (pending.size > 0) killWorker();
        settleAll('cancelled');
    }

    function dispose() {
        epoch++;
        killWorker();
        settleAll('cancelled');
    }

    return { think, reset, dispose };
}
