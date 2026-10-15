/**
 * 벽돌깨기 입력 기록(GameLog) 압축 — 기록을 서버에 보낼 때만 쓴다(판 진행·재연 규칙은 engine.ts 그대로).
 *
 * 엔진의 기록은 이미 「막대 목표 x 가 바뀐 틱만」(x = 논리 px 정수 0~360)이다. 이것을 JSON 숫자 배열로
 * 보내면 한 번 바뀔 때마다 10글자 안팎이라, 막대를 계속 움직이는 긴 판은 수 MB 가 된다.
 * 그래서 틱은 앞 기록과의 차이로, x 는 그대로 base64url 글자로 적는다.
 *
 * 형식 (글자 하나 = 6비트, 알파벳 A-Z a-z 0-9 - _)
 * - moves(m): 바뀐 틱마다 2글자 = 12비트 = (min(틱차−1, 7) << 9) | x.
 *   틱차−1 이 7 이상이면 그 뒤에 (틱차 − 8) 을 가변 길이 정수로 붙인다.
 *   틱차는 직전 바뀐 틱(처음은 −1)과의 차이라 늘 1 이상이다.
 * - launches(l): 쏜 틱마다 (틱차 − 1) 을 가변 길이 정수로. 틱차는 직전 발사 틱(처음은 −1)과의 차이.
 * - 가변 길이 정수: 글자 하나에 5비트, 32 비트(값 32)가 서 있으면 다음 글자가 이어진다. 낮은 자리부터.
 *
 * 크기 상한: 바뀐 틱 하나가 2글자를 넘는 것은 틱차가 8 이상일 때뿐이라, 기록 전체는 판 길이(틱) × 2 글자를
 * 넘지 않는다(최대 판 1시간 = 216,000틱 → moves 432,000글자). 발사는 판마다 몇 번뿐이다.
 */
import { FIELD_W, type GameLog } from './engine';

/** 압축 형식 버전 — 바꾸면 서버 등록부의 엔진 버전도 올린다 */
export const LOG_CODEC_VERSION = 1;

/** 보낼 때의 모양 */
export interface EncodedLog {
    /** moves */
    m: string;
    /** launches */
    l: string;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const DECODE: Record<string, number> = {};
for (let k = 0; k < ALPHABET.length; k++) DECODE[ALPHABET[k]] = k;

/** 가변 길이 정수 글자 수 상한 — 5비트 × 7 = 35비트(틱은 이보다 훨씬 작다) */
const VARINT_MAX_CHARS = 7;
/** x 자리 비트 수 (0~511 → 0~360 만 쓴다) */
const X_BITS = 9;
const X_MASK = (1 << X_BITS) - 1;
/** 2글자 안에 들어가는 틱차−1 의 최댓값 — 이 값이면 뒤에 나머지를 붙인다 */
const DT_INLINE_MAX = 7;

function pushVarint(out: string[], n: number): void {
    let v = n;
    while (v >= 32) {
        out.push(ALPHABET[32 | v % 32]);
        v = Math.floor(v / 32);
    }
    out.push(ALPHABET[v]);
}

/** 기록을 글자로 — 엔진이 남긴 기록(틱 오름차순)만 넣는다 */
export function encodeLog(log: GameLog): EncodedLog {
    const m: string[] = [];
    let prev = -1;
    for (let k = 0; k + 1 < log.moves.length; k += 2) {
        const t = log.moves[k];
        const x = log.moves[k + 1];
        const d = t - prev - 1;
        prev = t;
        const inline = Math.min(d, DT_INLINE_MAX);
        const v = (inline << X_BITS) | (x & X_MASK);
        m.push(ALPHABET[v >> 6], ALPHABET[v & 63]);
        if (inline === DT_INLINE_MAX) pushVarint(m, d - DT_INLINE_MAX);
    }
    const l: string[] = [];
    prev = -1;
    for (const t of log.launches) {
        pushVarint(l, t - prev - 1);
        prev = t;
    }
    return { m: m.join(''), l: l.join('') };
}

/** 글자 하나 → 6비트 값. 알파벳 밖이면 -1 */
function sym(s: string, i: number): number {
    const v = DECODE[s[i]];
    return v === undefined ? -1 : v;
}

/** s[i] 부터 가변 길이 정수 하나 — [값, 다음 위치] 또는 null(잘못된 글자·너무 김·끝남) */
function readVarint(s: string, start: number): [number, number] | null {
    let v = 0;
    let mul = 1;
    for (let n = 0; n < VARINT_MAX_CHARS; n++) {
        const i = start + n;
        if (i >= s.length) return null;
        const c = sym(s, i);
        if (c < 0) return null;
        v += (c & 31) * mul;
        if ((c & 32) === 0) return [v, i + 1];
        mul *= 32;
    }
    return null;
}

/**
 * 글자 → 기록. 모양이 틀리면(글자·길이·x 범위·틱이 maxTick 을 넘음) null.
 * 순서·중복 같은 규칙 검사는 engine.replay 가 다시 한다.
 */
export function decodeLog(enc: unknown, maxTick: number): GameLog | null {
    if (!enc || typeof enc !== 'object') return null;
    const { m, l } = enc as { m?: unknown; l?: unknown };
    if (typeof m !== 'string' || typeof l !== 'string') return null;
    const moves: number[] = [];
    let prev = -1;
    let i = 0;
    while (i < m.length) {
        if (i + 1 >= m.length) return null;
        const hi = sym(m, i);
        const lo = sym(m, i + 1);
        if (hi < 0 || lo < 0) return null;
        i += 2;
        const v = (hi << 6) | lo;
        const x = v & X_MASK;
        let d = v >> X_BITS;
        if (x > FIELD_W) return null;
        if (d === DT_INLINE_MAX) {
            const r = readVarint(m, i);
            if (!r) return null;
            d += r[0];
            i = r[1];
        }
        const t = prev + d + 1;
        if (t > maxTick) return null;
        moves.push(t, x);
        prev = t;
    }
    const launches: number[] = [];
    prev = -1;
    i = 0;
    while (i < l.length) {
        const r = readVarint(l, i);
        if (!r) return null;
        const t = prev + r[0] + 1;
        if (t > maxTick) return null;
        launches.push(t);
        prev = t;
        i = r[1];
    }
    return { moves, launches };
}
