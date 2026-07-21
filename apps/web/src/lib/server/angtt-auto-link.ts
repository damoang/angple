/**
 * 앙티티 자동 연결 — 글 저장 직후 제목을 보고 작품에 연결한다.
 *
 * ⛔ **쓰기 시점 1회만** 동작한다. 읽기 경로(글 상세/목록)에 이 로직을 절대 넣지 말 것.
 *    읽기는 최고 트래픽에 곱해져 수백~수천 배가 되며, 저장된 링크만 읽으면 충분하다.
 *
 * 안전 설계:
 *  - 작품별 옵트인: angple_entities.meta.auto_link === true 인 작품만 자동 연결.
 *    「참교육」처럼 일반어와 겹치는 이름은 옵트인하지 않으면 절대 자동 연결되지 않는다.
 *  - 문맥어 요구: meta.context_terms 가 있으면 제목에 그중 하나가 있어야 한다.
 *    (「호프」는 생맥주집을 뜻하기도 하므로 영화 문맥어를 요구한다)
 *  - 태그는 **INSERT 만** 한다. Go 의 SetPostTags 는 전량 교체라 기존 태그를 날리므로 쓰지 않는다.
 *  - 태그 작성자는 mb_id='ai' — 시스템이 단 태그가 관리자/작성자가 단 것처럼 보이지 않게 한다.
 *  - 실패해도 글 작성에는 영향이 없다(fire-and-forget, 호출부에서 catch).
 */
import pool from '$lib/server/db';
import {
    ANGTT_TAG,
    scanAliasesInTitle,
    normalizeWorkTitle,
    type EntityAlias
} from './angtt-dictionary-logic';

/** 자동 연결을 적용할 게시판 */
const AUTO_LINK_BOARDS = new Set(['free', 'angtt']);

/** 시스템 태그 작성자 — 관리자/작성자와 구분 */
const SYSTEM_TAG_MB_ID = 'ai';

/** 별칭 사전 캐시 (작품 수가 적고 변경이 드물어 짧은 TTL 로 충분) */
const ALIAS_TTL_MS = 5 * 60_000;
let aliasCache: { at: number; aliases: EntityAlias[]; slugToId: Map<string, number> } | null = null;

interface EntityRow {
    id: number;
    slug: string;
    canonical_title: string;
    aliases: unknown;
    meta: unknown;
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
        `SELECT id, slug, canonical_title, aliases, meta
           FROM angple_entities
          WHERE status = 'active'`
    );

    const aliases: EntityAlias[] = [];
    const slugToId = new Map<string, number>();

    for (const r of rows as EntityRow[]) {
        slugToId.set(r.slug, Number(r.id));
        const meta = asObject(r.meta);
        // 기본은 false — 작품별로 명시 옵트인해야만 자동 연결된다
        const autoLink = meta.auto_link === true;
        const contextTerms = asArray(meta.context_terms);

        const names = new Set<string>([r.canonical_title, ...asArray(r.aliases)]);
        for (const name of names) {
            const aliasNorm = normalizeWorkTitle(name);
            if (aliasNorm.length < 2) continue;
            aliases.push({
                aliasNorm,
                entitySlug: r.slug,
                autoLink,
                contextTerms: contextTerms.length ? contextTerms : undefined
            });
        }
    }

    aliasCache = { at: now, aliases, slugToId };
    return aliasCache;
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

/** 글 제목 조회 (동적 테이블 — boardId 는 호출부에서 화이트리스트 검증됨) */
async function fetchTitle(boardId: string, wrId: number): Promise<string> {
    const [rows] = await pool.query(`SELECT wr_subject FROM ?? WHERE wr_id = ? LIMIT 1`, [
        `g5_write_${boardId}`,
        wrId
    ]);
    const list = rows as { wr_subject?: string }[];
    return list[0]?.wr_subject ?? '';
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
 * 연결 시 「앙티티」 + 작품명 태그를 달고 angple_entity_posts 에 role='auto' 링크를 남긴다.
 *
 * @returns 연결한 작품 slug, 연결 안 했으면 null
 */
export async function autoLinkAngttEntity(
    boardId: string,
    wrId: number,
    titleArg?: string
): Promise<string | null> {
    if (!AUTO_LINK_BOARDS.has(boardId)) return null;
    if (!/^[a-zA-Z0-9_-]+$/.test(boardId)) return null;

    // 킬 스위치: 최근 자동 태그의 해제율이 임계를 넘으면 자동 부착을 멈춘다.
    // "오탐 0"은 검증 시점 표본의 사실일 뿐 미래 보장이 아니므로, 실사용 신호로 스스로 멈춘다.
    if (await isAutoLinkSuspended()) return null;

    const title = titleArg ?? (await fetchTitle(boardId, wrId));
    if (!title?.trim()) return null;

    const { aliases, slugToId } = await loadAliases();
    const hit = scanAliasesInTitle(title, aliases);
    if (!hit || !hit.canAutoLink) return null;

    const entityId = slugToId.get(hit.entitySlug);
    if (!entityId) return null;

    // 작품명 태그는 canonical slug 를 쓴다(별칭으로 달면 표기가 흩어진다)
    await attachTag(boardId, wrId, ANGTT_TAG);
    await attachTag(boardId, wrId, hit.entitySlug);

    await pool.execute(
        `INSERT IGNORE INTO angple_entity_posts (entity_id, bo_table, wr_id, role, created_at)
         VALUES (?, ?, ?, 'auto', NOW(3))`,
        [entityId, boardId, wrId]
    );

    return hit.entitySlug;
}
