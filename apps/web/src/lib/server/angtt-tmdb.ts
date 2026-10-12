/**
 * TMDB 작품 검색 — 관리자 편집 화면의 「TMDB 검색」 전용 (서버에서만 호출).
 *
 * 키는 TMDB_API_KEY 하나뿐이다(angtt-catalog-sync 의 tmdbKey, 폴백 없음).
 * 키가 없으면 검색 기능 자체가 꺼지고 화면의 버튼도 숨겨진다.
 *
 * ⛔ 키는 응답·로그·오류 메시지 어디에도 싣지 않는다. 오류는 HTTP 상태만 남긴다.
 * ⛔ 검색 결과는 저장하지 않는다 — 관리자가 고르고 확인한 값만 편집 저장으로 들어간다.
 */
import { tmdbKey } from './angtt-catalog-sync';

/** 포스터 크기 — 작품 페이지 포스터 칸(최대 200px)에 충분한 w342 */
const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';
const RESULT_LIMIT = 5;
const TIMEOUT_MS = 10_000;

export type TmdbKind = 'movie' | 'tv';

export interface TmdbSearchItem {
    id: number;
    kind: TmdbKind;
    title: string;
    originalTitle: string;
    /** YYYY-MM-DD 또는 '' */
    releaseDate: string;
    posterUrl: string | null;
    overview: string;
}

interface TmdbRaw {
    id?: number;
    title?: string;
    name?: string;
    original_title?: string;
    original_name?: string;
    release_date?: string;
    first_air_date?: string;
    poster_path?: string | null;
    overview?: string;
}

export function isTmdbEnabled(): boolean {
    return tmdbKey() !== null;
}

/**
 * TMDB 검색(ko-KR). 키가 없으면 빈 배열.
 * v4 읽기 토큰(eyJ…)은 Bearer 헤더로, v3 키는 api_key 파라미터로 보낸다.
 */
export async function searchTmdb(query: string, kind: TmdbKind): Promise<TmdbSearchItem[]> {
    const key = tmdbKey();
    const q = query.trim().slice(0, 100);
    if (!key || !q) return [];

    const params = new URLSearchParams({
        query: q,
        language: 'ko-KR',
        include_adult: 'false',
        page: '1'
    });
    const headers: Record<string, string> = { accept: 'application/json' };
    if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
    else params.set('api_key', key);

    const res = await fetch(`https://api.themoviedb.org/3/search/${kind}?${params}`, {
        headers,
        signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!res.ok) throw new Error(`TMDB search HTTP ${res.status}`);

    const json = (await res.json()) as { results?: TmdbRaw[] };
    return (json.results ?? [])
        .filter((r) => Number.isInteger(r.id))
        .slice(0, RESULT_LIMIT)
        .map((r) => ({
            id: Number(r.id),
            kind,
            title: String((kind === 'movie' ? r.title : r.name) ?? '').trim(),
            originalTitle: String(
                (kind === 'movie' ? r.original_title : r.original_name) ?? ''
            ).trim(),
            releaseDate: String((kind === 'movie' ? r.release_date : r.first_air_date) ?? ''),
            posterUrl: r.poster_path ? `${POSTER_BASE}${r.poster_path}` : null,
            overview: String(r.overview ?? '').slice(0, 160)
        }));
}
