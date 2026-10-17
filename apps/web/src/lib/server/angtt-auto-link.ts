/**
 * 앙티티 자동 연결 — 글 저장 직후 제목을 보고 작품에 연결한다.
 *
 * ⛔ **쓰기 시점 1회만** 동작한다. 읽기 경로(글 상세/목록)에 이 로직을 절대 넣지 말 것.
 *    읽기는 최고 트래픽에 곱해져 수백~수천 배가 되며, 저장된 링크만 읽으면 충분하다.
 *
 * 안전 설계:
 *  - 게시판별 방식(angtt-link-mode): 제목 자동 연결은 auto/review 게시판만,
 *    작성자 태그 연결은 off 가 아닌 게시판만. 비밀글은 연결하지 않는다.
 *  - 작품별 옵트인: angple_entities.meta.auto_link === true 인 작품만 자동 연결.
 *    「참교육」처럼 일반어와 겹치는 이름은 옵트인하지 않으면 절대 자동 연결되지 않는다.
 *  - 문맥어 요구: meta.context_terms 가 있으면 제목에 그중 하나가 있어야 한다.
 *    (「호프」는 생맥주집을 뜻하기도 하므로 영화 문맥어를 요구한다)
 *  - 태그는 **INSERT 만** 한다. Go 의 SetPostTags 는 전량 교체라 기존 태그를 날리므로 쓰지 않는다.
 *  - 태그 작성자는 mb_id='ai' — 시스템이 단 태그가 관리자/작성자가 단 것처럼 보이지 않게 한다.
 *  - 실패해도 글 작성에는 영향이 없다(fire-and-forget, 호출부에서 catch).
 */
import pool from '$lib/server/db';
import { tmdbSourceKey } from '$lib/utils/angtt-source';
import {
    ANGTT_TAG,
    scanAliasesInTitle,
    matchAliasFromTags,
    mergeExcludeTerms,
    normalizeWorkTitle,
    type EntityAlias
} from './angtt-dictionary-logic';
import {
    allowsConfirmedLink,
    allowsTitleAutoLink,
    getAngttLinkMode,
    type AngttLinkMode
} from './angtt-link-mode';
import { isSecretOption } from './secret-option';

/**
 * 후기 게시판 — 이 게시판의 글은 그 자체가 작품 후기(review)다.
 * free 등 다른 게시판의 글은 작품을 "언급(mention/auto)"할 뿐이지만,
 * angtt 게시판 글은 작품 페이지에서 「후기」로 최상단에 노출돼야 한다.
 */
const REVIEW_BOARD = 'angtt';

/** 시스템 태그 작성자 — 관리자/작성자와 구분 */
const SYSTEM_TAG_MB_ID = 'ai';

/** 별칭 사전 캐시 (작품 수가 적고 변경이 드물어 짧은 TTL 로 충분) */
const ALIAS_TTL_MS = 5 * 60_000;

/** 캐시에 함께 담는 작품 표시 정보 (detect API 응답용) */
interface EntityInfo {
    id: number;
    title: string;
    posterUrl: string | null;
}

let aliasCache: {
    at: number;
    aliases: EntityAlias[];
    slugToInfo: Map<string, EntityInfo>;
    sourceToSlug: Map<string, string | null>;
} | null = null;

interface EntityRow {
    id: number;
    slug: string;
    canonical_title: string;
    aliases: unknown;
    poster_url: string | null;
    meta: unknown;
    type: string;
    external_ids: unknown;
}

function asArray(v: unknown): string[] {
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
    if (typeof v === 'string') {
        try {
            const parsed = JSON.parse(v);
            return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
        } catch {
            return [];
        }
    }
    return [];
}

function asObject(v: unknown): Record<string, unknown> {
    if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
    if (typeof v === 'string') {
        try {
            const parsed = JSON.parse(v);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }
    return {};
}

/** 활성 작품의 별칭 사전을 읽어 캐싱한다. */
async function loadAliases() {
    const now = Date.now();
    if (aliasCache && now - aliasCache.at < ALIAS_TTL_MS) return aliasCache;

    const [rows] = await pool.query(
        `SELECT id, slug, canonical_title, aliases, poster_url, meta, type, external_ids
           FROM angple_entities
          WHERE status = 'active'`
    );

    const aliases: EntityAlias[] = [];
    const slugToInfo = new Map<string, EntityInfo>();
    const sourceToSlug = new Map<string, string | null>();

    for (const r of rows as EntityRow[]) {
        const external = asObject(r.external_ids);
        const kind = external.tmdb_type ?? (r.type === 'movie' ? 'movie' : null);
        const sourceKey = tmdbSourceKey(`https://www.themoviedb.org/${kind}/${external.tmdb}`);
        if (sourceKey) {
            // 잘못 중복 등록된 외부 ID는 임의로 하나를 고르지 않는다.
            sourceToSlug.set(sourceKey, sourceToSlug.has(sourceKey) ? null : r.slug);
        }
        slugToInfo.set(r.slug, {
            id: Number(r.id),
            title: r.canonical_title,
            posterUrl: r.poster_url || null
        });
        const meta = asObject(r.meta);
        // 기본은 false — 작품별로 명시 옵트인해야만 자동 연결된다
        const autoLink = meta.auto_link === true;
        const contextTerms = asArray(meta.context_terms);
        const excludeTerms = mergeExcludeTerms(r.slug, asArray(meta.exclude_terms));

        const names = new Set<string>([r.canonical_title, ...asArray(r.aliases)]);
        for (const name of names) {
            const aliasNorm = normalizeWorkTitle(name);
            // 한 글자 제목도 URL/태그로 명시 선택할 수 있다. 제목 자동 스캔의 2글자 제한은 유지한다.
            if (!aliasNorm) continue;
            aliases.push({
                aliasNorm,
                entitySlug: r.slug,
                autoLink,
                contextTerms: contextTerms.length ? contextTerms : undefined,
                excludeTerms: excludeTerms.length ? excludeTerms : undefined
            });
        }
    }

    aliasCache = { at: now, aliases, slugToInfo, sourceToSlug };
    return aliasCache;
}

/** 작성폼 제안 칩의 감지 결과 */
export interface AngttDetectMatch {
    slug: string;
    title: string;
    posterUrl: string | null;
    /** true 면 저장 시 서버가 어차피 자동 연결한다(칩은 안내 성격) */
    canAutoLink: boolean;
}

/**
 * 게시판 방식에 맞춰 작성폼 감지 결과를 정리한다.
 * off 면 감지하지 않고, suggest 면 저장 때 자동 연결이 없으므로 canAutoLink 를 끈다.
 */
export async function detectEntityForBoard(
    mode: AngttLinkMode,
    title: string,
    sources: string[]
): Promise<AngttDetectMatch | null> {
    if (!allowsConfirmedLink(mode)) return null;
    const match = await detectEntityFromSources(title, sources);
    if (!match) return null;
    return allowsTitleAutoLink(mode) ? match : { ...match, canAutoLink: false };
}

/** 명시적 작품 URL을 우선한다. 미등록/모호한 URL을 제목 추측으로 대체하지 않는다. */
export async function detectEntityFromSources(
    title: string,
    sources: string[]
): Promise<AngttDetectMatch | null> {
    const keys = [...new Set(sources.map(tmdbSourceKey).filter((key) => key !== null))];
    if (keys.length === 0) return detectEntityFromTitle(title);
    if (keys.length !== 1) return null;
    const { sourceToSlug, slugToInfo } = await loadAliases();
    const slug = sourceToSlug.get(keys[0]);
    const info = slug ? slugToInfo.get(slug) : undefined;
    if (!slug || !info) return null;
    return { slug, title: info.title, posterUrl: info.posterUrl, canAutoLink: false };
}

/**
 * 제목에서 작품을 감지한다 — 작성폼 제안 칩 전용 (read-only, 부작용 0).
 *
 * 자동연결과 같은 별칭 캐시·스캐너를 쓰되, canAutoLink=false 인 히트(옵트인 안 된
 * 작품·문맥어 불충족)도 돌려준다. 그 케이스가 바로 "작성자 확인" 제안의 대상이다.
 * ⛔ 글 상세/목록 read 경로에서 호출 금지 — 작성폼 debounce 입력 전용.
 */
export async function detectEntityFromTitle(title: string): Promise<AngttDetectMatch | null> {
    const trimmed = title?.trim();
    if (!trimmed || trimmed.length < 2) return null;

    const { aliases, slugToInfo } = await loadAliases();
    const hit = scanAliasesInTitle(trimmed, aliases);
    if (!hit) return null;

    const info = slugToInfo.get(hit.entitySlug);
    if (!info) return null;

    return {
        slug: hit.entitySlug,
        title: info.title,
        posterUrl: info.posterUrl,
        canAutoLink: hit.canAutoLink
    };
}

/**
 * entity_posts 링크 1건을 기록한다. 게시판에 따라 역할이 갈린다.
 *
 * - angtt(REVIEW_BOARD): 글 자체가 후기이므로 role='review'.
 *   이미 auto/mention 으로 잘못 링크된 행이 있으면 review 로 **승격**한다
 *   (ON DUPLICATE KEY UPDATE). 후기가 auto/mention 으로 남아 작품 페이지에서
 *   「후기」로 안 뜨던 회귀를 여기서 바로잡는다.
 * - 그 밖의 게시판(free 등): 기존과 동일하게 `otherRole`(auto/mention)로 INSERT IGNORE —
 *   이미 어떤 행이든 있으면 무변화(PK: bo_table, wr_id, entity_id). 언급 경로는 그대로다.
 *
 * ⛔ review 승격은 angtt 게시판에만 적용된다. free 글의 auto/mention 은 절대 덮지 않는다.
 */
async function upsertEntityLink(
    entityId: number,
    boardId: string,
    wrId: number,
    otherRole: 'auto' | 'mention'
): Promise<void> {
    if (boardId === REVIEW_BOARD) {
        await pool.execute(
            `INSERT INTO angple_entity_posts (entity_id, bo_table, wr_id, role, created_at)
             VALUES (?, ?, ?, 'review', NOW(3))
             ON DUPLICATE KEY UPDATE role = 'review'`,
            [entityId, boardId, wrId]
        );
        return;
    }
    await pool.execute(
        `INSERT IGNORE INTO angple_entity_posts (entity_id, bo_table, wr_id, role, created_at)
         VALUES (?, ?, ?, ?, NOW(3))`,
        [entityId, boardId, wrId, otherRole]
    );
}

/**
 * 글의 태그(작성자가 확정한 것)를 보고 작품 링크를 만든다.
 *
 * 「앙티티」+ 별칭 정확 일치 태그가 있으면 entity_posts 에 링크를 남긴다.
 * angtt 게시판이면 role='review'(후기 본체), 그 외 게시판이면 role='mention'.
 * 태그는 건드리지 않고(작성자 소유) 링크만 **추가**한다.
 * 제안 칩 [연결]·수동 태그 입력 양쪽이 이 경로로 작품페이지에 연결된다.
 *
 * @returns 링크한 작품 slug, 대상 아니면 null
 */
export async function linkEntityFromTags(boardId: string, wrId: number): Promise<string | null> {
    if (!/^[a-zA-Z0-9_-]+$/.test(boardId)) return null;
    if (!allowsConfirmedLink(await getAngttLinkMode(boardId))) return null;

    const [tagRows] = await pool.query(
        `SELECT tag FROM g5_na_tag_log WHERE bo_table = ? AND wr_id = ?`,
        [boardId, wrId]
    );
    const tags = (tagRows as { tag?: string }[])
        .map((r) => r.tag ?? '')
        .filter((t) => t.length > 0);
    if (tags.length === 0) return null;

    const { aliases, slugToInfo } = await loadAliases();
    const hit = matchAliasFromTags(tags, aliases);
    if (!hit) return null;

    const info = slugToInfo.get(hit.entitySlug);
    if (!info) return null;

    // 비밀글은 작품 페이지에 노출하지 않는다
    const post = await fetchPost(boardId, wrId);
    if (!post || isSecretOption(post.wr_option)) return null;

    await upsertEntityLink(info.id, boardId, wrId, 'mention');

    return hit.entitySlug;
}

/** 태그 이름 → tag_id (없으면 생성) */
async function getOrCreateTagId(tag: string): Promise<number> {
    const [found] = await pool.query(`SELECT id FROM g5_na_tag WHERE tag = ? LIMIT 1`, [tag]);
    const rows = found as { id: number }[];
    if (rows[0]) return Number(rows[0].id);

    const [res] = await pool.execute(
        `INSERT INTO g5_na_tag (type, idx, tag, cnt, regdate, lastdate)
         VALUES (0, ?, ?, 0, NOW(), NOW())`,
        [tag.slice(0, 1), tag]
    );
    return Number((res as { insertId: number }).insertId);
}

/** 태그 1건 부착 (이미 있으면 무시) */
async function attachTag(boardId: string, wrId: number, tag: string): Promise<void> {
    const tagId = await getOrCreateTagId(tag);
    await pool.execute(
        `INSERT INTO g5_na_tag_log (bo_table, wr_id, tag_id, tag, mb_id, regdate)
         SELECT ?, ?, ?, ?, ?, NOW()
           FROM DUAL
          WHERE NOT EXISTS (
            SELECT 1 FROM g5_na_tag_log
             WHERE bo_table = ? AND wr_id = ? AND tag_id = ?
          )`,
        [boardId, wrId, tagId, tag, SYSTEM_TAG_MB_ID, boardId, wrId, tagId]
    );
    await pool.execute(
        `UPDATE g5_na_tag
            SET cnt = (SELECT COUNT(*) FROM g5_na_tag_log WHERE tag_id = ?),
                lastdate = NOW()
          WHERE id = ?`,
        [tagId, tagId]
    );
}

/** 글 제목·옵션 조회 (동적 테이블 — boardId 는 호출부에서 형식 검증됨) */
async function fetchPost(
    boardId: string,
    wrId: number
): Promise<{ wr_subject: string; wr_option: string } | null> {
    const [rows] = await pool.query(
        `SELECT wr_subject, wr_option FROM ?? WHERE wr_id = ? LIMIT 1`,
        [`g5_write_${boardId}`, wrId]
    );
    const row = (rows as { wr_subject?: string; wr_option?: string }[])[0];
    if (!row) return null;
    return { wr_subject: row.wr_subject ?? '', wr_option: row.wr_option ?? '' };
}

/**
 * 킬 스위치 — 자동 부착한 태그가 얼마나 해제됐는지로 오탐을 관측한다.
 *
 * 해제는 g5_na_tag_log 에서 행이 사라지는 것이라 직접 셀 수 없으므로,
 * angple_entity_posts(role='auto') 대비 살아있는 태그 비율로 근사한다.
 * 해제율이 임계를 넘으면 자동 부착을 중단하고(제안형으로 강등) 운영자 판단을 기다린다.
 */
const KILL_SWITCH_THRESHOLD = 0.05; // 해제율 5%
const KILL_SWITCH_MIN_SAMPLE = 20; // 표본이 적으면 판단하지 않는다
const KILL_SWITCH_TTL_MS = 60_000;
let killCache: { at: number; suspended: boolean } | null = null;

export async function isAutoLinkSuspended(): Promise<boolean> {
    const now = Date.now();
    if (killCache && now - killCache.at < KILL_SWITCH_TTL_MS) return killCache.suspended;

    let suspended = false;
    try {
        const [rows] = await pool.query(
            `SELECT COUNT(*) AS total,
                    SUM(CASE WHEN l.id IS NULL THEN 1 ELSE 0 END) AS removed
               FROM angple_entity_posts ep
               LEFT JOIN g5_na_tag_log l
                 ON l.bo_table = ep.bo_table AND l.wr_id = ep.wr_id
                AND l.tag = ? AND l.mb_id = ?
              WHERE ep.role = 'auto'`,
            [ANGTT_TAG, SYSTEM_TAG_MB_ID]
        );
        const r = (rows as { total?: number; removed?: number }[])[0];
        const total = Number(r?.total ?? 0);
        const removed = Number(r?.removed ?? 0);
        if (total >= KILL_SWITCH_MIN_SAMPLE && removed / total > KILL_SWITCH_THRESHOLD) {
            suspended = true;
            console.warn(
                `[angtt] 자동 부착 중단 — 해제율 ${((removed / total) * 100).toFixed(1)}% (${removed}/${total})`
            );
        }
    } catch {
        // 관측 실패 시에는 막지 않는다(가용성 우선). 부착 자체는 여전히 작품별 옵트인에 갇혀 있다.
    }

    killCache = { at: now, suspended };
    return suspended;
}

/**
 * 새 글의 제목을 보고 작품에 자동 연결한다.
 * 연결 시 「앙티티」 + 작품명 태그를 달고 angple_entity_posts 에 링크를 남긴다 —
 * angtt 게시판이면 role='review'(후기 본체), 그 외 게시판이면 role='auto'.
 *
 * @returns 연결한 작품 slug, 연결 안 했으면 null
 */
export async function autoLinkAngttEntity(
    boardId: string,
    wrId: number,
    titleArg?: string
): Promise<string | null> {
    if (!/^[a-zA-Z0-9_-]+$/.test(boardId)) return null;
    // 제목 자동 연결은 auto/review 게시판만. suggest 게시판은 작성자 확인을 거친 태그로만 연결한다.
    if (!allowsTitleAutoLink(await getAngttLinkMode(boardId))) return null;

    // 킬 스위치: 최근 자동 태그의 해제율이 임계를 넘으면 자동 부착을 멈춘다.
    // "오탐 0"은 검증 시점 표본의 사실일 뿐 미래 보장이 아니므로, 실사용 신호로 스스로 멈춘다.
    if (await isAutoLinkSuspended()) return null;

    const post = await fetchPost(boardId, wrId);
    if (!post || isSecretOption(post.wr_option)) return null;
    const title = titleArg ?? post.wr_subject;
    if (!title?.trim()) return null;

    const { aliases, slugToInfo } = await loadAliases();
    const hit = scanAliasesInTitle(title, aliases);
    if (!hit || !hit.canAutoLink) return null;

    const entityId = slugToInfo.get(hit.entitySlug)?.id;
    if (!entityId) return null;

    // 작품명 태그는 canonical slug 를 쓴다(별칭으로 달면 표기가 흩어진다)
    await attachTag(boardId, wrId, ANGTT_TAG);
    await attachTag(boardId, wrId, hit.entitySlug);

    await upsertEntityLink(entityId, boardId, wrId, 'auto');

    return hit.entitySlug;
}
