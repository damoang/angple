/**
 * 장기 AI 호출부 — 브라우저에선 Web Worker 로, Worker 를 못 쓰면 메인 스레드로 탐색한다.
 * SSR 에선 Worker 를 만들지 않는다(호출 자체가 브라우저 이벤트에서만 일어난다).
 */
import { searchBestMove, THINK_TIME_LIMIT_MS, type Difficulty, type SearchResult } from './ai';
import type { JanggiPiece } from './rules';
import type { AiWorkerRequest, AiWorkerResponse } from './ai.worker';

/** Worker 가 상한보다 이만큼 더 늦으면 고장으로 보고 메인 스레드로 넘어간다. */
const WORKER_GRACE_MS = 2500;
/** 메인 스레드 폴백 시 생각 시간 상한 — 화면 멈춤을 짧게. */
const FALLBACK_TIME_LIMIT_MS = 1500;

export interface JanggiAi {
    think(
        pieces: JanggiPiece[],
        team: number,
        difficulty: Difficulty
    ): Promise<SearchResult | null>;
    dispose(): void;
}

function runOnMainThread(
    pieces: JanggiPiece[],
    team: number,
    difficulty: Difficulty
): Promise<SearchResult | null> {
    return new Promise((resolve) => {
        // 「생각 중…」 표시가 먼저 그려지도록 한 틱 미룬다.
        setTimeout(() => {
            try {
                resolve(
                    searchBestMove(pieces, team, difficulty, {
                        timeLimitMs: FALLBACK_TIME_LIMIT_MS
                    })
                );
            } catch {
                resolve(null);
            }
        }, 30);
    });
}

export function createJanggiAi(): JanggiAi {
    let worker: Worker | null = null;
    let workerBroken = false;
    let seq = 0;
    let disposed = false;
    const pending = new Map<number, (r: AiWorkerResponse | null) => void>();

    function ensureWorker(): Worker | null {
        if (worker || workerBroken) return worker;
        if (typeof window === 'undefined' || typeof Worker === 'undefined') {
            workerBroken = true;
            return null;
        }
        try {
            worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
            worker.onmessage = (e: MessageEvent<AiWorkerResponse>) => {
                const cb = pending.get(e.data.id);
                if (cb) {
                    pending.delete(e.data.id);
                    cb(e.data);
                }
            };
            worker.onerror = () => {
                workerBroken = true;
                worker?.terminate();
                worker = null;
                for (const cb of pending.values()) cb(null);
                pending.clear();
            };
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
    ): Promise<SearchResult | null> {
        const plain = pieces.map((p) => ({
            kind: p.kind,
            team: p.team,
            x: p.x,
            y: p.y,
            alive: p.alive
        }));
        const w = ensureWorker();
        if (!w) return runOnMainThread(plain, team, difficulty);

        const id = ++seq;
        const response = await new Promise<AiWorkerResponse | null>((resolve) => {
            const timer = setTimeout(() => {
                if (pending.has(id)) {
                    pending.delete(id);
                    resolve(null);
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
                resolve(null);
            }
        });

        if (response && !response.error) return response.result;
        if (disposed) return null;
        // Worker 고장·지연 — 이번 판은 메인 스레드로 이어 간다.
        workerBroken = true;
        worker?.terminate();
        worker = null;
        return runOnMainThread(plain, team, difficulty);
    }

    function dispose() {
        disposed = true;
        worker?.terminate();
        worker = null;
        for (const cb of pending.values()) cb(null);
        pending.clear();
    }

    return { think, dispose };
}
