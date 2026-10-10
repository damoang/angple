/**
 * 앙쌓기 대전 — 내 엔진을 돌리며 서버로 보낼 메시지를 만든다. DOM·소켓 없음.
 *
 * - 조각이 굳을 때만 lock 을 보낸다(seq 는 1부터 하나씩). board 는 줄을 지운 뒤, 방해 줄을 넣기 전의 판.
 * - 시간이 지나면 빨라지는 규칙은 틱마다 최소 레벨을 맞춘다(levelFloor).
 * - 판이 넘치면 topped_out 을 한 번만 보낸다.
 * - 서버가 보낸 garbage_apply 는 engine.addGarbage 로 넣는다.
 */
import { addGarbage, createGame, step, type Game } from './engine';
import { encodeBoard, levelFloor, type ClientMessage, type RuleDef } from './versus';

export interface VersusPlayer {
    game: Game;
    rule: RuleDef;
    /** 마지막으로 보낸 lock 번호 */
    seq: number;
    /** topped_out 을 보냈는가 */
    toppedOut: boolean;
}

export interface VersusTickResult {
    /** 다시 그려야 하는가 */
    dirty: boolean;
    /** 이번 틱에 지운 줄 수 */
    cleared: number;
    /** 서버로 보낼 메시지 (보통 비어 있다) */
    out: ClientMessage[];
}

export function createVersusPlayer(seed: number, rule: RuleDef): VersusPlayer {
    return { game: createGame(seed >>> 0), rule, seq: 0, toppedOut: false };
}

function toppedOutMessage(p: VersusPlayer): ClientMessage[] {
    if (!p.game.over || p.toppedOut) return [];
    p.toppedOut = true;
    return [{ type: 'topped_out', data: { seq: p.seq, tick: p.game.tick } }];
}

/** 고정 틱 하나 — input 은 engine 의 IN_* 비트 */
export function versusTick(p: VersusPlayer, input: number): VersusTickResult {
    const g = p.game;
    if (g.over) return { dirty: false, cleared: 0, out: toppedOutMessage(p) };
    const floor = levelFloor(p.rule, g.tick);
    if (g.level < floor) g.level = floor;
    const r = step(g, input);
    const out: ClientMessage[] = [];
    if (r.locked) {
        p.seq++;
        out.push({
            type: 'lock',
            data: {
                seq: p.seq,
                tick: g.tick,
                cleared: r.cleared,
                board: encodeBoard(g.board),
                score: g.score,
                lines: g.lines
            }
        });
    }
    out.push(...toppedOutMessage(p));
    return { dirty: r.dirty, cleared: r.cleared, out };
}

/** 서버의 garbage_apply 를 넣는다. 그 바람에 판이 넘치면 topped_out 을 돌려준다 */
export function versusGarbage(p: VersusPlayer, lines: number, hole: number): ClientMessage[] {
    if (p.game.over) return [];
    addGarbage(p.game, lines, hole);
    return toppedOutMessage(p);
}

/** 제한 시간(ms)에서 남은 초 — 엔진 틱 기준 (0 아래로 내려가지 않는다) */
export function remainingSeconds(timeLimitMs: number, tick: number): number {
    return Math.max(0, Math.ceil((timeLimitMs - (tick * 1000) / 60) / 1000));
}
