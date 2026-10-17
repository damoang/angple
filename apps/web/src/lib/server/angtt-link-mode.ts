/**
 * 앙티티 작품 연결 — 게시판별 연결 방식 판정 (쓰기 경로 · 작성폼 감지 · 연결 제안 공용).
 *
 * 방식:
 *  - 'review'  : 글 자체가 작품 후기(angtt 게시판 전용, 코드 고정).
 *  - 'auto'    : 제목 자동 연결 + 작품 링크·작성자 태그 연결 + 작성폼 제안.
 *  - 'suggest' : 제목 자동 연결 없음. 작품 링크 감지·작성자가 받은 제안/직접 단 태그로만 연결.
 *  - 'off'     : 연결하지 않는다.
 *
 * 값은 게시판 확장 설정(v2_board_extended_settings.settings.features.angttLink)에서 읽는다.
 * 값이 없거나 읽기에 실패하면 'off' — 단 free·angtt 는 코드 기본값으로 고정한다.
 * (설정 행이 없거나 관리자 저장값이 어긋나도 기존 게시판 동작이 조용히 꺼지지 않게)
 *
 * ⛔ 글 상세/목록 읽기 경로에서 부르지 말 것 — 쓰기·작성폼 감지 시점 전용.
 */
import { readPool } from '$lib/server/db';

export type AngttLinkMode = 'off' | 'suggest' | 'auto' | 'review';

/** 관리자 화면에서 고를 수 있는 값 */
export type AngttLinkSetting = 'off' | 'suggest' | 'auto';

/** 코드 고정 게시판 — 설정값보다 우선한다 */
const CODE_DEFAULT_MODES: ReadonlyMap<string, AngttLinkMode> = new Map<string, AngttLinkMode>([
    ['angtt', 'review'],
    ['free', 'auto']
]);

const CACHE_TTL_MS = 60_000;
/** 읽기 실패는 짧게만 기억한다(곧 다시 읽어 복구) */
const FAILURE_TTL_MS = 10_000;
const BOARD_ID_RE = /^[a-zA-Z0-9_-]{1,50}$/;
/** 캐시 상한 — 넘으면 비운다(실제 게시판 수보다 넉넉하게) */
const CACHE_MAX_ENTRIES = 500;

/** 실제로 있는 게시판만 담는다(없는 이름은 담지 않는다) */
const cache = new Map<string, { at: number; ttl: number; mode: AngttLinkMode }>();

/** 테스트용 — 캐시 항목 수 */
export function angttLinkModeCacheSize(): number {
    return cache.size;
}

/** 설정 원본값 → 허용 값. 모르는 값은 'off' */
export function parseAngttLinkSetting(raw: unknown): AngttLinkSetting {
    return raw === 'auto' || raw === 'suggest' ? raw : 'off';
}

/** 확장 설정 JSON(객체 또는 문자열)에서 features.angttLink 를 꺼낸다 */
export function readAngttLinkFromSettings(raw: unknown): AngttLinkSetting {
    let settings: unknown = raw;
    if (typeof raw === 'string') {
        try {
            settings = JSON.parse(raw);
        } catch {
            return 'off';
        }
    }
    if (!settings || typeof settings !== 'object') return 'off';
    const features = (settings as { features?: unknown }).features;
    if (!features || typeof features !== 'object') return 'off';
    return parseAngttLinkSetting((features as { angttLink?: unknown }).angttLink);
}

/** 코드 고정 게시판이면 그 방식, 아니면 null */
export function codeDefaultAngttLinkMode(boardId: string): AngttLinkMode | null {
    return CODE_DEFAULT_MODES.get(boardId) ?? null;
}

/** 이 게시판의 앙티티 연결 방식 (게시판별 60초 캐시) */
export async function getAngttLinkMode(boardId: string): Promise<AngttLinkMode> {
    const fixed = codeDefaultAngttLinkMode(boardId);
    if (fixed) return fixed;
    if (!BOARD_ID_RE.test(boardId)) return 'off';

    const now = Date.now();
    const hit = cache.get(boardId);
    if (hit && now - hit.at < hit.ttl) return hit.mode;

    let mode: AngttLinkMode = 'off';
    let ttl = CACHE_TTL_MS;
    try {
        // 게시판이 있을 때만 행이 나온다. 두 표의 정렬 규칙이 달라 JOIN 대신 각각 값으로 비교한다.
        const [rows] = await readPool.query(
            `SELECT (SELECT settings FROM v2_board_extended_settings WHERE board_id = ? LIMIT 1)
                    AS settings
               FROM g5_board WHERE bo_table = ? LIMIT 1`,
            [boardId, boardId]
        );
        const row = (rows as { settings?: unknown }[])[0];
        // 없는 게시판 — 캐시에 담지 않는다(아무 이름이나 보내 메모리를 키우지 못하게)
        if (!row) return 'off';
        mode = readAngttLinkFromSettings(row.settings);
    } catch {
        mode = 'off';
        ttl = FAILURE_TTL_MS;
    }

    if (cache.size >= CACHE_MAX_ENTRIES) cache.clear();
    cache.set(boardId, { at: now, ttl, mode });
    return mode;
}

/** 제목만 보고 자동 연결해도 되는 방식인가 */
export function allowsTitleAutoLink(mode: AngttLinkMode): boolean {
    return mode === 'auto' || mode === 'review';
}

/** 작품 링크·작성자 태그·독자 제안 등 사람이 확인한 연결을 받는 방식인가 */
export function allowsConfirmedLink(mode: AngttLinkMode): boolean {
    return mode !== 'off';
}
