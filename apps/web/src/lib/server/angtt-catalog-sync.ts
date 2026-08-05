/**
 * 앙티티 작품 사전 자동 채우기 — A단계 (수집 + upsert).
 *
 * ## 왜 필요한가
 *
 * `angple_entities` 에 작품이 5개뿐이라(호프·동궁·참교육 외 2), 자동 연결(#1818)이
 * 걸릴 사전 자체가 비어 있었다. 「오디세이」·「스파이더맨」은 **등록조차 안 된 상태**라
 * 글이 아무리 많아도 카드가 붙지 않았다. 개봉은 매주 있는데 등록은 손으로 했다.
 *
 * ## ⛔ 기존 안전장치를 무너뜨리지 않는다
 *
 * `angtt-auto-link.ts` 는 의도적으로 보수적이다 — 작품별 옵트인(`meta.auto_link`)과
 * 문맥어(`meta.context_terms`)를 요구한다. 「참교육」처럼 일반어와 겹치는 제목,
 * 「호프」처럼 생맥주집을 뜻하기도 하는 제목 때문이다.
 *
 * 수백 편을 `auto_link: true` 로 쏟아부으면 그 설계가 무너진다. 그래서 **A단계는
 * 전부 `status='pending'` · `auto_link` 미설정으로만 넣는다.** 자동 활성화 규칙은
 * B단계에서 별도로 판단한다.
 *
 * ## ⛔ 기존 행의 meta 는 절대 덮어쓰지 않는다
 *
 * 지금 있는 5개의 `context_terms` 는 사람이 손으로 고른 것이다(「호프」는 30개).
 * upsert 가 이걸 날리면 자동 연결 품질이 통째로 떨어진다.
 */
import pool from '$lib/server/db';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { normalizeWorkTitle } from './angtt-dictionary-logic';

/** TMDB 는 페이지당 20건. 개봉작은 몇 페이지면 충분하다 — 전량 크롤이 목적이 아니다. */
const MAX_PAGES = 3;

/** 한 번에 처리할 상한. 폭주 방지. */
const MAX_ITEMS = 120;

export interface CatalogSyncResult {
    /** TMDB 에서 받은 건수 */
    fetched: number;
    /** 새로 등록한 작품 */
    inserted: number;
    /** 이미 있어 건드리지 않은 작품 */
    skipped: number;
    /** 제목이 비었거나 정규화 후 빈 값이라 버린 건 */
    invalid: number;
    /** 사람이 읽을 요약 — ⛔ 내부 API 응답에 반드시 실어야 한다(아래 주석 참조) */
    message: string;
}

interface TmdbMovie {
    id: number;
    title?: string;
    original_title?: string;
    poster_path?: string | null;
    release_date?: string | null;
}

function tmdbKey(): string | null {
    // ⛔ 폴백을 만들지 말 것. `env.A || env.B` 는 사고 기계다 — 어느 값이 쓰였는지
    //    아무도 모르게 된다. SOPS 가 단일 근원이고, 없으면 없는 것이다.
    const k = process.env.TMDB_API_KEY;
    return k && k.trim() ? k.trim() : null;
}

async function fetchPage(key: string, path: string, page: number): Promise<TmdbMovie[]> {
    const url = `https://api.themoviedb.org/3/movie/${path}?language=ko-KR&region=KR&page=${page}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${key}`, accept: 'application/json' },
        signal: AbortSignal.timeout(10_000)
    });
    if (!res.ok) throw new Error(`TMDB ${path} p${page} → HTTP ${res.status}`);
    const json = (await res.json()) as { results?: TmdbMovie[] };
    return json.results ?? [];
}

/** 별칭 목록 — 한국어 제목·원제. 정규화 후 중복 제거. */
function buildAliases(m: TmdbMovie): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of [m.title, m.original_title]) {
        const t = (raw ?? '').trim();
        if (!t) continue;
        const norm = normalizeWorkTitle(t);
        if (!norm || seen.has(norm)) continue;
        seen.add(norm);
        out.push(t);
    }
    return out;
}

/**
 * TMDB 개봉작을 받아 `angple_entities` 에 없는 것만 넣는다.
 *
 * 멱등성은 `external_ids.tmdb` 로 보장한다.
 * ⛔ 슬러그로 맞추면 동명이작(리메이크·시리즈)에서 서로를 덮어쓴다.
 */
export async function syncAngttCatalog(): Promise<CatalogSyncResult> {
    const key = tmdbKey();
    if (!key) {
        // ⛔ 조용히 성공하면 안 된다. "동기화가 돌았는데 0건" 과 "키가 없어 아예 안 돌았다" 는
        //    완전히 다른 상태인데, 둘 다 200 으로 보이면 몇 주를 모르고 지나간다.
        const message = 'TMDB_API_KEY 가 없어 동기화를 건너뜁니다';
        console.warn('[angtt-catalog]', message);
        return { fetched: 0, inserted: 0, skipped: 0, invalid: 0, message };
    }

    const movies = new Map<number, TmdbMovie>();
    for (const path of ['now_playing', 'upcoming']) {
        for (let p = 1; p <= MAX_PAGES; p++) {
            const list = await fetchPage(key, path, p);
            if (list.length === 0) break;
            for (const m of list) {
                if (m?.id && !movies.has(m.id)) movies.set(m.id, m);
            }
            if (movies.size >= MAX_ITEMS) break;
        }
        if (movies.size >= MAX_ITEMS) break;
    }

    let inserted = 0;
    let skipped = 0;
    let invalid = 0;

    for (const m of [...movies.values()].slice(0, MAX_ITEMS)) {
        const title = (m.title ?? m.original_title ?? '').trim();
        const slug = normalizeWorkTitle(title);
        if (!title || !slug) {
            invalid++;
            continue;
        }

        // 이미 등록됐는지: tmdb id 우선, 없으면 slug 로 한 번 더 본다.
        // slug 검사는 사람이 손으로 넣은 기존 5개를 다시 넣지 않기 위한 것이다.
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM angple_entities
             WHERE JSON_EXTRACT(external_ids, '$.tmdb') = ? OR slug = ?
             LIMIT 1`,
            [m.id, slug]
        );
        if (rows.length > 0) {
            skipped++;
            continue;
        }

        // ⛔ status='pending' · meta 에 auto_link 를 넣지 않는다.
        //    자동 연결은 옵트인이므로, 넣지 않으면 자동으로 걸리지 않는다 = 안전한 기본값.
        const [res] = await pool.query<ResultSetHeader>(
            `INSERT INTO angple_entities
               (type, canonical_title, slug, aliases, poster_url, external_ids,
                meta, release_date, status, created_at, updated_at)
             VALUES ('movie', ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(3), NOW(3))`,
            [
                title,
                slug,
                JSON.stringify(buildAliases(m)),
                m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
                JSON.stringify({ tmdb: m.id }),
                JSON.stringify({ source: 'tmdb' }),
                m.release_date || null
            ]
        );
        if (res.affectedRows > 0) inserted++;
    }

    const message = `TMDB ${movies.size}건 중 신규 ${inserted}건 등록, 기존 ${skipped}건 유지, 제외 ${invalid}건`;
    console.info('[angtt-catalog]', message);
    return { fetched: movies.size, inserted, skipped, invalid, message };
}
