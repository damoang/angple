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
const SESSION_SENT_KEY = 'da_fp_session_sent'; // 이 브라우저 세션 성공 전송 마커(재로그인 재수집용)
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

/** 안전한 storage 접근 (사생활 모드 등에서 throw 가능) */
function safeGet(store: Storage | undefined, key: string): string | null {
    try {
        return store ? store.getItem(key) : null;
    } catch {
        return null;
    }
}
function safeSet(store: Storage | undefined, key: string, val: string): void {
    try {
        store?.setItem(key, val);
    } catch {
        // 저장 불가 — 무해(throttle 우회가 계속될 뿐)
    }
}

/** 1회 전송 시도. 'skip'=이번 세션 이미 성공+throttle 이내, 'ok'/'fail'=전송 결과. */
async function attemptSend(): Promise<'ok' | 'fail' | 'skip'> {
    // 24h throttle 은 유지하되, 이 브라우저 세션에서 아직 성공 전송한 적 없으면(sessionStorage
    // 마커 부재) throttle 을 우회해 1회 재전송한다 — 재로그인/새 세션마다 최신 IP 갱신 +
    // 이전 세션 실패 만회. (#13022 트랙: fp 커버리지 P1)
    const sentThisSession =
        safeGet(
            typeof sessionStorage !== 'undefined' ? sessionStorage : undefined,
            SESSION_SENT_KEY
        ) === '1';
    const last = Number(safeGet(localStorage, LAST_SENT_KEY) || 0);
    if (sentThisSession && Date.now() - last < SEND_THROTTLE_MS) return 'skip';

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
    // ⚠️ 서버는 저장 실패·비활성 시에도 HTTP 200 + {success:false} 를 준다(재시도 폭주 방지).
    // res.ok 만으로 성공 판정하면 실패에도 throttle 이 걸려 조용히 유실됨 → body 로 확정.
    let ok = false;
    if (res.ok) {
        try {
            const body = await res.json();
            ok = body?.success === true;
        } catch {
            ok = false;
        }
    }
    if (ok) {
        safeSet(localStorage, LAST_SENT_KEY, String(Date.now()));
        safeSet(
            typeof sessionStorage !== 'undefined' ? sessionStorage : undefined,
            SESSION_SENT_KEY,
            '1'
        );
    }
    return ok ? 'ok' : 'fail';
}

/**
 * 핑거프린트를 수집해 서버에 전송(성공 시 기기당 1일 1회, 새 세션마다 재확인).
 * 전송 실패 시 세션 내 백오프로 최대 3회 재시도 — 토큰 레이스·일시 오류로 인한 유실 방지.
 * 인증된 사용자에 대해서만 호출(서버가 토큰에서 mb_id 추출).
 */
export async function collectAndReportFingerprint(): Promise<void> {
    if (typeof window === 'undefined') return; // SSR 가드
    if (!COLLECTION_ENABLED) return; // 기본 비활성 — 법률검토·공시 후 PUBLIC_FINGERPRINT_ENABLED=true
    const backoffMs = [0, 3000, 15000]; // 즉시 → 3s → 15s
    for (let i = 0; i < backoffMs.length; i++) {
        try {
            if (backoffMs[i] > 0) await new Promise((r) => setTimeout(r, backoffMs[i]));
            const r = await attemptSend();
            if (r === 'ok' || r === 'skip') return; // 성공 또는 이미 전송됨
        } catch {
            // 네트워크 예외 — 다음 백오프에서 재시도
        }
    }
    // 3회 모두 실패 — throttle 미설정이므로 다음 페이지 로드/세션에서 다시 시도됨
}
