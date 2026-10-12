/**
 * 앙티티 작품 후보 등록 — angtt 원글 저장 직후 1회.
 *
 * 글 제목에서 작품명을 뽑아(angtt-candidate-logic) 기존 작품과 맞춰 본다.
 *  - active 작품과 같으면 → 그 원글을 role='review' 로 연결(작성 시에만, 아래 참조)
 *  - pending 후보와 같으면 → 후보의 meta.source_posts 에 원글 번호를 더한다
 *  - rejected 작품과 같으면 → 아무것도 하지 않는다(거절한 제목을 되살리지 않는다)
 *  - 없으면 → status='pending' 후보를 새로 만든다
 *
 * ⛔ 자동으로는 pending 만 만든다. 활성화·병합·거절은 관리자 화면에서 사람이 한다.
 *    meta.auto_link 는 넣지 않는다(자유게시판 자동 연결은 관리자가 따로 켠다).
 * ⛔ 이 함수는 절대 throw 하지 않는다. 글 작성·수정 응답과 무관한 후처리다.
 * ⛔ 수정 경로에서는 active 작품에 새로 연결하지 않는다 — 작성자가 해제한 연결이
 *    수정 저장 때 되살아나는 것을 막는다(angtt-auto-link 의 수정 경로 규약과 같은 이유).
 */
import pool from '$lib/server/db';
import {
    appendSourcePost,
    asMetaObject,
    asStringArray,
    extractTitleCandidate,
    findMatchingEntity,
    newCandidateMeta,
    uniqueSlug,
    type MatchableEntity,
    type TitleCandidate
} from './angtt-candidate-logic';
import { refreshEntityAggregates } from '$plugins/angtt-review/lib/entities.server';

/** 후보를 만드는 게시판 — 원글 자체가 작품 후기인 곳 */
export const CANDIDATE_BOARD = 'angtt';

interface CandidateEntityRow {
    id: number;
    slug: string;
    status: string;
    canonical_title: string;
    aliases: unknown;
    meta: unknown;
}

export interface CandidateEntity extends MatchableEntity {
    meta: Record<string, unknown>;
}

/** 매칭 대상 작품 전량(활성·대기·거절). 작품 수가 수백 규모라 전량 로드가 단순하고 정확하다. */
export async function loadCandidateEntities(): Promise<CandidateEntity[]> {
    const [rows] = await pool.query(
        `SELECT id, slug, status, canonical_title, aliases, meta
           FROM angple_entities
          WHERE status IN ('active', 'pending', 'rejected')`
    );
    return (rows as CandidateEntityRow[]).map((r) => ({
        id: Number(r.id),
        slug: String(r.slug),
        status: String(r.status),
        canonicalTitle: String(r.canonical_title ?? ''),
        aliases: asStringArray(r.aliases),
        meta: asMetaObject(r.meta)
    }));
}

/** 이미 쓰인 slug (모든 상태 — merged 도 slug 를 계속 차지한다) */
async function loadTakenSlugs(): Promise<Set<string>> {
    const [rows] = await pool.query(`SELECT slug FROM angple_entities`);
    return new Set((rows as { slug: string }[]).map((r) => String(r.slug).toLowerCase()));
}

function isDuplicateKey(err: unknown): boolean {
    return (err as { code?: string })?.code === 'ER_DUP_ENTRY';
}

/**
 * 새 pending 후보 1건을 넣는다. slug 충돌(동시 작성 경합 포함)은 다음 접미로 재시도한다.
 * 같은 (type, 작품명)이 이미 있으면(병합된 옛 작품 등) 만들지 않고 null.
 */
export async function insertPendingCandidate(
    candidate: TitleCandidate,
    wrIds: readonly number[],
    caName: string | null
): Promise<number | null> {
    const taken = await loadTakenSlugs();
    const meta = newCandidateMeta(candidate, wrIds, caName);

    for (let attempt = 0; attempt < 3; attempt++) {
        const slug = uniqueSlug(candidate.title, taken);
        if (!slug) return null;
        try {
            const [res] = await pool.execute(
                `INSERT INTO angple_entities
                   (type, canonical_title, slug, aliases, meta, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, 'pending', NOW(3), NOW(3))`,
                [
                    candidate.type,
                    candidate.title,
                    slug,
                    JSON.stringify(candidate.aliases),
                    JSON.stringify(meta)
                ]
            );
            return Number((res as { insertId?: number }).insertId ?? 0) || null;
        } catch (err) {
            if (!isDuplicateKey(err)) throw err;
            const msg = String((err as { message?: string }).message ?? '');
            if (!msg.includes('uq_slug')) return null; // (type, 작품명) 중복 — 만들지 않는다
            taken.add(slug.toLowerCase());
        }
    }
    return null;
}

/** pending 후보에 근거 원글을 더한다 (행 잠금 후 갱신) */
async function attachToPending(entityId: number, wrId: number, seasons: number[]): Promise<void> {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query(
            `SELECT meta FROM angple_entities WHERE id = ? AND status = 'pending' FOR UPDATE`,
            [entityId]
        );
        const row = (rows as { meta: unknown }[])[0];
        const next = row ? appendSourcePost(row.meta, wrId, seasons) : null;
        if (next) {
            await conn.query(`UPDATE angple_entities SET meta = ? WHERE id = ?`, [
                JSON.stringify(next),
                entityId
            ]);
        }
        await conn.commit();
    } catch (err) {
        await conn.rollback().catch(() => {});
        throw err;
    } finally {
        conn.release();
    }
}

/** active 작품에 angtt 원글을 후기로 연결하고 집계를 갱신한다 */
async function linkReviewToActive(entityId: number, wrId: number): Promise<void> {
    await pool.execute(
        `INSERT INTO angple_entity_posts (entity_id, bo_table, wr_id, role, created_at)
         VALUES (?, ?, ?, 'review', NOW(3))
         ON DUPLICATE KEY UPDATE role = 'review'`,
        [entityId, CANDIDATE_BOARD, wrId]
    );
    await refreshEntityAggregates(entityId);
}

/** 이 원글이 이미 어떤 작품에 연결됐거나 후보 근거로 들어가 있는지 */
async function isAlreadyHandled(wrId: number): Promise<boolean> {
    const [linked] = await pool.query(
        `SELECT 1 FROM angple_entity_posts WHERE bo_table = ? AND wr_id = ? LIMIT 1`,
        [CANDIDATE_BOARD, wrId]
    );
    if ((linked as unknown[]).length > 0) return true;

    const [sourced] = await pool.query(
        `SELECT 1 FROM angple_entities
          WHERE status IN ('pending', 'rejected')
            AND JSON_CONTAINS(JSON_EXTRACT(meta, '$.source_posts'), CAST(? AS JSON))
          LIMIT 1`,
        [String(wrId)]
    );
    return (sourced as unknown[]).length > 0;
}

export type CandidateOutcome =
    | 'skipped'
    | 'no_candidate'
    | 'linked_active'
    | 'attached_pending'
    | 'rejected_title'
    | 'created_pending';

/**
 * angtt 원글 → 작품 후보 처리. 어떤 경우에도 throw 하지 않는다(실패는 로그만).
 *
 * @param mode 'create' = 글 작성 직후, 'edit' = 글 수정 직후(active 신규 연결 안 함)
 */
export async function registerAngttCandidate(
    boardId: string,
    wrId: number,
    mode: 'create' | 'edit'
): Promise<CandidateOutcome> {
    try {
        if (boardId !== CANDIDATE_BOARD) return 'skipped';
        if (!Number.isInteger(wrId) || wrId <= 0) return 'skipped';

        const [rows] = await pool.query(
            `SELECT wr_subject, ca_name, wr_is_comment, wr_deleted_at
               FROM g5_write_angtt WHERE wr_id = ? LIMIT 1`,
            [wrId]
        );
        const post = (
            rows as {
                wr_subject?: string;
                ca_name?: string;
                wr_is_comment?: number;
                wr_deleted_at?: unknown;
            }[]
        )[0];
        if (!post || Number(post.wr_is_comment) !== 0 || post.wr_deleted_at) return 'skipped';

        // 수정 시에도 「후보가 없으면 1회」 — 이미 연결·근거 등록된 글은 다시 보지 않는다
        if (await isAlreadyHandled(wrId)) return 'skipped';

        const candidate = extractTitleCandidate(post.wr_subject ?? '', post.ca_name ?? '');
        if (!candidate) return 'no_candidate';

        const entities = await loadCandidateEntities();
        const match = findMatchingEntity(candidate.aliases, entities);

        if (match?.status === 'rejected') return 'rejected_title';
        if (match?.status === 'pending') {
            await attachToPending(match.id, wrId, candidate.seasons);
            return 'attached_pending';
        }
        if (match?.status === 'active') {
            if (mode === 'edit') return 'skipped';
            await linkReviewToActive(match.id, wrId);
            return 'linked_active';
        }

        const id = await insertPendingCandidate(candidate, [wrId], post.ca_name ?? null);
        return id ? 'created_pending' : 'no_candidate';
    } catch (err) {
        console.error('[angtt-candidate] 후보 처리 실패 (글 작성에는 영향 없음):', err);
        return 'skipped';
    }
}
