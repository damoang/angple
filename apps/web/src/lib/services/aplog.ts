// 광고 노출(impression) 및 클릭(click) 추적 서비스
// PHP 원본: damoang/staging/theme/damoang/layout/basic/js/layout.js

const APLOG_BASE = 'https://aplog.damoang.net/api/v1';
const TAB_ID_KEY = 'aplog:tab-id';
const CLICK_DEDUPE_WINDOW_MS = 3000;

let observer: IntersectionObserver | null = null;
let calledAdList: string[] = [];
let currentMbId: string | null = null;
const exposeDedupeKeys = new Set<string>();
const clickDedupeUntil = new Map<string, number>();

// _da 쿠키 (UUID 기반 디바이스 식별)
function getCookie(name: string): string | null {
    if (!document.cookie) return null;
    const parts = document.cookie.split(escape(name) + '=');
    if (parts.length >= 2) {
        return unescape(parts[1].split(';')[0]);
    }
    return null;
}

function setCookie(name: string, value: string, days: number) {
    const exdate = new Date();
    exdate.setDate(exdate.getDate() + days);
    document.cookie = name + '=' + escape(value) + ';expires=' + exdate.toUTCString() + ';path=/';
}

function getDa(): string {
    let da = getCookie('_da');
    if (!da) {
        da = crypto.randomUUID();
        setCookie('_da', da, 365);
    }
    return da;
}

// 현재 URL에서 board(첫 번째 경로 세그먼트) 추출
function extractBoard(): string {
    const segments = new URL(location.href).pathname.split('/').filter((s) => s !== '');
    return segments.length > 0 ? segments[0] : '';
}

// 쿼리 파라미터 제거한 URL
function cleanUrl(): string {
    const href = location.href;
    const qIdx = href.indexOf('?');
    return qIdx > -1 ? href.substring(0, qIdx) : href;
}

function getTabId(): string {
    try {
        const existing = sessionStorage.getItem(TAB_ID_KEY);
        if (existing) return existing;
        const next = crypto.randomUUID();
        sessionStorage.setItem(TAB_ID_KEY, next);
        return next;
    } catch {
        return crypto.randomUUID();
    }
}

function getPageKey(): string {
    return `${getTabId()}:${cleanUrl()}`;
}

function buildSlotKey(adPos: string, adId: string, imgSrc: string, explicitSlotKey?: string): string {
    if (explicitSlotKey) return explicitSlotKey;
    return [adPos || 'unknown', adId || 'unknown', imgSrc || 'unknown'].join(':');
}

function buildDedupeKey(eventType: 'expose' | 'click', slotKey: string): string {
    return `${eventType}:${getPageKey()}:${slotKey}`;
}

function shouldSkipClick(dedupeKey: string): boolean {
    const now = Date.now();
    const until = clickDedupeUntil.get(dedupeKey) ?? 0;
    if (until > now) return true;
    clickDedupeUntil.set(dedupeKey, now + CLICK_DEDUPE_WINDOW_MS);
    return false;
}

// 광고 로그 전송 (GET)
function adLog(el: Element, imgSrc: string, click?: boolean) {
    const endpoint = click ? '/click?' : '/expose?';
    const adUserId = (el as HTMLElement).dataset.daBnAdvertiserId ?? '';
    const parent = el.parentElement;
    const adId = parent?.dataset.daBnId ?? '';
    const adPos = parent?.dataset.daBnPosition ?? '';
    const slotKey = buildSlotKey(adPos, adId, imgSrc, (el as HTMLElement).dataset.daSlotKey);
    const dedupeKey = buildDedupeKey(click ? 'click' : 'expose', slotKey);

    if (!click && exposeDedupeKeys.has(dedupeKey)) return;
    if (click && shouldSkipClick(dedupeKey)) return;

    const da = getDa();

    const params = new URLSearchParams();
    params.set('imgSrc', imgSrc);
    if (adUserId) params.set('adUserId', adUserId);
    if (adId) params.set('adId', adId);
    if (adPos) params.set('adPos', adPos);
    params.set('da', da);
    params.set('mbId', currentMbId ?? 'null');
    params.set('board', extractBoard());
    params.set('url', cleanUrl());
    params.set('slotKey', slotKey);
    params.set('pageKey', getPageKey());
    params.set('requestId', crypto.randomUUID());
    params.set('dedupeKey', dedupeKey);

    if (!click) exposeDedupeKeys.add(dedupeKey);
    fetch(APLOG_BASE + endpoint + params.toString(), { mode: 'cors' }).catch(() => {});
}

// IntersectionObserver 설정
export function initAplog(mbId: string | null) {
    currentMbId = mbId;
    calledAdList = [];

    observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const img = entry.target.querySelector('img');
                if (!img) continue;
                const imgSrc = img.src.split('/').pop() ?? '';
                if (!imgSrc || calledAdList.includes(imgSrc)) continue;
                calledAdList.push(imgSrc);
                adLog(entry.target, imgSrc);
                observer?.unobserve(entry.target);
            }
        },
        { threshold: 1 }
    );

    const items = document.querySelectorAll('.da-bn-container .da-bn-item');
    for (const item of items) {
        // 클릭 핸들러
        const el = item as HTMLElement;
        el.onclick = () => {
            const img = el.querySelector('img');
            if (!img) return;
            const imgSrc = img.src.split('/').pop() ?? '';
            if (imgSrc) adLog(el, imgSrc, true);
        };
        observer.observe(item);
    }
}

// SPA 네비게이션 시 기존 observer 재활용 (새 광고 요소만 추가 observe)
export function reinitAplog(mbId: string | null) {
    currentMbId = mbId;

    if (!observer) {
        // observer가 없으면 새로 생성 (최초 호출 또는 destroy 후)
        initAplog(mbId);
        return;
    }

    const items = document.querySelectorAll('.da-bn-container .da-bn-item');
    for (const item of items) {
        const img = item.querySelector('img');
        if (!img) continue;
        const imgSrc = img.src.split('/').pop() ?? '';
        // 이미 추적한 광고는 스킵
        if (imgSrc && calledAdList.includes(imgSrc)) continue;

        // 클릭 핸들러 (중복 방지를 위해 매번 재설정)
        const el = item as HTMLElement;
        el.onclick = () => {
            const clickImg = el.querySelector('img');
            if (!clickImg) return;
            const clickImgSrc = clickImg.src.split('/').pop() ?? '';
            if (clickImgSrc) adLog(el, clickImgSrc, true);
        };
        observer.observe(item);
    }
}

// Observer 해제 (onMount cleanup용)
export function destroyAplog() {
    if (observer) {
        observer.disconnect();
        observer = null;
    }
    calledAdList = [];
}

// --- Svelte action 기반 추적 (SvelteKit 배너 컴포넌트용) ---

export interface AplogTrackParams {
    adId: string;
    adPos: string;
    imgSrc: string;
    adUserId?: string;
    mbId: string | null;
    slotKey?: string;
}

export function sendAplogEvent(params: AplogTrackParams, click?: boolean) {
    const endpoint = click ? '/click?' : '/expose?';
    const da = getDa();
    const imgSrc = params.imgSrc.split('/').pop() ?? '';
    const slotKey = buildSlotKey(params.adPos, params.adId, imgSrc, params.slotKey);
    const dedupeKey = buildDedupeKey(click ? 'click' : 'expose', slotKey);

    if (!click && exposeDedupeKeys.has(dedupeKey)) return;
    if (click && shouldSkipClick(dedupeKey)) return;

    const qs = new URLSearchParams();
    qs.set('imgSrc', imgSrc);
    if (params.adUserId) qs.set('adUserId', params.adUserId);
    qs.set('adId', params.adId);
    qs.set('adPos', params.adPos);
    qs.set('da', da);
    qs.set('mbId', params.mbId ?? 'null');
    qs.set('board', extractBoard());
    qs.set('url', cleanUrl());
    qs.set('slotKey', slotKey);
    qs.set('pageKey', getPageKey());
    qs.set('requestId', crypto.randomUUID());
    qs.set('dedupeKey', dedupeKey);
    const url = APLOG_BASE + endpoint + qs.toString();

    if (!click) exposeDedupeKeys.add(dedupeKey);
    fetch(url, { mode: 'cors', keepalive: true }).catch(() => {});
}

export function aplogTrack(node: HTMLElement, params: AplogTrackParams | null) {
    if (!params) return { update() {}, destroy() {} };

    let currentParams = params;
    let exposed = false;

    const observer = new IntersectionObserver(
        (entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting && !exposed) {
                    exposed = true;
                    sendAplogEvent(currentParams);
                    observer.unobserve(node);
                }
            }
        },
        { threshold: 0.5 }
    );

    observer.observe(node);

    const handleClick = () => sendAplogEvent(currentParams, true);
    node.addEventListener('click', handleClick);

    return {
        update(newParams: AplogTrackParams | null) {
            currentParams = newParams!;
            exposed = false;
            if (newParams) observer.observe(node);
        },
        destroy() {
            observer.disconnect();
            node.removeEventListener('click', handleClick);
        }
    };
}
