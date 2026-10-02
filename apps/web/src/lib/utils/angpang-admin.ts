/**
 * 관리자 앙팡(/admin/angpang) 화면의 순수 함수 — PUT 본문 구성·변경 미리보기·필드 오류·안내 문구.
 *
 * 화면(+page.svelte)에서 판단을 떼어 vitest 로 검증할 수 있게 둔다.
 * ⛔ 여기에 운영값(확률·상한·포인트)을 기본값으로 넣지 않는다. 새 줄은 0·빈칸으로 시작한다.
 */
import {
    LUCKY_BUILTIN_TIERS,
    luckyBaseNameFromConfig,
    luckyTierNamesFromConfig
} from './lucky-badge';

export interface LuckyPrize {
    weight: number;
    points: number;
    exp: number;
}

/** 무작위 단계(하루 한 번 서버가 정한 시각에 열림). 시각은 설정·응답 어디에도 없다. */
export interface LuckyWindow {
    name: string;
    minutes: number;
    odds: number;
    comment_odds: number;
    points: number;
    prizes: LuckyPrize[];
}

/** 고정 시간대. start·end 는 KST "HH:MM", [start, end) — 끝 시각은 포함되지 않는다. */
export interface LuckyFixedWindow {
    name: string;
    start: string;
    end: string;
    odds: number;
    comment_odds: number;
    points: number;
    prizes: LuckyPrize[];
}

/** 백엔드 lucky_config 와 같은 키. PUT 본문은 정확히 이 키들만이다. */
export interface LuckyAdminConfig {
    enabled: boolean;
    include_comments: boolean;
    member_daily_cap: number;
    daily_cap: number;
    daily_cap_post: number;
    daily_cap_comment: number;
    min_comment_chars: number;
    expire_days: number;
    window_start_hour: number;
    window_end_hour: number;
    /** 평소 단계 이름(지급 문구 「<base_name> 럭키 …」). 백엔드 기본 「앙팡」 */
    base_name: string;
    windows: LuckyWindow[];
    fixed_windows: LuckyFixedWindow[];
}

/** 게시판별 lucky(앙복타임). */
export interface LuckyBoardLucky {
    enabled: boolean;
    points: number;
    odds: number;
    comment_odds: number;
    prizes: LuckyPrize[];
}

export interface LuckyFieldError {
    /** JSON 경로(예: fixed_windows[0].start). 빈 문자열이면 본문 전체 */
    field: string;
    message: string;
}

/** 「하루 종일」 = 00:00~23:59. 끝 시각은 포함되지 않으므로 마지막 1분(23:59~24:00)은 빠진다. */
export const ALL_DAY_START = '00:00';
export const ALL_DAY_END = '23:59';

const CLOCK_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** KST "HH:MM"(00:00~23:59) 형식인지. 백엔드 ParseLuckyClock 과 같은 범위. */
export function isValidClock(value: unknown): boolean {
    return typeof value === 'string' && CLOCK_RE.test(value);
}

function copyPrizes(list: unknown): LuckyPrize[] {
    if (!Array.isArray(list)) return [];
    return list.map((p) => {
        const r = (p ?? {}) as Partial<LuckyPrize>;
        return { weight: r.weight as number, points: r.points as number, exp: r.exp as number };
    });
}

/**
 * PUT /admin/lucky/config 본문. config 의 알려진 키만 새 객체로 옮긴다.
 * GET 응답 전체(boards·history·cache_ttl_seconds·stored_* 등)나 화면 전용 키가 섞여 들어와도
 * 본문에는 실리지 않는다 — 백엔드는 알 수 없는 키를 400 으로 거부한다.
 * 값은 바꾸지 않는다(형식 검사는 clientFieldErrors·백엔드가 한다).
 */
export function buildPutConfigBody(config: LuckyAdminConfig): LuckyAdminConfig {
    const c = config;
    return {
        enabled: c.enabled,
        include_comments: c.include_comments,
        member_daily_cap: c.member_daily_cap,
        daily_cap: c.daily_cap,
        daily_cap_post: c.daily_cap_post,
        daily_cap_comment: c.daily_cap_comment,
        min_comment_chars: c.min_comment_chars,
        expire_days: c.expire_days,
        window_start_hour: c.window_start_hour,
        window_end_hour: c.window_end_hour,
        base_name: c.base_name,
        windows: (Array.isArray(c.windows) ? c.windows : []).map((w) => ({
            name: w.name,
            minutes: w.minutes,
            odds: w.odds,
            comment_odds: w.comment_odds,
            points: w.points,
            prizes: copyPrizes(w.prizes)
        })),
        fixed_windows: (Array.isArray(c.fixed_windows) ? c.fixed_windows : []).map((f) => ({
            name: f.name,
            start: f.start,
            end: f.end,
            odds: f.odds,
            comment_odds: f.comment_odds,
            points: f.points,
            prizes: copyPrizes(f.prizes)
        }))
    };
}

/** PUT /admin/lucky/boards 의 lucky 값. 알려진 키만. */
export function buildBoardLuckyBody(lucky: LuckyBoardLucky): LuckyBoardLucky {
    return {
        enabled: lucky.enabled,
        points: lucky.points,
        odds: lucky.odds,
        comment_odds: lucky.comment_odds,
        prizes: copyPrizes(lucky.prizes)
    };
}

/**
 * 전송 본문 비교용 키. 미리보기를 연 시점과 저장 시점의 본문이 같은지 본다.
 * 빈칸(null·undefined)과 0 은 다른 키다 — 미리보기 뒤에 칸을 비우면 미리보기가 무효가 된다.
 */
export function submissionKey(value: unknown): string {
    return JSON.stringify(value, (_k, v) => (v === undefined ? '__undefined__' : v)) ?? '';
}

/** 화면 편집용 깊은 복사(원본 스냅샷과 폼 상태를 분리). */
export function cloneConfig(config: LuckyAdminConfig): LuckyAdminConfig {
    return buildPutConfigBody(config);
}

export function emptyPrize(): LuckyPrize {
    return { weight: 0, points: 0, exp: 0 };
}

export function emptyWindow(): LuckyWindow {
    return { name: '', minutes: 0, odds: 0, comment_odds: 0, points: 0, prizes: [] };
}

export function emptyFixedWindow(): LuckyFixedWindow {
    return { name: '', start: '', end: '', odds: 0, comment_odds: 0, points: 0, prizes: [] };
}

export function emptyBoardLucky(): LuckyBoardLucky {
    return { enabled: false, points: 0, odds: 0, comment_odds: 0, prizes: [] };
}

// ─── 변경 미리보기 ────────────────────────────────────────────────

export interface DiffEntry {
    /** 예: fixed_windows[0].prizes[1].weight */
    path: string;
    /** 없던 값이면 undefined */
    before: unknown;
    /** 사라진 값이면 undefined */
    after: unknown;
}

function flatten(value: unknown, path: string, out: Map<string, unknown>): void {
    if (Array.isArray(value)) {
        if (value.length === 0) {
            out.set(path, []);
            return;
        }
        value.forEach((v, i) => flatten(v, `${path}[${i}]`, out));
        return;
    }
    if (value !== null && typeof value === 'object') {
        const keys = Object.keys(value as Record<string, unknown>);
        if (keys.length === 0) {
            out.set(path, {});
            return;
        }
        for (const k of keys) {
            flatten((value as Record<string, unknown>)[k], path ? `${path}.${k}` : k, out);
        }
        return;
    }
    out.set(path, value);
}

function sameLeaf(a: unknown, b: unknown): boolean {
    if (Array.isArray(a) && Array.isArray(b)) return a.length === 0 && b.length === 0;
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        return Object.keys(a).length === 0 && Object.keys(b).length === 0;
    }
    return Object.is(a, b);
}

/**
 * 두 값의 바뀐 말단(필드)을 before→after 로. 순서: before 의 순서, 그다음 after 에만 있는 것.
 * 배열 줄이 늘거나 줄면 그 줄의 필드가 (없음)↔값 으로 나온다.
 */
export function diffValues(before: unknown, after: unknown): DiffEntry[] {
    const a = new Map<string, unknown>();
    const b = new Map<string, unknown>();
    flatten(before, '', a);
    flatten(after, '', b);
    const out: DiffEntry[] = [];
    for (const [path, v] of a) {
        const has = b.has(path);
        const w = has ? b.get(path) : undefined;
        if (!has || !sameLeaf(v, w)) out.push({ path, before: v, after: w });
    }
    for (const [path, w] of b) {
        if (!a.has(path)) out.push({ path, before: undefined, after: w });
    }
    return out;
}

/** 미리보기 표시용 값. undefined=「(없음)」, 불리언=켬/끔. */
export function formatDiffValue(v: unknown): string {
    if (v === undefined) return '(없음)';
    if (v === true) return '켬';
    if (v === false) return '끔';
    if (typeof v === 'string') return v === '' ? '""' : v;
    if (typeof v === 'number') return String(v);
    return JSON.stringify(v);
}

/** 평소 단계 이름 + 설정 이름(중복 없음). 배지 판정이 인정하는 설정 쪽 이름 전부. */
function configTierNames(cfg: unknown): string[] {
    const base = luckyBaseNameFromConfig(cfg);
    return [base, ...luckyTierNamesFromConfig(cfg).filter((n) => n !== base)];
}

/**
 * 저장 후 사라지는 이름(평소 단계 + 무작위 단계 + 고정 시간대). 기본 3개 이름은 설정과 무관하게 항상
 * 인정되므로 제외한다. 이 이름으로 지급된 과거 당첨은 배지 단계 라벨이 사라진다.
 */
export function removedTierNames(before: unknown, after: unknown): string[] {
    const keep = new Set(configTierNames(after));
    return configTierNames(before).filter((n) => !keep.has(n) && !LUCKY_BUILTIN_TIERS.includes(n));
}

/**
 * 평소 단계 이름이 바뀌는지. 바뀌면 { from, to } — 지난 「앙복타임」 당첨 배지도 새 이름으로 표시된다.
 * 값이 없거나 비었으면 기본 「앙팡」으로 본다(백엔드와 같다).
 */
export function baseNameChange(
    before: unknown,
    after: unknown
): { from: string; to: string } | null {
    const from = luckyBaseNameFromConfig(before);
    const to = luckyBaseNameFromConfig(after);
    return from === to ? null : { from, to };
}

/** 평소 단계 이름 최대 글자 수. 백엔드 검증과 같다. */
export const BASE_NAME_MAX_CHARS = 20;

// ─── 필드 오류 ───────────────────────────────────────────────────

/** 필드별 오류를 경로 → 메시지 목록으로. */
export function fieldErrorMap(errors: LuckyFieldError[]): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    for (const e of errors) {
        (map[e.field] ??= []).push(e.message);
    }
    return map;
}

function isNonNegInt(v: unknown): boolean {
    return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

/**
 * 보내기 전 화면에서 잡을 수 있는 형식 오류(빈칸·소수·음수·시각 형식).
 * 숫자 칸이 비면 JSON 에 null 이 실리고, 백엔드는 null 을 「키 없음」처럼 기본값으로 둘 수 있다 —
 * 화면 값과 적용 값이 달라지지 않게 여기서 막는다. 범위·이름 중복 등 나머지는 백엔드 400 이 알려 준다.
 */
export function clientFieldErrors(config: LuckyAdminConfig): LuckyFieldError[] {
    const errs: LuckyFieldError[] = [];
    const num = (field: string, v: unknown) => {
        if (!isNonNegInt(v)) errs.push({ field, message: '0 이상의 정수를 넣어야 합니다' });
    };
    const prizes = (field: string, list: LuckyPrize[]) => {
        list.forEach((p, i) => {
            num(`${field}[${i}].weight`, p.weight);
            num(`${field}[${i}].points`, p.points);
            num(`${field}[${i}].exp`, p.exp);
        });
    };
    num('member_daily_cap', config.member_daily_cap);
    num('daily_cap_post', config.daily_cap_post);
    num('daily_cap_comment', config.daily_cap_comment);
    num('min_comment_chars', config.min_comment_chars);
    num('expire_days', config.expire_days);
    num('window_start_hour', config.window_start_hour);
    num('window_end_hour', config.window_end_hour);
    baseNameErrors(config).forEach((message) => errs.push({ field: 'base_name', message }));
    config.windows.forEach((w, i) => {
        const p = `windows[${i}]`;
        if (!w.name?.trim()) errs.push({ field: `${p}.name`, message: '이름이 비었습니다' });
        num(`${p}.minutes`, w.minutes);
        num(`${p}.odds`, w.odds);
        num(`${p}.comment_odds`, w.comment_odds);
        num(`${p}.points`, w.points);
        prizes(`${p}.prizes`, w.prizes);
    });
    config.fixed_windows.forEach((f, i) => {
        const p = `fixed_windows[${i}]`;
        if (!f.name?.trim()) errs.push({ field: `${p}.name`, message: '이름이 비었습니다' });
        if (!isValidClock(f.start)) {
            errs.push({ field: `${p}.start`, message: 'HH:MM(00:00~23:59) 형식이어야 합니다' });
        }
        if (!isValidClock(f.end)) {
            errs.push({ field: `${p}.end`, message: 'HH:MM(00:00~23:59) 형식이어야 합니다' });
        }
        num(`${p}.odds`, f.odds);
        num(`${p}.comment_odds`, f.comment_odds);
        num(`${p}.points`, f.points);
        prizes(`${p}.prizes`, f.prizes);
    });
    return errs;
}

/**
 * 평소 단계 이름(base_name) 형식 오류. 1~20자(앞뒤 공백 제외), 「 럭키 」 포함 불가,
 * 무작위 단계·고정 시간대 이름과 중복 불가. 나머지(범위 밖 규칙)는 백엔드 400 이 알려 준다.
 */
export function baseNameErrors(config: LuckyAdminConfig): string[] {
    const raw = config.base_name;
    const name = typeof raw === 'string' ? raw.trim() : '';
    const len = Array.from(name).length;
    if (len === 0) return ['평소 단계 이름이 비었습니다'];
    const out: string[] = [];
    if (len > BASE_NAME_MAX_CHARS) {
        out.push(`평소 단계 이름은 ${BASE_NAME_MAX_CHARS}자 이하여야 합니다`);
    }
    if (name.includes(' 럭키 ')) {
        out.push('평소 단계 이름에 「 럭키 」를 넣을 수 없습니다');
    }
    const others = [
        ...(Array.isArray(config.windows) ? config.windows : []),
        ...(Array.isArray(config.fixed_windows) ? config.fixed_windows : [])
    ].map((w) => (typeof w?.name === 'string' ? w.name.trim() : ''));
    if (others.includes(name)) {
        out.push('무작위 단계·고정 시간대 이름과 겹칠 수 없습니다');
    }
    return out;
}

/** 게시판 일괄 적용 폼의 형식 오류(경로는 백엔드와 같은 lucky.*). */
export function clientBoardErrors(boardIds: string[], lucky: LuckyBoardLucky): LuckyFieldError[] {
    const errs: LuckyFieldError[] = [];
    if (boardIds.length === 0) {
        errs.push({ field: 'board_ids', message: '게시판을 하나 이상 골라야 합니다' });
    }
    const num = (field: string, v: unknown) => {
        if (!isNonNegInt(v)) errs.push({ field, message: '0 이상의 정수를 넣어야 합니다' });
    };
    num('lucky.odds', lucky.odds);
    num('lucky.comment_odds', lucky.comment_odds);
    num('lucky.points', lucky.points);
    lucky.prizes.forEach((p, i) => {
        num(`lucky.prizes[${i}].weight`, p.weight);
        num(`lucky.prizes[${i}].points`, p.points);
        num(`lucky.prizes[${i}].exp`, p.exp);
    });
    return errs;
}

// ─── 안내 ────────────────────────────────────────────────────────

function clockMinutes(v: string): number {
    const [h, m] = v.split(':').map(Number);
    return h * 60 + m;
}

/** 고정 시간대 한 줄의 안내(열리지 않음·댓글 미발동·자정 넘김·하루 종일). */
export function fixedWindowNotes(f: LuckyFixedWindow): string[] {
    const notes: string[] = [];
    if (f.odds === 0) notes.push('글 확률이 0(끔)이면 이 시간대는 열리지 않습니다.');
    if (f.comment_odds === 0)
        notes.push('댓글 확률이 0(끔)이면 이 시간대에서 댓글은 발동하지 않습니다.');
    if (isValidClock(f.start) && isValidClock(f.end)) {
        const s = clockMinutes(f.start);
        const e = clockMinutes(f.end);
        if (s === e) notes.push('시작과 끝이 같으면 열리지 않습니다.');
        else if (e < s) notes.push('끝이 시작보다 이르면 자정을 넘는 구간입니다.');
        if (f.start === ALL_DAY_START && f.end === ALL_DAY_END) {
            notes.push('하루 종일(00:00~23:59)은 마지막 1분(23:59~24:00)이 빠집니다.');
        }
    }
    return notes;
}

/** 게시판 lucky 한 줄 요약(목록 표시용). */
export function summarizeBoardLucky(lucky: LuckyBoardLucky | null | undefined): string {
    if (!lucky) return '설정 없음';
    const parts = [lucky.enabled ? '켬' : '끔'];
    parts.push(`글 1/${lucky.odds || '-'}`);
    parts.push(`댓글 1/${lucky.comment_odds || '-'}`);
    if (lucky.prizes?.length) parts.push(`상품 ${lucky.prizes.length}줄`);
    else parts.push(`최대 ${lucky.points}p`);
    return parts.join(' · ');
}

/** KST 오늘 날짜 YYYY-MM-DD. */
export function kstToday(now: Date = new Date()): string {
    return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
