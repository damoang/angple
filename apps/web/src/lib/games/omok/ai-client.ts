/**
 * 오목 AI 수 요청 — Worker 가 되면 Worker 에서, 안 되면 화면 스레드에서 계산한다.
 *
 * Worker 는 인라인(blob:)으로 띄운다. 정적 파일이 다른 도메인(CDN)에서 오면
 * `new Worker(url)` 가 동일 출처 규칙에 막히기 때문이다(CSP worker-src 는 'self' blob: 허용).
 * Worker 가 만들어지지 않거나 오류·무응답이면 화면 스레드에서 짧은 시간 상한으로 계산한다.
 *
 * 게임 판(컴포넌트)마다 하나씩 만들고, 판이 사라질 때 dispose() 한다.
 * dispose() 뒤에는 기다리던 요청이 모두 null 로 끝나고, 화면 스레드 계산도 하지 않는다.
 */
import {
    WHITE,
    getAiMove,
    getCandidates,
    scoreMove,
    type Board,
    type Difficulty,
    type Move
} from './ai';

/** Worker 응답을 기다리는 최대 시간 — 탐색 상한(1.5초)보다 넉넉히 */
const WORKER_TIMEOUT_MS = 4000;
/** 화면 스레드 대체 계산의 시간 상한 — 길게 멈추지 않게 짧게 */
const MAIN_THREAD_LIMIT_MS = 600;

export interface AiClient {
    /**
     * board 는 평범한 배열이어야 한다($state 프록시는 Worker 로 못 보낸다 — 복사해서 넘긴다).
     * dispose() 된 뒤에는 null — 호출자는 아무것도 하지 않으면 된다.
     */
    request(board: Board, difficulty: Difficulty): Promise<Move | null>;
    dispose(): void;
}

/** 탐색이 예외로 죽어도 수는 낸다 — 모양 점수 1위 후보, 그것도 안 되면 첫 빈칸 */
function safeMove(board: Board, difficulty: Difficulty): Move | null {
    try {
        return getAiMove(board, difficulty, { timeLimitMs: MAIN_THREAD_LIMIT_MS });
    } catch {
        try {
            let best: Move | null = null;
            let bestScore = -Infinity;
            for (const m of getCandidates(board)) {
                const s = scoreMove(board, m.x, m.y, WHITE);
                if (s > bestScore) {
                    bestScore = s;
                    best = m;
                }
            }
            if (best) return best;
        } catch {
            // 아래 빈칸 찾기로
        }
        for (let y = 0; y < board.length; y++)
            for (let x = 0; x < board[y].length; x++) if (board[y][x] === 0) return { x, y };
        return null;
    }
}

export function createAiClient(): AiClient {
    let worker: Worker | null = null;
    let failed = false;
    let disposed = false;
    let seq = 0;
    /** 기다리는 요청 — dispose() 때 타이머를 지우고 null 로 끝낸다 */
    const pending = new Map<number, () => void>();

    async function getWorker(): Promise<Worker | null> {
        if (failed || typeof window === 'undefined' || typeof Worker === 'undefined') return null;
        if (worker) return worker;
        try {
            const mod = await import('./ai.worker?worker&inline');
            if (disposed) return null;
            worker = new mod.default({ name: 'omok-ai' });
            return worker;
        } catch {
            failed = true;
            return null;
        }
    }

    function terminateWorker() {
        worker?.terminate();
        worker = null;
    }

    function dispose() {
        disposed = true;
        terminateWorker();
        for (const cancel of [...pending.values()]) cancel();
        pending.clear();
    }

    async function request(board: Board, difficulty: Difficulty): Promise<Move | null> {
        if (disposed) return null;
        const w = await getWorker();
        if (disposed) return null;
        if (!w) return safeMove(board, difficulty);
        const id = ++seq;
        return new Promise<Move | null>((resolve) => {
            let done = false;
            let timer: ReturnType<typeof setTimeout> | undefined;
            const finish = (move: Move | null) => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                pending.delete(id);
                w.removeEventListener('message', onMessage);
                w.removeEventListener('error', onError);
                resolve(move);
            };
            const giveUp = () => {
                // 판이 이미 사라졌으면 계산하지 않는다
                if (done || disposed) return finish(null);
                // 고장 난 Worker 는 버리고 이번 수부터 화면 스레드에서 계산한다
                failed = true;
                terminateWorker();
                finish(safeMove(board, difficulty));
            };
            const onMessage = (e: MessageEvent<{ id: number; move: Move }>) => {
                if (e.data?.id === id) finish(e.data.move ?? null);
            };
            const onError = () => giveUp();
            pending.set(id, () => finish(null));
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
