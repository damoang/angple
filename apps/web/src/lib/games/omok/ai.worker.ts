/**
 * 오목 AI 생각을 화면 스레드 밖에서 돌린다 — 고급(3수 앞) 탐색 중에도 화면이 멈추지 않게.
 * 요청: { id, board, difficulty } → 응답: { id, move }
 */
import { getAiMove, type Board, type Difficulty, type Move } from './ai';

interface AiRequest {
    id: number;
    board: Board;
    difficulty: Difficulty;
}

const scope = self as unknown as {
    onmessage: ((e: MessageEvent<AiRequest>) => void) | null;
    postMessage: (msg: { id: number; move: Move }) => void;
};

scope.onmessage = (e) => {
    const { id, board, difficulty } = e.data;
    scope.postMessage({ id, move: getAiMove(board, difficulty) });
};
