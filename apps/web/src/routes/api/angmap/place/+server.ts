/**
 * POST /api/angmap/place — 글의 지도 링크를 좌표로 해소해 angmap_places 에 기록
 *
 * ⭐ 왜 필요한가 (2026-07-31 실측)
 *   `angmap_places` 에 좌표를 **기록하는 코드가 레포 전체에 없었다**(웹·백엔드·프리미엄 0건,
 *   크론도 없음). 7/22~24 수동 백필 1,623건 이후 유입이 멈춰, 앙지도 게시판에 글을 써도
 *   지도에 핀이 뜨지 않았다(최근 글 4건 중 2건 누락). 이 엔드포인트가 그 빈 자리를 채운다.
 *
 * ⛔ 왜 글 저장 트랜잭션 밖인가
 *   글 저장은 Go 백엔드 직행이라 웹에 후처리 훅이 없고, 해소기(resolveMapUrl)는 외부 fetch·
 *   파싱이 무거운 TypeScript 다. Go 로 재구현하면 로직이 두 벌로 갈라진다.
 *   → 작성 성공 직후 브라우저가 이 엔드포인트를 부른다. 실패해도 글은 남는다(핀만 안 뜬다).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool, { readPool } from '$lib/server/db.js';
import { createCache } from '$lib/server/cache.js';
import {
    resolveMapUrl,
    isValidLatLng,
    type AngmapResolvedPlace
} from '$lib/server/angmap-resolve.js';
import { findMapLink } from '$lib/utils/angmap-link.js';

/**
 * ⛔ angmap 게시판 전용이다.
 *
 * `angmap_places` 의 PK 는 `wr_id` **단일**이라 보드 구분이 없다. 다른 보드를 허용하면
 * wr_id 가 겹치는 순간(free 6872517 ↔ angmap 6872517) 엉뚱한 글에 좌표가 붙는다.
 * 자유게시판 확장은 스키마에 bo_table 을 추가하는 별도 단계에서만 열 것.
 */
const ALLOWED_BOARD = 'angmap';

/** resolve API 와 같은 정책 — 같은 가게 재공유가 잦다 */
const resolveCache = createCache<AngmapResolvedPlace | null>({ ttl: 600_000, maxSize: 300 });

interface PostRow extends RowDataPacket {
    mb_id: string;
    wr_link1: string | null;
    wr_link2: string | null;
}

export const POST: RequestHandler = async ({ request, locals }) => {
    const userId = locals.user?.id;
    if (!userId) {
        return json({ saved: false, reason: 'unauthorized' }, { status: 401 });
    }

    let body: { boardId?: string; wrId?: number; url?: string } = {};
    try {
        body = await request.json();
    } catch {
        return json({ saved: false, reason: 'bad_request' }, { status: 400 });
    }

    const wrId = Number(body.wrId);
    if (body.boardId !== ALLOWED_BOARD || !Number.isInteger(wrId) || wrId <= 0) {
        // 다른 보드는 조용히 무시한다 — 호출부가 보드를 가리지 않아도 안전하도록.
        return json({ saved: false, reason: 'not_applicable' });
    }

    // ⛔ 작성자 본인 확인. 로그인만으로는 부족하다 — 남의 wr_id 로 좌표를 심을 수 있다.
    let post: PostRow | undefined;
    try {
        const [rows] = await readPool.query<PostRow[]>(
            `SELECT mb_id, wr_link1, wr_link2
               FROM g5_write_angmap
              WHERE wr_id = ? AND wr_is_comment = 0
              LIMIT 1`,
            [wrId]
        );
        post = rows[0];
    } catch (err) {
        console.error('[angmap/place] 글 조회 실패:', err);
        return json({ saved: false, reason: 'lookup_failed' }, { status: 500 });
    }

    if (!post) {
        return json({ saved: false, reason: 'not_found' }, { status: 404 });
    }
    if (post.mb_id !== userId) {
        return json({ saved: false, reason: 'forbidden' }, { status: 403 });
    }

    // 링크 후보: 요청값 → 글의 link1/link2. **본문은 보지 않는다.**
    //
    // ⛔ 본문을 스캔하면 작성폼의 동의 절차가 무력해진다. 확인 칩은 "이 장소 맞나요?" 를
    //    물어 [연결] 을 누른 경우에만 link1/link2 를 채우도록 설계돼 있는데(post-form.svelte
    //    acceptAngmapSuggestion), 서버가 본문을 다시 훑으면 [무시] 를 누른 사람의 글에도
    //    핀이 박힌다. 링크 필드만 보면 "작성자가 동의한 것"과 정확히 일치한다.
    // 본문에만 링크가 있는 기존 글(실측 780건)은 백필 트랙에서 별도로 다룬다.
    //
    // findMapLink 가 allowlist(MAP_LINK_HOSTS) 밖 URL 을 거부하므로 SSRF 가드는 여기서 걸린다.
    const candidate =
        findMapLink(String(body.url ?? '').slice(0, 500)) ??
        findMapLink(post.wr_link1 ?? '') ??
        findMapLink(post.wr_link2 ?? '');

    if (!candidate) {
        return json({ saved: false, reason: 'no_map_link' });
    }

    const place = await resolveCache.getOrSet(`angmap:resolve:${candidate}`, () =>
        resolveMapUrl(candidate)
    );
    if (!place) {
        return json({ saved: false, reason: 'resolve_failed' });
    }

    // ⛔ 좌표를 못 구해도 **행은 남긴다.** "시도한 적 없음"과 "시도했으나 실패"를 구분해야
    //    백필·재시도가 근거를 갖는다. 기존 데이터가 이미 그 규약이다(실측: no_coords 124행 +
    //    ambiguous 6행이 전부 lat=0,lng=0 센티널). NOT NULL 이라 못 넣는다는 건 사실이 아니다.
    //
    // ⛔ 축 하나만 0 인 좌표도 저장하지 않는다. 읽기 쪽 isPlottable(핀맵·미니맵)은 어느 한
    //    축이라도 0 이면 제외하므로, 'ok' 로 넣어봐야 지도에 영원히 안 뜨는 유령 행이 된다.
    //    쓰기 가드를 읽기 가드와 같은 규약으로 맞춘다.
    if (
        place.lat === null ||
        place.lng === null ||
        !isValidLatLng(place.lat, place.lng) ||
        place.lat === 0 ||
        place.lng === 0
    ) {
        const status = place.status === 'ok' ? 'no_coords' : place.status;
        try {
            await upsertPlace({
                wrId,
                provider: place.provider,
                placeId: place.placeId,
                name: place.name,
                roadAddress: place.roadAddress,
                lat: 0,
                lng: 0,
                sourceUrl: candidate,
                status
            });
        } catch (err) {
            console.error('[angmap/place] 실패 기록 저장 실패:', err);
        }
        return json({ saved: false, reason: status });
    }

    try {
        await upsertPlace({
            wrId,
            provider: place.provider,
            placeId: place.placeId,
            name: place.name,
            roadAddress: place.roadAddress,
            lat: place.lat,
            lng: place.lng,
            sourceUrl: candidate,
            status: 'ok'
        });
    } catch (err) {
        console.error('[angmap/place] 저장 실패:', err);
        return json({ saved: false, reason: 'write_failed' }, { status: 500 });
    }

    return json({ saved: true, name: place.name, provider: place.provider });
};

/** varchar(255) 컬럼 — strict mode 에서 초과분은 1406 에러라 저장 자체가 실패한다 */
function clip(v: string | null | undefined): string | null {
    if (!v) return null;
    return v.length > 255 ? v.slice(0, 255) : v;
}

/**
 * `angmap_places` UPSERT — PK 는 wr_id 단일이라 같은 글을 몇 번 불러도 행은 하나다.
 * ⛔ ON DUPLICATE 절이 PK 외 **전 컬럼**을 덮는다. 하나라도 빠뜨리면 실패 기록 위에
 *    성공 값이 섞여 들어가(또는 그 반대) 어느 쪽도 신뢰할 수 없는 행이 남는다.
 */
async function upsertPlace(p: {
    wrId: number;
    provider: string;
    placeId: string | null;
    name: string | null;
    roadAddress: string | null;
    lat: number;
    lng: number;
    sourceUrl: string;
    status: string;
}): Promise<void> {
    await pool.query<ResultSetHeader>(
        `INSERT INTO angmap_places
             (wr_id, provider, place_id, name, road_address, lat, lng, source_url,
              resolve_status, resolved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
             provider = VALUES(provider), place_id = VALUES(place_id),
             name = VALUES(name), road_address = VALUES(road_address),
             lat = VALUES(lat), lng = VALUES(lng),
             source_url = VALUES(source_url),
             resolve_status = VALUES(resolve_status), resolved_at = NOW()`,
        [
            p.wrId,
            p.provider,
            clip(p.placeId),
            clip(p.name),
            clip(p.roadAddress),
            p.lat,
            p.lng,
            clip(p.sourceUrl),
            p.status
        ]
    );
}
