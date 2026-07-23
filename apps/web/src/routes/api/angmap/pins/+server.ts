/**
 * GET /api/angmap/pins
 *
 * 앙지도 목록 상단 핀맵 전용 — angmap_places(resolve_status='ok') 전량 + 글 제목 join.
 * 좌표 확보 글은 ~1.5k행 규모라 전량 응답 + 서버 60초 캐시로 충분하다.
 * angmap_places 는 별도 백필 트랙이 채운다 — 이 경로는 읽기 전용.
 *
 * 비로그인 열람 허용 (앙지도 목록 자체가 공개 게시판). 비밀글은 핀에서 제외.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readPool } from '$lib/server/db.js';
import { createCache } from '$lib/server/cache.js';
import type { RowDataPacket } from 'mysql2';

interface AngmapPin {
    id: number;
    title: string;
    name: string | null;
    lat: number;
    lng: number;
    provider: string;
}

interface PinRow extends RowDataPacket {
    wr_id: number;
    wr_subject: string;
    name: string | null;
    lat: string | number;
    lng: string | number;
    provider: string;
}

const pinsCache = createCache<AngmapPin[]>({ ttl: 60_000, maxSize: 4 });

/**
 * 지도에 찍을 수 있는 좌표인지. **지리적 가정이 아니라 센티널/범위 방어**다.
 *
 * 2026-07-23: 백필 배치가 네이버 URL 의 줌 파라미터를 좌표로 오독해
 * `lat=0 / lng=15` 인 핀 20개를 'ok' 로 내보냈고, 지도의 fitBounds 가 이를 포함해
 * 초기 뷰가 지구 전체로 벌어졌다. 근본 원인은 배치에서 고쳤지만,
 * 배치가 다시 깨져도 지도는 무너지지 않도록 표시 직전에 한 겹 더 막는다.
 *
 * ⛔ 특정 국가/대륙 범위로 거르지 말 것 — 다모앙은 글로벌이고 해외 장소 핀이 실제로 있다.
 * 축이 정확히 0 인 경우만 배제한다: 좌표 정밀도가 소수점 7자리(적도에서 약 1cm)라
 * 실제 장소가 정확히 0.0000000 으로 저장될 일은 사실상 없고, 해소 실패의 흔적일 뿐이다.
 */
function isPlottable(p: AngmapPin): boolean {
    return (
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lng) &&
        p.lat >= -90 &&
        p.lat <= 90 &&
        p.lng >= -180 &&
        p.lng <= 180 &&
        p.lat !== 0 &&
        p.lng !== 0
    );
}

async function loadPins(): Promise<AngmapPin[]> {
    const [rows] = await readPool.query<PinRow[]>(
        `SELECT p.wr_id, p.name, p.lat, p.lng, p.provider, w.wr_subject
         FROM angmap_places p
         INNER JOIN g5_write_angmap w
             ON w.wr_id = p.wr_id AND w.wr_is_comment = 0
         WHERE p.resolve_status = 'ok'
           AND w.wr_option NOT LIKE '%secret%'`
    );
    return rows
        .map((r) => ({
            id: r.wr_id,
            title: r.wr_subject,
            name: r.name,
            lat: Number(r.lat),
            lng: Number(r.lng),
            provider: r.provider
        }))
        .filter(isPlottable);
}

export const GET: RequestHandler = async () => {
    try {
        const pins = await pinsCache.getOrSet('angmap:pins', loadPins);
        return json({ pins }, { headers: { 'cache-control': 'public, max-age=60' } });
    } catch (err) {
        // 핀맵은 부가 기능 — 실패해도 목록 열람엔 영향 없도록 빈 배열로 응답
        console.error('[angmap pins] error:', err instanceof Error ? err.message : err);
        return json({ pins: [] }, { headers: { 'cache-control': 'no-store' } });
    }
};
