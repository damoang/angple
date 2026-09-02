/**
 * 오탭(mistouch) 직접 계측 — bug/13836.
 *
 * 증상: 모바일 목록에서 글을 터치하면 **아래 글**이 열린다. 석 달째, 두 번째 제보.
 *
 * ⛔ **CLS 로는 이 증상을 못 잰다** (2026-09-02 헤드리스 실측, `web-vitals-rum.ts` 주석 참조):
 *   · 스크롤 앵커링이 밀림 엔트리를 통째로 지운다(scrollY=600/1500 에서 엔트리 0개).
 *     실사용자는 **스크롤한 채로** 탭한다 — 즉 관측이 지워지는 바로 그 구간에서 탭한다.
 *   · 모바일 스크롤은 포인터 입력이라, 스크롤 직후 500ms 안의 밀림은 `hadRecentInput`
 *     으로 CLS 에서 **전부 빠진다**. 하필 오탭이 나는 구간이다.
 *   · `layout-shift.sources` 는 **밀린** 요소만 담아 "민 주체" 를 못 준다.
 *   → 대리 지표를 정교하게 만드는 방향이 틀렸다. **증상 자체**를 잰다.
 *
 * ⭐ 원리 — 크롬은 터치 탭의 호환 마우스 이벤트(click)를 **click 을 보내는 시점의
 *   좌표 히트테스트**로 타겟팅한다. 그래서 손가락이 닿은 뒤 click 이 확정되기까지의
 *   짧은 사이에 목록이 밀리면, 닿았던 글이 아니라 **그 자리에 새로 들어온 글**이 열린다.
 *   그러니 **닿은 순간 그 좌표에 있던 링크**와 **실제로 열린 링크**를 비교하면
 *   증상 발생 여부가 그 자리에서 확정된다. 밀림의 크기·부호를 유추할 필요가 없다.
 *
 * ⛔ 개인정보: **href·제목·회원 식별자를 절대 담지 않는다.** 두 링크가 "다른가" 와
 *    "몇 행 차이인가" 만 보낸다. 봉투의 `url` 도 `pathGroup` 으로 익명화한다
 *    (글 상세에서 오탭이 나면 `location.href` 에 글 번호가 실리기 때문).
 */
import { DANTRY_URL, adOverflowSignature, authSignature, pathGroup } from './web-vitals-rum';

/**
 * 오탭은 드물다 — 전수로 받는다. 대신 **한 페이지 로드당 최대 3건**으로 상한을 둔다
 * (무한 루프성 오작동이 비콘 폭풍이 되는 것만 막으면 된다).
 */
const MISTOUCH_SAMPLE_RATE = 1.0;
const MISTOUCH_MAX_PER_PAGE = 3;

/**
 * pointerdown → click 사이가 이보다 벌어지면 **같은 탭이 아니다**.
 * 키보드 Enter 로 난 click(선행 pointerdown 없음)이나, 스크롤만 하고 한참 뒤에 누른
 * 별개 동작이 짝지어지는 것을 막는다.
 */
const MAX_TAP_GAP_MS = 5000;

/**
 * pointerup → click 창. 포인터 탭의 click 은 pointerup 직후에 온다.
 * ⛔ 이 창이 없으면, 스크롤이 끝난(=pointerup 까지 온) pointerdown 이 한참 뒤에 도착한
 *    무관한 click 과 짝지어진다.
 */
const MAX_CLICK_AFTER_UP_MS = 1000;

/**
 * click 좌표가 pointerdown 좌표에서 이만큼 넘게 벗어나면 **오탭이 아니다**.
 *
 * ⭐ 이 증상의 정의가 "손가락은 그대로인데 **내용이** 밀려 다른 글이 열린다" 이므로,
 *   진짜 오탭은 두 좌표가 사실상 같다. 좌표가 벌어졌다면 그건 드래그·별개 동작이다.
 */
const TAP_MOVE_TOLERANCE_PX = 16;

/** 조상 사슬 탐색 상한 — 깊은 DOM 에서 비용이 튀지 않게. */
const MAX_ANCESTOR_DEPTH = 40;

let sentCount = 0;
let installed = false;
const sampled = typeof window !== 'undefined' && Math.random() < MISTOUCH_SAMPLE_RATE;

/**
 * 손가락이 닿은 순간의 스냅샷.
 *
 * ⭐ **왜 `elementFromPoint` 가 아니라 `event.target` 인가.**
 *   `document.elementFromPoint()` 는 스타일·레이아웃 플러시를 강제한다. pointerdown 은
 *   스크롤이 시작되는 순간이라 여기서 레이아웃을 강제하면 **첫 프레임을 늦춰 사용자
 *   조작을 직접 망가뜨린다** — 관측이 증상을 만드는 최악의 경우다.
 *   반면 `event.target` 은 브라우저가 이벤트를 디스패치하려고 **이미 수행한**
 *   히트테스트 결과다. 즉 "닿은 순간 그 좌표에 있던 요소" 를 **추가 비용 0** 으로 준다.
 *   우리가 필요한 것이 정확히 그것이므로 `elementFromPoint` 를 쓸 이유가 없다.
 *   ⛔ 그래서 이 핸들러는 **프로퍼티 읽기와 대입만** 한다. `closest()` 조차 click 시점에
 *      한다(레이아웃을 강제하진 않지만, 원칙을 흐리면 다음 사람이 무거운 걸 넣는다).
 * ⛔ 노드 강참조는 **한 개만** 들고 다음 pointerdown 에서 덮어쓰며, click 처리 뒤 즉시
 *    비운다. 누적되지 않는다.
 * ⛔ `clientX/Y`·`pointerType` 도 **프로퍼티 읽기**라 레이아웃 강제가 아니다.
 *    이 핸들러에는 이 이상 아무것도 넣지 않는다.
 */
interface TapDown {
    target: EventTarget | null;
    t: number;
    x: number;
    y: number;
    /** 'touch' | 'mouse' | 'pen' — 분석에서 기기를 가른다. */
    ptype: string;
    /** 이 짝의 pointerup 이 온 시각. 아직 안 왔으면 null. */
    upT: number | null;
}
let down: TapDown | null = null;

/**
 * 링크 식별자. **전송하지 않는다** — 오직 두 링크가 같은지 비교하는 데만 쓴다.
 * `HTMLAnchorElement.href` 는 절대 URL 로 정규화되므로 상대/절대 표기 차이에 안 흔들린다.
 */
function linkKey(el: Element): string | null {
    try {
        if (el instanceof HTMLAnchorElement) return el.href;
        return el.getAttribute('href');
    } catch {
        return null;
    }
}

/** 이벤트 타겟에서 가장 가까운 `a[href]`. 레이아웃을 강제하지 않는다(트리 탐색만). */
function closestLink(target: EventTarget | null): Element | null {
    try {
        if (!(target instanceof Element)) return null;
        return target.closest('a[href]');
    } catch {
        return null;
    }
}

/**
 * 두 링크의 **가장 가까운 공통 조상**.
 * ⛔ 목록 컨테이너를 하드코딩하지 않는다 — 테마·프리미엄 위젯마다 마크업이 다르고,
 *    하드코딩하면 그 표면에서만 조용히 `drow=?` 가 된다.
 */
function commonAncestor(a: Element, b: Element): Element | null {
    let anc: Element | null = a.parentElement;
    for (let d = 0; anc && d < MAX_ANCESTOR_DEPTH; d++) {
        if (anc.contains(b)) return anc;
        anc = anc.parentElement;
    }
    return null;
}

/**
 * `ancestor` 의 자식들 중 `el` 을 품은 자식이 몇 번째인가. 못 구하면 -1.
 * = "공통 조상 안에서 이 링크가 몇 번째 행인가".
 */
function rowIndexUnder(el: Element, ancestor: Element): number {
    let node: Element | null = el;
    for (let d = 0; node && d < MAX_ANCESTOR_DEPTH; d++) {
        if (node.parentElement === ancestor) {
            const kids = ancestor.children;
            // ⛔ HTMLCollection 을 for..of 로 돌면 tsconfig(downlevelIteration)에 따라
            //    CI 에서 막힌다 — 이 저장소의 기존 관례대로 인덱스 루프.
            for (let i = 0; i < kids.length; i++) {
                if (kids[i] === node) return i;
            }
            return -1;
        }
        node = node.parentElement;
    }
    return -1;
}

/**
 * 행 차이(부호 포함). **+1 = 바로 아래 글이 열림 = 이번 제보 증상.**
 *
 * ⛔ **왜 `?` 인지를 구분해서 보낸다.** 닿은 링크가 DOM 에서 빠져버린 경우
 *    (`drow=detached`)와, 붙어는 있는데 공통 조상·행 위치를 못 구한 경우(`drow=?`)는
 *    처방이 다르다. 뭉뚱그리면 분석에서 "왜 모르는지" 를 되물을 수 없다.
 *    ⚠️ 두 경우 모두 **비콘 자체는 나간다** — 오탭이 났다는 사실은 이미 확정된 표본이라
 *       버리면 그만큼 과소집계된다.
 */
function rowDelta(intended: Element, opened: Element): string {
    try {
        if (!intended.isConnected || !opened.isConnected) return 'drow=detached';
        const anc = commonAncestor(intended, opened);
        if (!anc) return 'drow=?';
        const a = rowIndexUnder(intended, anc);
        const b = rowIndexUnder(opened, anc);
        if (a < 0 || b < 0) return 'drow=?';
        return `drow=${b - a}`;
    } catch {
        return 'drow=?';
    }
}

/**
 * 두 링크의 `getBoundingClientRect().top` 차이(px), `열린 것 − 닿은 것`.
 * ⛔ 떨어져 나간(detached) 요소의 rect 는 전부 0 이라 그대로 재면 거짓값이 된다.
 *    붙어 있는지부터 확인하고, 아니면 `?`.
 * ⛔ 레이아웃을 강제하지만 **click 시점 1회**다(오탭이 확정된 표본에서만 부른다).
 */
function topDelta(intended: Element, opened: Element): string {
    try {
        // `drow` 와 같은 이유로 원인을 구분해서 보낸다(위 rowDelta 주석 참조).
        if (!intended.isConnected || !opened.isConnected) return 'dy=detached';
        const d = opened.getBoundingClientRect().top - intended.getBoundingClientRect().top;
        return `dy=${Math.round(d)}`;
    } catch {
        return 'dy=?';
    }
}

/**
 * ⛔ 이 비콘은 **오탭이 확정된 순간에만** 나간다. 정상 탭에서는 한 줄도 안 나간다.
 *    `web_vitals` 와 달리 pagehide 를 기다리지 않는다 — 오탭 직후 페이지가 이동하므로
 *    그 자리에서 sendBeacon 으로 넘겨야 유실되지 않는다.
 */
function sendMistouch(lines: string[]): void {
    try {
        const payload = {
            type: 'mistouch',
            reason: 'mistouch',
            channel: 'rum',
            message: 'mistouch',
            // ⛔ 수집기는 스키마에 없는 필드를 버린다(js_errors 컬럼 고정). stack 에 싣는다.
            stack: lines.join('\n'),
            // ⛔ `location.href` 를 그대로 쓰면 글 상세에서 글 번호가 실린다. 그룹화해서 익명화.
            url: `${location.origin}${pathGroup(location.pathname)}`,
            userAgent: navigator.userAgent
        };
        const body = JSON.stringify(payload);
        if (typeof navigator.sendBeacon === 'function') {
            navigator.sendBeacon(DANTRY_URL, new Blob([body], { type: 'application/json' }));
        }
    } catch {
        // 관측 실패는 무시 — 사용자 조작에 영향이 있으면 안 된다
    }
}

function onPointerDown(event: PointerEvent): void {
    try {
        // ⭐ 여기서는 프로퍼티 읽기와 대입만 한다. 위 TapDown 주석 참조.
        down = {
            target: event.target,
            t: event.timeStamp,
            x: event.clientX,
            y: event.clientY,
            ptype: event.pointerType,
            upT: null
        };
    } catch {
        down = null;
    }
}

/**
 * ⛔ **여기서 `down` 을 비우면 정상 탭이 통째로 죽는다** — 포인터 탭의 순서는
 *    pointerdown → **pointerup** → click 이고, 판정에 필요한 `down` 은 click 시점에 쓴다.
 *    그래서 소진은 "비우기" 가 아니라 **창 좁히기**로 한다: pointerup 이 왔다는 사실과
 *    그 시각을 찍어두고, click 은 그 뒤 `MAX_CLICK_AFTER_UP_MS` 안에 온 것만 인정한다.
 *    pointerup 이 아예 없었던 짝은 click 에서 거부한다(포인터에서 나온 click 이 아니다).
 */
function onPointerUp(event: PointerEvent): void {
    try {
        if (!down) return;
        down.upT = event.timeStamp;
    } catch {
        down = null;
    }
}

/**
 * ⛔ pointercancel = **브라우저가 포인터를 스크롤·제스처에 가져갔다.** 이 pointerdown 에서
 *    click 은 나오지 않는다. 여기서 즉시 비워야, 뒤에 도착한 무관한 click(합성 click·
 *    키보드 Enter)이 이 짝을 주워가지 않는다. 정상 탭은 cancel 이 오지 않으므로 안 죽는다.
 */
function onPointerCancel(): void {
    down = null;
}

function onClick(event: MouseEvent): void {
    // ⛔ 짝은 무조건 한 번만 쓴다. 어디서 빠져나가든 다음 탭에 흘리면 안 되므로 즉시 비운다.
    const d = down;
    down = null;
    try {
        if (sentCount >= MISTOUCH_MAX_PER_PAGE) return;
        if (!d) return; // 선행 pointerdown 없음(키보드 Enter 등) → 오탭 판정 대상이 아니다

        /* ── 위양성 차단: 이 click 이 **그 탭에서 나온 것**인지 먼저 확정한다 ──────────
         * 2026-09-02 독립 검증 실측 — 아래 셋이 전부 비콘을 냈다(drow=27/28/9):
         *   · 스크롤(클릭 없이 끝남) → JS 합성 `el.click()`
         *   · 스크롤(클릭 없이 끝남) → 키보드 Enter
         *   · 데스크톱 마우스 드래그 → 키보드 Enter
         * 원인은 `down` 이 최대 5초 살아 있어 **그 탭에서 나오지 않은 click** 과 짝지어진 것.
         * 「선행 pointerdown 없으면 대상 아님」이라는 주석은 실제로 성립하지 않았다.
         */
        // ① 사용자 포인터 클릭만 인정: 합성 `click()`·키보드 Enter 는 `detail === 0` 이고
        //    좌표도 (0,0) 이다. 진짜 탭은 `detail >= 1`.
        if (!(event.detail > 0)) return;
        // ② pointerup 이 선행해야 한다(위 onPointerUp 주석).
        if (d.upT === null) return;
        if (event.timeStamp - d.upT > MAX_CLICK_AFTER_UP_MS) return;
        // ③ 좌표 일치: 오탭은 손가락이 그대로인 채 내용만 밀린 것이다. 드래그처럼 좌표가
        //    벌어진 클릭은 "다른 글이 열렸다" 가 아니라 **다른 곳을 눌렀다** 이다.
        if (Math.abs(event.clientX - d.x) > TAP_MOVE_TOLERANCE_PX) return;
        if (Math.abs(event.clientY - d.y) > TAP_MOVE_TOLERANCE_PX) return;

        const dt = event.timeStamp - d.t;
        if (!(dt >= 0) || dt > MAX_TAP_GAP_MS) return;

        const intended = closestLink(d.target);
        const opened = closestLink(event.target);
        // 둘 중 하나라도 링크가 아니면 "다른 글이 열렸다" 를 말할 수 없다.
        // (닿은 곳이 링크가 아니었거나, 아무 데도 이동하지 않는 클릭)
        if (!intended || !opened) return;
        if (intended === opened) return;

        const a = linkKey(intended);
        const b = linkKey(opened);
        // href 를 못 읽으면 판정 불가. ⛔ 값은 여기서만 쓰고 절대 전송하지 않는다.
        if (!a || !b) return;
        // ⭐ 같은 글이면 정상 탭이다. Svelte 가 목록을 다시 렌더해 노드 동일성이 깨져도
        //   여기서 걸러진다 — 노드 비교만으로 판정하면 대량 오탐이 난다.
        if (a === b) return;

        sentCount++;
        sendMistouch([
            rowDelta(intended, opened),
            topDelta(intended, opened),
            `dt=${Math.round(dt)}`,
            `sy=${Math.round(window.scrollY)}`,
            `page=${pathGroup(location.pathname)}`,
            `vw=${window.innerWidth}`,
            // 기기 축. 이번 제보는 모바일(touch)이다 — mouse/pen 표본을 섞어 읽으면 안 된다.
            `ptype=${(d.ptype || '?').slice(0, 8)}`,
            adOverflowSignature(),
            authSignature()
        ]);
    } catch {
        // 관측 실패는 무시 — 사용자 조작에 영향이 있으면 안 된다
    }
}

/**
 * 오탭 프로브 설치.
 *
 * ⛔ SSR 안전: `window` 없으면 아무것도 하지 않는다.
 * ⛔ `capture: true` — 앱 코드가 `stopPropagation()` 해도 먼저 본다.
 * ⛔ `passive: true` — 우리가 `preventDefault()` 를 부를 수 없게 못박는다.
 *    관측이 링크 이동을 막는 일은 절대 없어야 한다.
 * 비용: 리스너 등록 4회. 렌더 경로에 아무것도 추가하지 않는다.
 */
export function initMistouchProbe(): void {
    if (typeof window === 'undefined' || installed) return;
    installed = true;
    if (!sampled) return;
    try {
        const opts: AddEventListenerOptions = { capture: true, passive: true };
        document.addEventListener('pointerdown', onPointerDown, opts);
        document.addEventListener('pointerup', onPointerUp, opts);
        document.addEventListener('pointercancel', onPointerCancel, opts);
        document.addEventListener('click', onClick, opts);
    } catch {
        // 리스너 등록 실패는 무시 — 사용자 조작에 영향이 있으면 안 된다
    }
}

/**
 * 상한(`MISTOUCH_MAX_PER_PAGE`)을 **네비게이션마다** 되돌린다.
 *
 * ⛔ 모듈 스코프 카운터는 SPA soft-nav 로 리셋되지 않는다. 목록↔글상세를 오가는 실사용
 *    패턴에서는 **초반 3건을 쓰고 나면 세션 내내 관측이 죽는다** — 상한이 사실상
 *    "세션당 3건" 이 된다(2026-09-02 독립 검증 지적).
 * ⭐ 그래서 `+layout.svelte` 의 **기존 `afterNavigate`** 에 태운다. 이 저장소는 이미 거기서
 *    GA4 페이지뷰·Clarity 가드·광고 observer 를 재설정한다 — "한 페이지" 의 정의를 앱과
 *    같게 맞추는 것이 맞다. 프로브가 따로 `popstate`/`pushState` 를 훔쳐보면 SvelteKit 의
 *    이동 개념(리다이렉트·인터셉트 포함)과 어긋나고, 리스너가 하나 더 늘어난다.
 * ⛔ 진행 중이던 짝도 같이 버린다. 네비게이션을 건너뛴 pointerdown 은 이미 남의 페이지 것이다.
 */
export function resetMistouchBudget(): void {
    sentCount = 0;
    down = null;
}
