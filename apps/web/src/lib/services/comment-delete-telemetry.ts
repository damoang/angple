/**
 * 댓글 삭제·복구 단계 계측.
 *
 * ## 왜 필요한가
 * 브라우저가 기본 확인창을 띄우지 않으면 `window.confirm` 이 흔적 없이 false 를 돌려줘
 * 요청 없이 끝난다. 클라이언트에서 요청 전에 멈추는 실패 모드는 예외도, 서버 로그도
 * 남기지 않는다. 그래서 **다음 재발이 어느 단계에서
 * 멈췄는지 말하게** 한다.
 *
 * ## 단계
 *   click     휴지통(복구) 버튼을 눌렀다 — 확인 대화상자를 열기 직전
 *   confirmed 대화상자에서 확인을 눌렀다
 *   cancelled 확인 없이 닫았다(취소·바깥 탭·Esc)
 *   ok        서버 요청이 성공했다
 *   fail      서버 요청이 실패했다(status 동봉)
 *
 * 판독: `click` 뒤에 `confirmed`/`cancelled` 가 없으면 대화상자 단계에서 멈춘 것이고,
 * `confirmed` 뒤에 `ok`/`fail` 이 없으면 요청 단계에서 멈춘 것이다. 같은 시도는 `attempt=`
 * (시도마다 새로 뽑는 무작위 값)로 묶는다.
 *
 * ## 개인정보
 * ⛔ 회원 ID·댓글 ID·글 번호를 싣지 않는다. 경로는 `pathGroup` 으로 익명화한다
 *    (`/free/123` → `/free/:id`). `location.href` 원문을 싣지 않는다.
 *
 * ## 송신
 * 기존 RUM 과 같은 Dantry(→ ClickHouse `error_logs.js_errors`) 경로. 수집기는 스키마 밖
 * 필드를 버리므로 `stack` 에 `key=value` 줄로 싣는다(web-vitals-rum·history-probe 와 같다).
 *
 * 샘플링: 시도 단위로 한 번 뽑는다(단계마다 따로 뽑으면 click↔confirmed 짝이 깨진다).
 * `fail` 은 표본에서 빠진 시도라도 전량 보낸다. 각 줄의 `rate=` 로 총량을 복원한다.
 */
import { DANTRY_URL, pathGroup } from './web-vitals-rum';

export type CommentDeleteStage = 'click' | 'confirmed' | 'cancelled' | 'ok' | 'fail';
export type CommentDeleteKind = 'delete' | 'restore';

/**
 * 정상 경로(click/confirmed/cancelled/ok) 표본 배율 — 1/N 시도만 보낸다.
 * 댓글 삭제는 하루 수십~백여 건 수준이고, 찾으려는 이상(click 뒤 무응답)이 드물어
 * 지금은 전량(1)으로 둔다. 양이 늘면 이 값만 올린다.
 */
export const NORMAL_SAMPLE_RATE = 1;

interface Attempt {
    id: string;
    kind: CommentDeleteKind;
    startedAt: number;
    sampled: boolean;
}

let current: Attempt | null = null;

/** 이 단계를 보낼지. fail 은 표본과 무관하게 항상 보낸다. */
export function shouldSend(stage: CommentDeleteStage, sampled: boolean): boolean {
    return stage === 'fail' || sampled;
}

/** 시도 단위 표본 추출. rand 는 [0, 1) */
export function isSampled(rate: number, rand: number): boolean {
    if (!(rate > 1)) return true;
    return rand < 1 / rate;
}

/** 이 줄이 대표하는 시도 수 — 집계에서 sum(rate) 로 총량을 복원한다. */
export function rateFor(stage: CommentDeleteStage, sampled: boolean, rate: number): number {
    if (stage === 'fail' && !sampled) return 1;
    return rate > 1 ? rate : 1;
}

export function engineOf(ua: string): string {
    if (/iPhone|iPad|iPod/.test(ua)) return 'webkit-ios';
    if (/Edg\//.test(ua)) return 'chromium-edge';
    if (/Firefox\//.test(ua)) return 'gecko';
    if (/Chrome\/|CriOS|Chromium/.test(ua)) return 'chromium';
    if (/Safari\//.test(ua)) return 'webkit';
    return 'other';
}

export interface ResourceEntryLike {
    name: string;
    responseStatus?: number;
    /** performance.now() 축 */
    startTime?: number;
}

/**
 * 실패 사유에서 상태 코드를 뽑는다. 숫자가 없으면 분류 문자열을 돌려준다.
 * 1) 오류 객체의 `status`(ApiRequestError 등)
 * 2) 리소스 타이밍의 `responseStatus` — 댓글 삭제 클라이언트는 상태 코드 없이 Error 만
 *    던지므로 이 보조 경로가 필요하다(Chromium 계열만 지원, 없으면 건너뜀).
 *    URL 은 여기서 비교만 하고 밖으로 내보내지 않는다.
 *    ⛔ 이번 시도(click) 이후에 시작된 항목만 본다(`startTime >= since`). 오래된 문서에서
 *    리소스 버퍼가 가득 차면 새 항목이 안 쌓여, 예전 요청의 200 이 실릴 수 있다.
 *    경로는 끝까지 고정한다(`…/comments/<숫자 id>` 만 — `/restore`·`like-statuses` 등 제외).
 * 3) fetch 네트워크 실패(TypeError) → 'network'
 */
export function statusOf(
    err: unknown,
    entries: ResourceEntryLike[] = [],
    since: number = 0
): string {
    if (err && typeof err === 'object' && 'status' in err) {
        const s = (err as { status?: unknown }).status;
        if (typeof s === 'number' && s > 0) return String(s);
    }
    for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i];
        if (typeof e.startTime === 'number' && e.startTime < since) break;
        if (!/\/api\/boards\/[^/]+\/posts\/[^/]+\/comments\/\d+(?:[?#].*)?$/.test(e.name))
            continue;
        if (typeof e.responseStatus === 'number' && e.responseStatus > 0) {
            return String(e.responseStatus);
        }
        break;
    }
    if (err instanceof TypeError) return 'network';
    return 'unknown';
}

export interface LineInput {
    stage: CommentDeleteStage;
    kind: CommentDeleteKind;
    attempt: string;
    rate: number;
    status: string;
    nav: string;
    engine: string;
    page: string;
    /** 문서가 열린 지 몇 초 — 오래 유지된 SPA 문서인지 가른다 */
    ageS: number;
    /** click 이후 경과(ms). click 자신은 0 */
    sinceClickMs: number;
}

/** 비콘 `stack` 줄. 회원·댓글·글 식별자가 들어갈 자리가 없다. */
export function buildLines(i: LineInput): string[] {
    return [
        `stage=${i.stage}`,
        `kind=${i.kind}`,
        `attempt=${i.attempt}`,
        `rate=${i.rate}`,
        `status=${i.status}`,
        `nav=${i.nav}`,
        `engine=${i.engine}`,
        `page=${i.page}`,
        `age_s=${i.ageS}`,
        `since_click_ms=${i.sinceClickMs}`
    ];
}

function navType(): string {
    try {
        const nav = performance.getEntriesByType('navigation')[0] as
            | PerformanceNavigationTiming
            | undefined;
        return nav?.type ?? '?';
    } catch {
        return '?';
    }
}

function resourceEntries(): ResourceEntryLike[] {
    try {
        return performance.getEntriesByType('resource') as unknown as ResourceEntryLike[];
    } catch {
        return [];
    }
}

function randomId(): string {
    return Math.random().toString(36).slice(2, 10);
}

function send(stage: CommentDeleteStage, attempt: Attempt, status: string): void {
    try {
        const page = pathGroup(location.pathname);
        const lines = buildLines({
            stage,
            kind: attempt.kind,
            attempt: attempt.id,
            rate: rateFor(stage, attempt.sampled, NORMAL_SAMPLE_RATE),
            status,
            nav: navType(),
            engine: engineOf(navigator.userAgent),
            page,
            ageS: Math.round(performance.now() / 1000),
            sinceClickMs: Math.round(performance.now() - attempt.startedAt)
        });
        const payload = {
            type: 'comment_delete',
            reason: stage,
            channel: 'rum',
            message: `comment_delete ${stage}`,
            stack: lines.join('\n'),
            url: `${location.origin}${page}`,
            userAgent: navigator.userAgent
        };
        const body = JSON.stringify(payload);
        if (typeof navigator.sendBeacon === 'function') {
            navigator.sendBeacon(DANTRY_URL, new Blob([body], { type: 'application/json' }));
        }
    } catch {
        // 계측 실패는 무시 — 삭제 동작에 절대 영향을 주지 않는다
    }
}

/**
 * 단계 기록. `click` 이 새 시도를 연다. 나머지 단계는 열린 시도에 붙는다.
 * `fail` 에는 `error` 를 넘겨 상태 코드를 싣는다.
 */
export function trackCommentDelete(
    stage: CommentDeleteStage,
    opts: { kind?: CommentDeleteKind; error?: unknown } = {}
): void {
    if (typeof window === 'undefined') return;
    try {
        if (stage === 'click' || !current) {
            current = {
                id: randomId(),
                kind: opts.kind ?? 'delete',
                startedAt: performance.now(),
                sampled: isSampled(NORMAL_SAMPLE_RATE, Math.random())
            };
        }
        const attempt = current;
        if (!shouldSend(stage, attempt.sampled)) return;
        const status =
            stage === 'fail'
                ? statusOf(opts.error, resourceEntries(), attempt.startedAt)
                : stage === 'ok'
                  ? 'ok'
                  : '-';
        send(stage, attempt, status);
    } catch {
        // 계측 실패는 무시
    }
}
