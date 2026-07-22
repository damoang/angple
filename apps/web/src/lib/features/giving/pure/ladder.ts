/**
 * 사다리 순수 재생 로직 — 서버가 result_json 으로 내려준 rungs 를 그대로 시뮬레이션해
 * 각 참가자의 도착 열을 계산한다. 서버(domain/giving/method.go BuildLadder)와 동일한
 * 시뮬레이션이므로 클라이언트가 결과를 검증할 수 있다. 애니메이션은 이 경로의 시각화일 뿐.
 */

export interface LadderData {
    columns: number;
    levels: number;
    rungs: boolean[][]; // rungs[level][gap]
    win_slots: number;
    winners?: string[];
    end_col?: number[];
}

/**
 * rungs 로부터 시작 열별 도착 열을 재계산. 표준 사다리 규칙:
 * 각 레벨에서 현재 열의 오른쪽 가로줄이 있으면 오른쪽, 아니면 왼쪽 가로줄이 있으면 왼쪽.
 */
export function simulateLadder(data: LadderData): number[] {
    const { columns, levels, rungs } = data;
    const out: number[] = [];
    for (let start = 0; start < columns; start++) {
        let c = start;
        for (let l = 0; l < levels; l++) {
            const row = rungs[l] || [];
            if (c < columns - 1 && row[c]) c++;
            else if (c > 0 && row[c - 1]) c--;
        }
        out.push(c);
    }
    return out;
}

/**
 * 참가자 목록 순서 기준으로, 도착 열이 win_slots 미만인 참가자를 당첨자로 반환.
 * 서버 winners 와 일치해야 한다(검증용).
 */
export function ladderWinners(data: LadderData, participants: string[]): string[] {
    const end =
        data.end_col && data.end_col.length === data.columns ? data.end_col : simulateLadder(data);
    const winners: string[] = [];
    for (let i = 0; i < participants.length && i < end.length; i++) {
        if (end[i] < data.win_slots) winners.push(participants[i]);
    }
    return winners.sort();
}

/**
 * 애니메이션용 경로 좌표: 한 시작 열이 레벨을 내려가며 거치는 열 인덱스 시퀀스.
 */
export function ladderPath(data: LadderData, start: number): number[] {
    const { columns, levels, rungs } = data;
    const path: number[] = [start];
    let c = start;
    for (let l = 0; l < levels; l++) {
        const row = rungs[l] || [];
        if (c < columns - 1 && row[c]) c++;
        else if (c > 0 && row[c - 1]) c--;
        path.push(c);
    }
    return path;
}
