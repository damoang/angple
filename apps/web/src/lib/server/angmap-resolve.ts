/**
 * 앙지도(angmap) 지도 링크 → 장소(좌표·상호·주소) 해소 — 서버 전용
 *
 * 해소 경로 (2026-07 실측 기반):
 *   정규화 → URL 좌표 직파싱 → 단축링크 해소(리다이렉트 수동 추적, allowlist 가드)
 *   → place 페이지 파싱
 * - google: 최종 URL의 !3d{lat}!4d{lng}(핀 좌표, 우선) / @lat,lng(지도 중심, 폴백)
 * - naver: m.place.naver.com HTML의 임베디드 상태 JSON에서 좌표·상호·주소 추출
 *   (naver.me는 hop1 리다이렉트가 이미 share?id={placeId})
 * - kakao: place.map.kakao.com og 메타(상호·도로명주소)만 — 좌표는 Kakao Local REST
 *   키 확보 후 연동 예정 → status='no_coords'로 반환 (kko.to는 HEAD 405, GET 필수)
 *
 * ⚠️ 백필(resolver) 트랙과 파싱 로직이 중복될 수 있음 — 통합 시 순수 파싱은
 *    $lib/utils/angmap-link.ts + 이 파일의 export 순수 함수를 기준으로 맞춘다.
 */
import { normalizeMapUrl, isSupportedMapUrl } from '$lib/utils/angmap-link.js';

export type AngmapProvider = 'naver' | 'kakao' | 'google';
export type AngmapResolveStatus = 'ok' | 'no_coords' | 'dead_link';

export interface AngmapResolvedPlace {
    provider: AngmapProvider;
    placeId: string | null;
    name: string | null;
    roadAddress: string | null;
    lat: number | null;
    lng: number | null;
    sourceUrl: string;
    status: AngmapResolveStatus;
}

const RESOLVE_TIMEOUT_MS = 3500;
const MAX_REDIRECT_HOPS = 5;
/** 실측에 사용한 모바일 Safari UA — 데스크톱 UA는 네이버가 지도 홈으로 보내는 경우가 있다 */
const MOBILE_UA =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const SHORTLINK_HOSTS = new Set(['naver.me', 'kko.to', 'maps.app.goo.gl', 'goo.gl']);

// ── 순수 파싱 함수 (vitest 대상) ────────────────────────────────────────────

/** 위경도 유효성 (0,0 은 해소 실패로 취급) */
export function isValidLatLng(lat: number, lng: number): boolean {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (lat === 0 && lng === 0) return false;
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * 구글 지도 URL 좌표 파싱.
 * `!3d{lat}!4d{lng}` = 핀 좌표(우선), `@lat,lng` = 지도 중심(폴백).
 * `/maps/place/{이름}` 경로에서 상호명도 추출 (URL 디코드, '+' → 공백).
 */
export function parseGoogleCoords(
    url: string
): { lat: number; lng: number; name: string | null } | null {
    const pin = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    const center = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    const m = pin ?? center;
    if (!m) return null;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (!isValidLatLng(lat, lng)) return null;

    let name: string | null = null;
    const nameMatch = url.match(/\/maps\/place\/([^/@?#]+)/);
    if (nameMatch) {
        try {
            name = decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')).trim() || null;
        } catch {
            name = null;
        }
    }
    return { lat, lng, name };
}

/** map.naver.com URL의 lat=/lng= 쿼리 파싱 */
export function parseNaverMapCoords(u: URL): { lat: number; lng: number } | null {
    const lat = Number(u.searchParams.get('lat'));
    const lng = Number(u.searchParams.get('lng'));
    if (!u.searchParams.has('lat') || !u.searchParams.has('lng')) return null;
    if (!isValidLatLng(lat, lng)) return null;
    return { lat, lng };
}

/**
 * 카카오 applink 길찾기 URL 파싱.
 * `applink.map.kakao.com/route?ep={lat},{lng}&en={상호}` — 좌표·상호 직접 포함.
 */
export function parseKakaoRouteCoords(
    u: URL
): { lat: number; lng: number; name: string | null } | null {
    if (!u.pathname.startsWith('/route')) return null;
    const ep = u.searchParams.get('ep');
    if (!ep) return null;
    const [latStr, lngStr] = ep.split(',');
    const lat = Number(latStr);
    const lng = Number(lngStr);
    if (!isValidLatLng(lat, lng)) return null;
    const name = u.searchParams.get('en')?.trim() || null;
    return { lat, lng, name };
}

/**
 * 네이버 placeId 추출.
 * - m.place.naver.com / place.naver.com: `/{restaurant|place|...}/{id}` 경로
 * - naver.me hop1: `m.place.naver.com/share?id={id}`
 * - m.map.naver.com appLink: `pinId={id}` (아웃라이어 — /place/{pinId}로 접근 가능)
 * - map.naver.com: `/p/entry/place/{id}`, `/v5/entry/place/{id}`
 */
export function extractNaverPlaceId(u: URL): string | null {
    const host = u.hostname.toLowerCase();
    if (host === 'm.place.naver.com' || host === 'place.naver.com') {
        const shareId = u.searchParams.get('id');
        if (u.pathname.startsWith('/share') && shareId && /^\d+$/.test(shareId)) return shareId;
        const path = u.pathname.match(/^\/[a-z-]+\/(\d+)/);
        if (path) return path[1];
        return null;
    }
    if (host === 'm.map.naver.com') {
        const pinId = u.searchParams.get('pinId');
        if (pinId && /^\d+$/.test(pinId)) return pinId;
        return null;
    }
    if (host === 'map.naver.com') {
        const entry = u.pathname.match(/\/entry\/place\/(\d+)/);
        if (entry) return entry[1];
        return null;
    }
    return null;
}

/**
 * 카카오 placeId 추출.
 * - place.map.kakao.com/{id}
 * - kko.to hop1: `applink.map.kakao.com/place?id={id}`
 * - map.kakao.com: `itemId={id}`
 */
export function extractKakaoPlaceId(u: URL): string | null {
    const host = u.hostname.toLowerCase();
    if (host === 'place.map.kakao.com') {
        const path = u.pathname.match(/^\/(\d+)/);
        if (path) return path[1];
        return null;
    }
    if (host === 'applink.map.kakao.com') {
        const id = u.searchParams.get('id');
        if (u.pathname.startsWith('/place') && id && /^\d+$/.test(id)) return id;
        return null;
    }
    if (host === 'map.kakao.com') {
        const itemId = u.searchParams.get('itemId');
        if (itemId && /^\d+$/.test(itemId)) return itemId;
        return null;
    }
    return null;
}

/** JSON 문자열 값의 escape(\", \uXXXX 등) 해제 */
function decodeJsonString(s: string): string {
    try {
        return JSON.parse(`"${s}"`) as string;
    } catch {
        return s;
    }
}

/** 기본 HTML 엔티티 해제 (og content 용) */
function decodeHtmlEntities(s: string): string {
    return s
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'");
}

/** og:{prop} 메타 content 추출 (속성 순서 양방향 지원) */
export function parseOgTag(html: string, prop: string): string | null {
    const re1 = new RegExp(
        `<meta[^>]*property=["']og:${prop}["'][^>]*content=["']([^"']*)["']`,
        'i'
    );
    const re2 = new RegExp(
        `<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:${prop}["']`,
        'i'
    );
    const m = html.match(re1) ?? html.match(re2);
    return m ? decodeHtmlEntities(m[1]).trim() || null : null;
}

/**
 * 네이버 place 페이지 HTML 파싱 — 임베디드 상태 JSON(정적 HTML에 포함)에서
 * 좌표(x=경도, y=위도)·상호·도로명주소를 추출한다. og:title("{상호} : 네이버")은 폴백.
 * 비공식 구조 — 파싱 실패 시 null (상위에서 no_coords/dead_link 처리).
 */
export function parseNaverPlaceHtml(html: string): {
    name: string | null;
    roadAddress: string | null;
    lat: number | null;
    lng: number | null;
} | null {
    const coord = html.match(/"x"\s*:\s*"(-?\d+(?:\.\d+)?)"\s*,\s*"y"\s*:\s*"(-?\d+(?:\.\d+)?)"/);
    const nameM = html.match(/"name"\s*:\s*"((?:[^"\\]|\\.)+)"/);
    const roadM = html.match(/"roadAddress"\s*:\s*"((?:[^"\\]|\\.)+)"/);

    let name = nameM ? decodeJsonString(nameM[1]) : null;
    if (!name) {
        const ogTitle = parseOgTag(html, 'title');
        if (ogTitle) name = ogTitle.replace(/\s*:\s*네이버.*$/, '').trim() || null;
    }
    const roadAddress = roadM ? decodeJsonString(roadM[1]) : null;

    let lat: number | null = null;
    let lng: number | null = null;
    if (coord) {
        const x = Number(coord[1]); // 경도
        const y = Number(coord[2]); // 위도
        if (isValidLatLng(y, x)) {
            lat = y;
            lng = x;
        }
    }

    if (!name && lat === null) return null;
    return { name, roadAddress, lat, lng };
}

// ── 서버 fetch 오케스트레이션 ───────────────────────────────────────────────

/** 리다이렉트 추적 허용 호스트 (SSRF 가드 — 지도 서비스 계열만) */
function isResolvableHost(hostname: string): boolean {
    const host = hostname.toLowerCase();
    if (host === 'naver.me' || host === 'kko.to' || host === 'goo.gl') return true;
    if (host === 'naver.com' || host.endsWith('.naver.com')) return true;
    if (host === 'kakao.com' || host.endsWith('.kakao.com')) return true;
    if (host === 'google.com' || host.endsWith('.google.com')) return true;
    if (host === 'maps.app.goo.gl') return true;
    return false;
}

/**
 * 단축링크 리다이렉트 수동 추적 (최대 5홉).
 * 각 홉의 Location 호스트를 allowlist로 검증 — open redirect 를 통한 SSRF 차단.
 * kko.to 가 HEAD 를 405로 막으므로 전 구간 GET 사용 (body 는 즉시 취소).
 */
async function followRedirects(startUrl: string): Promise<string | null> {
    let current = startUrl;
    for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
        const res = await fetch(current, {
            method: 'GET',
            redirect: 'manual',
            headers: { 'user-agent': MOBILE_UA },
            signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS)
        });
        try {
            void res.body?.cancel();
        } catch {
            // body 취소 실패는 무시
        }
        if (res.status >= 300 && res.status < 400) {
            const loc = res.headers.get('location');
            if (!loc) return null;
            let next: URL;
            try {
                next = new URL(loc, current);
            } catch {
                return null;
            }
            // 앱스킴(intent:// 등) 리다이렉트는 해소 실패로 취급
            if (next.protocol !== 'https:' && next.protocol !== 'http:') return null;
            if (!isResolvableHost(next.hostname)) return null;
            current = next.toString();
            continue;
        }
        return res.ok ? current : null;
    }
    return null;
}

/** place 페이지 HTML 1회 GET (모바일 UA, 타임아웃) */
async function fetchHtml(url: string): Promise<string | null> {
    const res = await fetch(url, {
        method: 'GET',
        headers: { 'user-agent': MOBILE_UA },
        signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS)
    });
    if (!res.ok) return null;
    return res.text();
}

function makePlace(
    partial: Partial<AngmapResolvedPlace> & { provider: AngmapProvider; sourceUrl: string }
): AngmapResolvedPlace {
    return {
        placeId: null,
        name: null,
        roadAddress: null,
        lat: null,
        lng: null,
        status: partial.lat != null && partial.lng != null ? 'ok' : 'no_coords',
        ...partial
    };
}

/** 확장(최종) URL 을 provider 별로 해소 */
async function resolveExpandedUrl(u: URL, sourceUrl: string): Promise<AngmapResolvedPlace | null> {
    const host = u.hostname.toLowerCase();

    // 구글 — URL 에 좌표 직접
    if (host === 'google.com' || host.endsWith('.google.com')) {
        const coords = parseGoogleCoords(u.toString());
        if (!coords) return makePlace({ provider: 'google', sourceUrl, status: 'no_coords' });
        return makePlace({ provider: 'google', sourceUrl, ...coords });
    }

    // 카카오 길찾기 applink — 좌표·상호 직접
    const kakaoRoute = host === 'applink.map.kakao.com' ? parseKakaoRouteCoords(u) : null;
    if (kakaoRoute) {
        return makePlace({ provider: 'kakao', sourceUrl, ...kakaoRoute });
    }

    // 네이버 지도 URL 좌표 직접
    if (host === 'map.naver.com') {
        const coords = parseNaverMapCoords(u);
        if (coords) return makePlace({ provider: 'naver', sourceUrl, ...coords });
    }

    // 네이버 placeId → place 페이지 1fetch
    const naverId = extractNaverPlaceId(u);
    if (naverId) {
        const isPlacePage =
            (host === 'm.place.naver.com' || host === 'place.naver.com') &&
            !u.pathname.startsWith('/share');
        const pageUrl = isPlacePage ? u.toString() : `https://m.place.naver.com/place/${naverId}`;
        const html = await fetchHtml(pageUrl);
        if (!html) {
            return makePlace({
                provider: 'naver',
                placeId: naverId,
                sourceUrl,
                status: 'dead_link'
            });
        }
        const parsed = parseNaverPlaceHtml(html);
        if (!parsed) {
            return makePlace({
                provider: 'naver',
                placeId: naverId,
                sourceUrl,
                status: 'no_coords'
            });
        }
        return makePlace({ provider: 'naver', placeId: naverId, sourceUrl, ...parsed });
    }

    // 카카오 placeId → og 메타(상호·도로명주소). 좌표는 Local REST 키 확보 후.
    const kakaoId = extractKakaoPlaceId(u);
    if (kakaoId) {
        const html = await fetchHtml(`https://place.map.kakao.com/${kakaoId}`);
        if (!html) {
            return makePlace({
                provider: 'kakao',
                placeId: kakaoId,
                sourceUrl,
                status: 'dead_link'
            });
        }
        const name = parseOgTag(html, 'title');
        const roadAddress = parseOgTag(html, 'description');
        return makePlace({ provider: 'kakao', placeId: kakaoId, sourceUrl, name, roadAddress });
    }

    return null;
}

/**
 * 지도 링크 1건을 장소로 해소한다. 실패(미지원/파싱 불가)는 null,
 * 링크 자체가 죽었으면 status='dead_link' 로 반환.
 */
export async function resolveMapUrl(rawUrl: string): Promise<AngmapResolvedPlace | null> {
    const normalized = normalizeMapUrl(rawUrl);
    let u: URL;
    try {
        u = new URL(normalized);
    } catch {
        return null;
    }
    if (!isSupportedMapUrl(u)) return null;

    try {
        if (SHORTLINK_HOSTS.has(u.hostname.toLowerCase())) {
            const finalUrl = await followRedirects(normalized);
            if (!finalUrl) {
                // provider 추정: 단축 도메인 기준
                const provider: AngmapProvider = u.hostname.includes('naver')
                    ? 'naver'
                    : u.hostname.includes('kko')
                      ? 'kakao'
                      : 'google';
                return makePlace({ provider, sourceUrl: normalized, status: 'dead_link' });
            }
            u = new URL(finalUrl);
        }
        return await resolveExpandedUrl(u, normalized);
    } catch (err) {
        console.error('[angmap resolve] error:', err instanceof Error ? err.message : err);
        return null;
    }
}
