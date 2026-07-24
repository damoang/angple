/**
 * 항목별 평점(aspect rating) — 범용 서버 로직 + PUT 오케스트레이션 (공유 모듈)
 *
 * 앙티티 전용 라우트(api/angtt/[slug]/rating/aspects)의 핵심 흐름을 여기로 뽑아
 * 앙지도 등 일반 게시판(api/boards/[boardId]/[postId]/rating/aspects)이 재사용한다.
 * 앙티티 경로는 target 해석(entities.server)만 자기 것으로 넘기고 나머지(인증·등급·
 * 검증·총점 게이트·응답)를 이 핸들러에 위임한다 — 두 경로의 규약이 한곳에서 정의된다.
 *
 * 저장 규약: angple_rating_aspects(bo_table, wr_id, mb_id, aspect, rating).
 *   - 일반 게시판: bo_table=boardId, wr_id=postId
 *   - 앙티티      : bo_table='@entity', wr_id=entity_id (entities.server 소유)
 * PK(bo_table, wr_id, mb_id, aspect)로 회원당 대상당 항목당 1표. DDL 없음(기존 테이블 재사용).
 */
import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import pool, { readPool } from '$lib/server/db.js';
import { RATING_MIN_LEVEL } from '$lib/components/features/board/post-rating-logic.js';
import { buildGradeDeniedMessage } from '$lib/utils/board-permissions.js';
import { validateAspectsAgainst, type AspectDef } from '$plugins/angtt-review/lib/aspect-presets';

/** 항목별 평점 집계 행(+요청자 본인 값) — 앙티티/일반 공통 표시 모델 */
export interface AspectRating {
    aspect: string;
    avg: number;
    count: number;
    /** 로그인 사용자 본인이 이 항목에 남긴 별점(없으면 null) */
    my: number | null;
}

interface AspectAggRow {
    aspect: string;
    cnt: number;
    avg: number | string | null;
    my: number | null;
}

/**
 * 항목별 평점 집계 — aspect별 {avg, count} + 요청자 본인 값(범용).
 * 세부 평가가 0건이면 빈 배열(옵트인 보장 — UI 미표시). 총점과는 완전 병렬.
 */
export async function getPostAspects(
    boTable: string,
    wrId: number,
    mbId?: string,
    db = readPool
): Promise<AspectRating[]> {
    const [result] = await db.query(
        `SELECT aspect, COUNT(*) AS cnt, AVG(rating) AS avg,
                MAX(CASE WHEN mb_id = ? THEN rating END) AS my
           FROM angple_rating_aspects
          WHERE bo_table = ? AND wr_id = ?
          GROUP BY aspect`,
        [mbId ?? '', boTable, wrId]
    );
    return (result as AspectAggRow[]).map((r) => ({
        aspect: String(r.aspect),
        avg: Number(r.avg ?? 0),
        count: Number(r.cnt ?? 0),
        my: r.my == null ? null : Number(r.my)
    }));
}

/** 본인 총점 별점(angple_post_ratings) 보유 여부 — 항목별 평가 옵트인 게이트. */
export async function hasPostTotalRating(
    boTable: string,
    wrId: number,
    mbId: string
): Promise<boolean> {
    const [rows] = await readPool.query(
        `SELECT 1 FROM angple_post_ratings
          WHERE bo_table = ? AND wr_id = ? AND mb_id = ? LIMIT 1`,
        [boTable, wrId, mbId]
    );
    return (rows as unknown[]).length > 0;
}

/**
 * 항목별 평점 등록/수정 — 행별 UPSERT(회원당 대상당 항목당 1표, 범용).
 * 검증 통과한 aspects(Record)만 받는다(호출부가 프리셋으로 검증). 총점 집계는 무접촉.
 */
export async function putPostAspects(
    boTable: string,
    wrId: number,
    mbId: string,
    aspects: Record<string, number>
): Promise<AspectRating[]> {
    const entries = Object.entries(aspects);
    const placeholders = entries.map(() => '(?, ?, ?, ?, ?, NOW(3), NOW(3))').join(', ');
    const params = entries.flatMap(([aspect, rating]) => [boTable, wrId, mbId, aspect, rating]);
    await pool.query(
        `INSERT INTO angple_rating_aspects
            (bo_table, wr_id, mb_id, aspect, rating, created_at, updated_at)
         VALUES ${placeholders}
         ON DUPLICATE KEY UPDATE rating = VALUES(rating), updated_at = NOW(3)`,
        params
    );
    // 방금 쓴 값을 즉시 정확히 되돌려주려 writer pool 로 재조회(리플리카 지연 회피).
    return getPostAspects(boTable, wrId, mbId, pool);
}

interface ExtendedSettingsRow {
    settings: string | null;
}

/**
 * 게시판이 features.rating 을 켰는지(v2_board_extended_settings) — 읽기 전용.
 * 총점 평점 파이프라인과 동일한 토글을 항목별 평가 게이트로도 재사용한다.
 */
export async function boardHasRatingFeature(boardId: string): Promise<boolean> {
    const [rows] = await readPool.query(
        `SELECT settings FROM v2_board_extended_settings WHERE board_id = ? LIMIT 1`,
        [boardId]
    );
    const row = (rows as ExtendedSettingsRow[])[0];
    if (!row?.settings) return false;
    try {
        const parsed = JSON.parse(row.settings) as { features?: { rating?: boolean } };
        return parsed.features?.rating === true;
    } catch {
        return false;
    }
}

/**
 * PUT 대상 기술서 — 경로별로 다른 부분만 콜백으로 주입한다.
 * preset 이 null 이거나 available=false 면 404(대상 없음/미지원).
 */
export interface AspectPutTarget {
    /** 대상 존재 + 항목별 평가 허용 여부(글 없음·features.rating off 면 false) */
    available: boolean;
    /** 화이트리스트 프리셋. null 이면 항목별 평가 미지원(→404) */
    preset: AspectDef[] | null;
    /** available=false 일 때 404 문구 */
    notFoundMessage?: string;
    /** 본인 총점 별점 보유 여부 */
    hasTotalRating: (mbId: string) => Promise<boolean>;
    /** 총점 미보유 시 403 문구 */
    noTotalRatingMessage?: string;
    /** 검증 통과 aspects 를 UPSERT 하고 최신 집계 반환 */
    upsert: (mbId: string, aspects: Record<string, number>) => Promise<AspectRating[]>;
}

const DEFAULT_NOT_FOUND = '평가할 대상을 찾을 수 없어요.';
const DEFAULT_NO_TOTAL = '먼저 별점(총점)을 남긴 뒤 항목별 평가를 남길 수 있어요.';

/**
 * 항목별 평점 PUT 공통 처리. 규약(양 경로 동일):
 *   1) 로그인 필수(401)
 *   2) 앙님💛(mb_level >= RATING_MIN_LEVEL) 등급 게이트(403)
 *   3) 본문 파싱(400)
 *   4) 대상 해석 — 없음/미지원(404)
 *   5) 프리셋 화이트리스트 + 1~5 검증, 밖이면 전체 거부(400)
 *   6) 본인 총점 별점 보유 게이트(403) — 항목별은 총점의 부가
 *   7) UPSERT → { aspects } 반환
 */
export async function handleAspectsPut(
    event: Pick<RequestEvent, 'locals' | 'request' | 'setHeaders'>,
    resolveTarget: () => Promise<AspectPutTarget>
): Promise<Response> {
    const { locals, request, setHeaders } = event;
    setHeaders({ 'Cache-Control': 'private, no-store' });

    // 1) 인증
    const mbId = locals.user?.id;
    if (!mbId) {
        return json({ error: '항목별 평가를 남기려면 로그인이 필요해요.' }, { status: 401 });
    }

    // 2) 등급 게이트(총점 별점과 동일)
    const level = locals.user?.level ?? 1;
    if (level < RATING_MIN_LEVEL) {
        return json(
            { error: buildGradeDeniedMessage('항목별 평가', RATING_MIN_LEVEL, level) },
            { status: 403 }
        );
    }

    // 3) 본문 파싱
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return json({ error: '요청 본문을 해석할 수 없어요.' }, { status: 400 });
    }
    const raw = (body as { aspects?: unknown } | null)?.aspects;

    // 4) 대상 해석
    const target = await resolveTarget();
    if (!target.available || !target.preset) {
        return json({ error: target.notFoundMessage ?? DEFAULT_NOT_FOUND }, { status: 404 });
    }

    // 5) 프리셋 화이트리스트 + 범위 검증
    const validated = validateAspectsAgainst(target.preset, raw);
    if (!validated.ok) {
        return json({ error: validated.error }, { status: 400 });
    }

    // 6) 본인 총점 게이트 — 항목별 평가는 총점의 부가
    const hasTotal = await target.hasTotalRating(mbId);
    if (!hasTotal) {
        return json({ error: target.noTotalRatingMessage ?? DEFAULT_NO_TOTAL }, { status: 403 });
    }

    // 7) UPSERT
    const aspects = await target.upsert(mbId, validated.aspects);
    return json({ aspects });
}
