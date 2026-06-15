/**
 * 디바이스 핑거프린트 수집기 (해시 기반)
 *
 * 생체 지문이 아니라, 브라우저/기기의 안정적 신호들을 모아 SHA-256 해시로 만든
 * 식별값. 다중계정·명의도용·자동화 탐지 보조용. 원시값은 서버로 보내되 서버는
 * 해시/요약만 저장(개인정보취급방침 고지 전제, PIPA).
 *
 * - fp_hash: 안정 신호 정규화 문자열의 SHA-256 (같은 기기/브라우저면 동일)
 * - deviceId: localStorage 영속 난수 UUID (같은 브라우저면 계정 달라도 동일)
 *
 * 단독 제재 근거 아님 — 서버에서 IP/DI/행동과 종합 판정.
 */

import { env } from '$env/dynamic/public';

const DEVICE_ID_KEY = 'da_device_id';
const LAST_SENT_KEY = 'da_fp_sent_at';
const SEND_THROTTLE_MS = 24 * 60 * 60 * 1000; // 기기당 1일 1회
const ENDPOINT = '/api/v1/fingerprint';

/** 수집 활성 여부 — 기본 비활성. 개인정보 처리방침 공시 + 법률검토 후에만 켠다. */
const COLLECTION_ENABLED = env.PUBLIC_FINGERPRINT_ENABLED === 'true';

interface FingerprintComponents {
    platform: string;
    ua: string;
    languages: string;
    screen: string;
    timezone: string;
    hardwareConcurrency: number;
    deviceMemory: number;
    touch: number;
    canvas: string;
    webgl: string;
}

/** localStorage 영속 device-id (없으면 생성) */
function getOrCreateDeviceId(): string {
    try {
        let id = localStorage.getItem(DEVICE_ID_KEY);
        if (!id) {
            id =
                typeof crypto !== 'undefined' && 'randomUUID' in crypto
                    ? crypto.randomUUID()
                    : 'd-' +
                      Math.abs(
                          hashString(String(performance.now()) + navigator.userAgent)
                      ).toString(16);
            localStorage.setItem(DEVICE_ID_KEY, id);
        }
        return id;
    } catch {
        return 'no-storage';
    }
}

/** 가벼운 비암호 해시(폴백/문자열용) */
function hashString(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
    }
    return h;
}

/** canvas 렌더링 특성 → 짧은 해시 */
function canvasSignal(): string {
    try {
        const c = document.createElement('canvas');
        c.width = 240;
        c.height = 60;
        const ctx = c.getContext('2d');
        if (!ctx) return 'no-2d';
        ctx.textBaseline = 'top';
        ctx.font = "14px 'Arial'";
        ctx.fillStyle = '#f60';
        ctx.fillRect(125, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('damoang-fp-✓', 2, 15);
        ctx.fillStyle = 'rgba(102,204,0,0.7)';
        ctx.fillText('damoang-fp-✓', 4, 17);
        return hashString(c.toDataURL()).toString(16);
    } catch {
        return 'canvas-err';
    }
}

/** WebGL vendor/renderer */
function webglSignal(): string {
    try {
        const c = document.createElement('canvas');
        const gl = (c.getContext('webgl') ||
            c.getContext('experimental-webgl')) as WebGLRenderingContext | null;
        if (!gl) return 'no-webgl';
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        const vendor = dbg
            ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)
            : gl.getParameter(gl.VENDOR);
        const renderer = dbg
            ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
            : gl.getParameter(gl.RENDERER);
        return hashString(`${vendor}~${renderer}`).toString(16);
    } catch {
        return 'webgl-err';
    }
}

function collectComponents(): FingerprintComponents {
    const nav = navigator as Navigator & { deviceMemory?: number };
    return {
        platform: nav.platform || '',
        ua: nav.userAgent || '',
        languages: (nav.languages || [nav.language]).join(','),
        screen: `${screen.width}x${screen.height}x${screen.colorDepth}@${window.devicePixelRatio || 1}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        hardwareConcurrency: nav.hardwareConcurrency || 0,
        deviceMemory: nav.deviceMemory || 0,
        touch: 'ontouchstart' in window || nav.maxTouchPoints > 0 ? 1 : 0,
        canvas: canvasSignal(),
        webgl: webglSignal()
    };
}

/** 안정 신호만 골라 정규화(ua/languages 등 변동 큰 값은 fp_hash에서 제외) */
function stableString(c: FingerprintComponents): string {
    return [
        c.platform,
        c.screen,
        c.timezone,
        c.hardwareConcurrency,
        c.deviceMemory,
        c.touch,
        c.canvas,
        c.webgl
    ].join('|');
}

async function sha256(s: string): Promise<string> {
    try {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
        return Array.from(new Uint8Array(buf))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    } catch {
        // SubtleCrypto 불가(비보안 컨텍스트 등) → 비암호 폴백
        return 'fb' + (hashString(s) >>> 0).toString(16).padStart(8, '0');
    }
}

/**
 * 핑거프린트를 수집해 서버에 1일 1회 전송.
 * 인증된 사용자에 대해서만 호출(서버가 토큰에서 mb_id 추출).
 */
export async function collectAndReportFingerprint(): Promise<void> {
    if (typeof window === 'undefined') return; // SSR 가드
    if (!COLLECTION_ENABLED) return; // 기본 비활성 — 법률검토·공시 후 PUBLIC_FINGERPRINT_ENABLED=true
    try {
        const last = Number(localStorage.getItem(LAST_SENT_KEY) || 0);
        if (Date.now() - last < SEND_THROTTLE_MS) return; // throttle

        const components = collectComponents();
        const deviceId = getOrCreateDeviceId();
        const fpHash = await sha256(stableString(components));

        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                fp_hash: fpHash,
                device_id: deviceId,
                ua: components.ua,
                components // 서버는 해시/요약만 저장; 원시는 미보관
            })
        });
        if (res.ok) localStorage.setItem(LAST_SENT_KEY, String(Date.now()));
    } catch {
        // 탐지 보조 기능 — 실패해도 서비스 흐름에 영향 없음(조용히 무시)
    }
}
