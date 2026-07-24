/**
 * 앙지도(angmap) 글 1건의 좌표 조회 — 상세 미니맵용, 읽기 전용.
 *
 * angmap_places(resolve_status='ok') 에서 해당 글의 좌표·상호·provider 를 읽는다.
 * 좌표는 별도 백필 트랙이 채운다 — 이 경로는 무접촉(읽기만). 좌표가 없거나 센티널
 * (축이 정확히 0)인 글은 null 을 반환해 상세에서 지도를 아예 그리지 않는다(빈 박스 금지).
 *
 * ⛔ 글로벌 원칙: 특정 국가/대륙 범위로 거르지 말 것. 해외 장소 핀이 실재한다.
 *    좌표 유효성(범위·축 0)만 본다 — angmap-pin-map/pins 의 isPlottable 과 동일 규약.
 */
import { readPool } from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

/** 상세 미니맵에 주입할 좌표 모델 */
export interface AngmapPlaceCoord {
    lat: number;
    lng: number;
    name: string | null;
    provider: string;
}

interface PlaceRow extends RowDataPacket {
    name: string | null;
    lat: string | number;
    lng: string | number;
    provider: string;
}

/**
 * 좌표가 지도에 찍을 수 있는지 — 지리적 가정이 아니라 센티널/범위 방어.
 * 축이 정확히 0 인 경우만 배제(해소 실패의 흔적). 나머지는 좌표만 본다.
 */
function isPlottable(lat: number, lng: number): boolean {
    return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180 &&
        lat !== 0 &&
        lng !== 0
    );
}

/**
 * angmap 글의 좌표를 조회한다. 좌표 없음·비밀글·해소 실패면 null.
 * 실패는 조용히 null(미니맵은 부가 기능 — 상세 로드를 절대 막지 않는다).
 */
export async function getAngmapPlace(wrId: number): Promise<AngmapPlaceCoord | null> {
    if (!Number.isFinite(wrId) || wrId <= 0) return null;
    try {
        const [rows] = await readPool.query<PlaceRow[]>(
            `SELECT p.name, p.lat, p.lng, p.provider
               FROM angmap_places p
               INNER JOIN g5_write_angmap w
                   ON w.wr_id = p.wr_id AND w.wr_is_comment = 0
              WHERE p.wr_id = ?
                AND p.resolve_status = 'ok'
                AND w.wr_option NOT LIKE '%secret%'
              LIMIT 1`,
            [wrId]
        );
        const row = rows[0];
        if (!row) return null;
        const lat = Number(row.lat);
        const lng = Number(row.lng);
        if (!isPlottable(lat, lng)) return null;
        return { lat, lng, name: row.name, provider: row.provider };
    } catch (err) {
        console.error('[angmap place] error:', err instanceof Error ? err.message : err);
        return null;
    }
}
