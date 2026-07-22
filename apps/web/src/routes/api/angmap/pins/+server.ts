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
        .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
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
