/**
 * 오목 AI 수 요청 — Worker 가 되면 Worker 에서, 안 되면 화면 스레드에서 계산한다.
 *
 * Worker 는 인라인(blob:)으로 띄운다. 정적 파일이 다른 도메인(CDN)에서 오면
 * `new Worker(url)` 가 동일 출처 규칙에 막히기 때문이다(CSP worker-src 는 'self' blob: 허용).
 * Worker 가 만들어지지 않거나 오류·무응답이면 화면 스레드에서 짧은 시간 상한으로 계산한다.
 *
 * 게임 판(컴포넌트)마다 하나씩 만들고, 판이 사라질 때 dispose() 한다.
 */
import { getAiMove, type Board, type Difficulty, type Move } from './ai';

/** Worker 응답을 기다리는 최대 시간 — 탐색 상한(1.5초)보다 넉넉히 */
const WORKER_TIMEOUT_MS = 4000;
/** 화면 스레드 대체 계산의 시간 상한 — 길게 멈추지 않게 짧게 */
const MAIN_THREAD_LIMIT_MS = 600;

export interface AiClient {
    /** board 는 평범한 배열이어야 한다($state 프록시는 Worker 로 못 보낸다 — 복사해서 넘긴다) */
    request(board: Board, difficulty: Difficulty): Promise<Move>;
    dispose(): void;
}

function fallback(board: Board, difficulty: Difficulty): Move {
    return getAiMove(board, difficulty, { timeLimitMs: MAIN_THREAD_LIMIT_MS });
}

export function createAiClient(): AiClient {
    let worker: Worker | null = null;
    let failed = false;
    let seq = 0;

    async function getWorker(): Promise<Worker | null> {
        if (failed || typeof window === 'undefined' || typeof Worker === 'undefined') return null;
        if (worker) return worker;
        try {
            const mod = await import('./ai.worker?worker&inline');
            worker = new mod.default({ name: 'omok-ai' });
            return worker;
        } catch {
            failed = true;
            return null;
        }
    }

    function dispose() {
        worker?.terminate();
        worker = null;
    }

    async function request(board: Board, difficulty: Difficulty): Promise<Move> {
        const w = await getWorker();
        if (!w) return fallback(board, difficulty);
        const id = ++seq;
        return new Promise<Move>((resolve) => {
            let done = false;
            let timer: ReturnType<typeof setTimeout> | undefined;
            const finish = (move: Move) => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                w.removeEventListener('message', onMessage);
                w.removeEventListener('error', onError);
                resolve(move);
            };
            const giveUp = () => {
                // 고장 난 Worker 는 버리고 이번 수부터 화면 스레드에서 계산한다
                failed = true;
                dispose();
                finish(fallback(board, difficulty));
            };
            const onMessage = (e: MessageEvent<{ id: number; move: Move }>) => {
                if (e.data?.id === id) finish(e.data.move);
            };
            const onError = () => giveUp();
            timer = setTimeout(giveUp, WORKER_TIMEOUT_MS);
            w.addEventListener('message', onMessage);
            w.addEventListener('error', onError);
            try {
                w.postMessage({ id, board, difficulty });
            } catch {
                giveUp();
            }
        });
    }

    return { request, dispose };
}
