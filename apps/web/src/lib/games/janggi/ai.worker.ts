/**
 * 장기 AI 탐색 전용 Web Worker — 고급 탐색이 화면을 멈추지 않도록 메인 스레드 밖에서 돈다.
 */
import { searchBestMove, type Difficulty, type SearchResult } from './ai';
import type { JanggiPiece } from './rules';

export interface AiWorkerRequest {
    id: number;
    pieces: JanggiPiece[];
    team: number;
    difficulty: Difficulty;
    timeLimitMs: number;
}

export interface AiWorkerResponse {
    id: number;
    result: SearchResult | null;
    error?: string;
}

const ctx = self as unknown as {
    onmessage: ((e: MessageEvent<AiWorkerRequest>) => void) | null;
    postMessage: (msg: AiWorkerResponse) => void;
};

ctx.onmessage = (e) => {
    const { id, pieces, team, difficulty, timeLimitMs } = e.data;
    try {
        const result = searchBestMove(pieces, team, difficulty, { timeLimitMs });
        ctx.postMessage({ id, result });
    } catch (err) {
        ctx.postMessage({ id, result: null, error: String(err) });
    }
};
