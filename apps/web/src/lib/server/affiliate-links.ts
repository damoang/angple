import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '$lib/server/db';
import { isLinkProcessingPluginEnabled } from '$lib/server/link-processing/runtime';
import { resolveAffiliateCandidate } from '$plugins/affiliate-link-private/lib/resolver.server';
import type { AffiliateDecision, AffiliateSource } from '$plugins/affiliate-link-private/lib/types';
import { resolveAffiliateRedirect as resolveAffiliateRedirectFromCache } from '$lib/server/affiliate-redirect';
import { sendAffiliateDecisionEvents } from '$lib/server/affiliate-events';
import { createCache } from '$lib/server/cache';

export type AffiliateEntityType =
    | 'post_body'
    | 'comment_body'
    | 'post_link1'
    | 'post_link2'
    | 'comment_link1'
    | 'comment_link2';

export type AffiliateStatus = 'pending' | 'converted' | 'unsupported' | 'failed';

export interface AffiliateLinkRow extends RowDataPacket {
    id: number;
    board_slug: string;
    post_id: number;
    comment_id: number;
    entity_type: AffiliateEntityType;
    link_index: number;
    source_url: string;
    normalized_url: string;
    merchant_domain: string;
    platform: string;
    affiliate_url: string | null;
    redirect_id: string;
    status: AffiliateStatus;
    reason_code: string;
    attempt_count: number;
    last_error: string | null;
}

interface RedirectPayload extends RowDataPacket {
    affiliate_url: string | null;
    platform: string;
    board_slug: string;
    post_id: number;
}

interface PostSourceRow extends RowDataPacket {
    wr_id: number;
    wr_content: string | null;
    wr_link1: string | null;
    wr_link2: string | null;
}

interface CommentSourceRow extends RowDataPacket {
    wr_id: number;
    wr_parent: number;
    wr_content: string | null;
    wr_link1: string | null;
    wr_link2: string | null;
}

interface PersistAffiliateRow {
    entityType: AffiliateEntityType;
    linkIndex: number;
    sourceUrl: string;
    normalizedUrl: string;
    merchantDomain: string;
    platform: string;
    affiliateUrl: string | null;
    redirectId: string;
    status: AffiliateStatus;
    reasonCode: string;
    attemptCount: number;
    lastError: string | null;
}

interface PersistAffiliateDecisionEntry {
    row: PersistAffiliateRow;
    decision: AffiliateDecision;
    source: AffiliateSource;
}

const ANCHOR_REGEX = /<a\s+([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
const REDIRECT_PREFIX = 'affiliate:go:';
const REDIRECT_TTL_SEC = 60 * 60 * 24 * 180;

function sanitizeBoardId(boardId: string): string {
    return boardId.replace(/[^a-zA-Z0-9_-]/g, '');
}

function sanitizeUrlForAttr(url: string): string {
    return url.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function decisionToStatus(decision: AffiliateDecision): AffiliateStatus {
    if (decision.status === 'converted') return 'converted';
    if (decision.status === 'error') return 'failed';
    return 'unsupported';
}

function extractMerchantDomain(url: string): string {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return '';
    }
}

/**
 * 실패/거부 사유를 upstream 메시지까지 포함해 기록한다.
 * "[-3] a_id 형식오류" 같은 설정 오류가 'denied' 한 단어로 뭉개져
 * 장기간 은폐됐던 사고(2026-07-10)의 재발 방지.
 */
function buildLastError(status: AffiliateStatus, decision: AffiliateDecision): string | null {
    const upstream =
        typeof decision.metadata?.upstreamError === 'string' ? decision.metadata.upstreamError : '';
    if (status === 'failed') {
        const base = decision.reasonCode || 'conversion_failed';
        return upstream && upstream !== base ? `${base}: ${upstream}` : base;
    }
    if (decision.status === 'denied') {
        return upstream ? `denied: ${upstream}` : 'denied';
    }
    return null;
}

function mapDecisionToRow(
    entityType: AffiliateEntityType,
    linkIndex: number,
    decision: AffiliateDecision
): PersistAffiliateRow {
    const status = decisionToStatus(decision);
    return {
        entityType,
        linkIndex,
        sourceUrl: decision.originalUrl,
        normalizedUrl: decision.normalizedUrl || decision.originalUrl,
        merchantDomain: extractMerchantDomain(decision.normalizedUrl || decision.originalUrl),
        platform: decision.network === 'none' ? '' : decision.network,
        affiliateUrl: decision.affiliateUrl || null,
        redirectId: decision.redirectId || '',
        status,
        reasonCode: decision.reasonCode || '',
        attemptCount: 1,
        lastError: buildLastError(status, decision)
    };
}

export function linkifyPlainTextUrls(html: string): string {
    const parts = html.split(/(<[^>]+>)/g);
    let insideAnchor = false;
    // URL 본문은 RFC 3986 호환 ASCII 만 허용 (한글/CJK 가 URL 의 path 로 흡수되어
    // false-positive 자동 링크가 만들어지는 #12175 회귀 방지).
    // 허용 문자: 영숫자, 그리고 - . _ ~ : / ? # [ ] @ ! $ & ' ( ) * + , ; = %
    const URL_BODY = "[A-Za-z0-9\\-._~:/?#\\[\\]@!$&'()*+,;=%]";
    const urlPattern = new RegExp(
        `(^|[\\s(>])((?:https?:\\/\\/|\\/\\/|www\\.)${URL_BODY}+|(?:[a-z0-9-]+\\.)+[a-z]{2,}(?:${URL_BODY}*))`,
        'gi'
    );

    return parts
        .map((part) => {
            if (part.startsWith('<')) {
                if (/^<a[\s>]/i.test(part)) insideAnchor = true;
                if (/^<\/a>/i.test(part)) insideAnchor = false;
                return part;
            }

            if (insideAnchor) return part;

            return part.replace(urlPattern, (full, prefix: string, rawUrl: string) => {
                const trimmedUrl = rawUrl.replace(/[),.!?:;]+$/g, '');
                const trailing = rawUrl.slice(trimmedUrl.length);
                const normalizedUrl = trimmedUrl.startsWith('//')
                    ? `https:${trimmedUrl}`
                    : /^(https?:\/\/)/i.test(trimmedUrl)
                      ? trimmedUrl
                      : `https://${trimmedUrl}`;

                const isDamoang = /damoang\.net/i.test(normalizedUrl);
                if (isDamoang) {
                    return `${prefix}<a href="${normalizedUrl}" class="text-primary hover:underline">${trimmedUrl}</a>${trailing}`;
                }

                return `${prefix}<a href="${normalizedUrl}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">${trimmedUrl}</a>${trailing}`;
            });
        })
        .join('');
}

/**
 * 본문에서 제휴 처리 대상 앵커(href)를 순서대로 뽑는다.
 * sync 의 수집과 글 보기 트리거 판정이 같은 기준을 쓰도록 한 곳에 둔다.
 * 전역 정규식의 lastIndex 상태를 공유하지 않도록 매번 새 정규식을 쓴다.
 */
function extractAnchorUrls(html: string): string[] {
    const linked = linkifyPlainTextUrls(html || '');
    const regex = new RegExp(ANCHOR_REGEX.source, ANCHOR_REGEX.flags);
    const urls: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(linked)) !== null) {
        urls.push(match[2]);
    }
    return urls;
}

/**
 * 본문에 sync 가 행을 만들 링크(앵커 또는 자동 링크될 평문 URL)가 있는지.
 * `<img src>`·iframe 등 속성 안에만 URL 이 있는 글은 false.
 */
export function hasAffiliateCandidateLinks(html: string | null | undefined): boolean {
    if (!html) return false;
    const regex = new RegExp(ANCHOR_REGEX.source, ANCHOR_REGEX.flags.replace('g', ''));
    return regex.test(linkifyPlainTextUrls(html));
}

function collectAnchorDecisions(
    html: string,
    source: 'post_body' | 'comment_body',
    boardId: string,
    postId: number,
    commentId?: number
): Promise<PersistAffiliateDecisionEntry[]> {
    const matches = extractAnchorUrls(html).map((url, i) => ({ index: i + 1, url }));

    return Promise.all(
        matches.map(async ({ index: linkIndex, url }) => {
            const decision = await resolveAffiliateCandidate({
                originalUrl: url,
                normalizedUrl: url,
                source,
                boardId,
                postId,
                commentId
            });
            return {
                row: mapDecisionToRow(source, linkIndex, decision),
                decision,
                source
            };
        })
    );
}

async function collectFieldDecision(input: {
    entityType: Extract<
        AffiliateEntityType,
        'post_link1' | 'post_link2' | 'comment_link1' | 'comment_link2'
    >;
    url: string;
    boardId: string;
    postId: number;
    commentId?: number;
    field: 'link1' | 'link2';
}): Promise<PersistAffiliateDecisionEntry | null> {
    if (!input.url) return null;

    const decision = await resolveAffiliateCandidate({
        originalUrl: input.url,
        normalizedUrl: input.url,
        source: input.entityType as AffiliateSource,
        boardId: input.boardId,
        postId: input.postId,
        commentId: input.commentId,
        linkField: input.field
    });

    return {
        row: mapDecisionToRow(input.entityType, input.field === 'link1' ? 1 : 2, decision),
        decision,
        source: input.entityType
    };
}

type AffiliateRowQueryable = Pick<PoolConnection, 'query'>;

const POST_ENTITY_TYPES: AffiliateEntityType[] = ['post_body', 'post_link1', 'post_link2'];
const COMMENT_ENTITY_TYPES: AffiliateEntityType[] = [
    'comment_body',
    'comment_link1',
    'comment_link2'
];

async function hasExistingEntityRows(
    db: AffiliateRowQueryable,
    boardSlug: string,
    postId: number,
    commentId: number,
    entityTypes: AffiliateEntityType[]
): Promise<boolean> {
    const [existing] = await db.query<RowDataPacket[]>(
        `SELECT 1 FROM g5_affiliate_links WHERE board_slug = ? AND post_id = ? AND comment_id = ? AND entity_type IN (?) LIMIT 1`,
        [boardSlug, postId, commentId, entityTypes]
    );
    return existing.length > 0;
}

export async function replaceEntityRows(
    conn: AffiliateRowQueryable,
    boardSlug: string,
    postId: number,
    commentId: number,
    entityTypes: AffiliateEntityType[],
    rows: PersistAffiliateRow[]
): Promise<void> {
    // 넣을 행이 없으면 지울 행이 있을 때만 DELETE 한다(빈 쓰기 생략).
    if (
        rows.length === 0 &&
        !(await hasExistingEntityRows(conn, boardSlug, postId, commentId, entityTypes))
    ) {
        return;
    }

    await conn.query(
        `DELETE FROM g5_affiliate_links WHERE board_slug = ? AND post_id = ? AND comment_id = ? AND entity_type IN (?)`,
        [boardSlug, postId, commentId, entityTypes]
    );

    if (rows.length === 0) return;

    const values = rows.map((row) => [
        boardSlug,
        postId,
        commentId,
        row.entityType,
        row.linkIndex,
        row.sourceUrl,
        row.normalizedUrl,
        row.merchantDomain,
        row.platform,
        row.affiliateUrl,
        row.redirectId,
        row.status,
        row.reasonCode,
        row.attemptCount,
        row.lastError,
        new Date()
    ]);

    await conn.query<ResultSetHeader>(
        `INSERT INTO g5_affiliate_links (
            board_slug,
            post_id,
            comment_id,
            entity_type,
            link_index,
            source_url,
            normalized_url,
            merchant_domain,
            platform,
            affiliate_url,
            redirect_id,
            status,
            reason_code,
            attempt_count,
            last_error,
            last_processed_at
        ) VALUES ?`,
        [values]
    );
}

export async function syncPostAffiliateLinks(boardId: string, postId: number): Promise<void> {
    if (!(await isLinkProcessingPluginEnabled())) return;

    const safeBoardId = sanitizeBoardId(boardId);
    const [rows] = await pool.query<PostSourceRow[]>(
        `SELECT wr_id, wr_content, wr_link1, wr_link2 FROM ?? WHERE wr_id = ? AND wr_is_comment = 0`,
        [`g5_write_${safeBoardId}`, postId]
    );

    if (!rows[0]) {
        await deletePostAffiliateLinks(safeBoardId, postId);
        return;
    }

    const row = rows[0];
    const bodyEntries = await collectAnchorDecisions(
        row.wr_content || '',
        'post_body',
        safeBoardId,
        postId
    );
    const fieldEntries = (
        await Promise.all([
            collectFieldDecision({
                entityType: 'post_link1',
                url: row.wr_link1 || '',
                boardId: safeBoardId,
                postId,
                field: 'link1'
            }),
            collectFieldDecision({
                entityType: 'post_link2',
                url: row.wr_link2 || '',
                boardId: safeBoardId,
                postId,
                field: 'link2'
            })
        ])
    ).filter((item): item is PersistAffiliateDecisionEntry => item !== null);
    const bodyRows = bodyEntries.map((entry) => entry.row);
    const fieldRows = fieldEntries.map((entry) => entry.row);

    // 넣을 것도 지울 것도 없으면 트랜잭션을 열지 않는다.
    if (
        bodyRows.length === 0 &&
        fieldRows.length === 0 &&
        !(await hasExistingEntityRows(pool, safeBoardId, postId, 0, POST_ENTITY_TYPES))
    ) {
        return;
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await replaceEntityRows(conn, safeBoardId, postId, 0, ['post_body'], bodyRows);
        await replaceEntityRows(
            conn,
            safeBoardId,
            postId,
            0,
            ['post_link1', 'post_link2'],
            fieldRows
        );
        await conn.commit();
        void sendAffiliateDecisionEvents(
            [...bodyEntries, ...fieldEntries].map((entry) => ({
                decision: entry.decision,
                source: entry.source,
                boardId: safeBoardId,
                postId
            }))
        ).catch(() => {});
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

const VIEW_SYNC_LOCK_TTL_SEC = 30;

/**
 * 글 보기 트리거 전용: 같은 글을 동시에 여러 조회가 sync 하지 않도록 짧은 락을 잡는다.
 * Redis 오류 시에는 락 없이 그대로 실행한다(처리 누락 방지).
 */
export async function triggerPostAffiliateSyncOnView(
    boardId: string,
    postId: number,
    sync: (boardId: string, postId: number) => Promise<void> = syncPostAffiliateLinks
): Promise<void> {
    let acquired = true;
    try {
        const { getRedis } = await import('$lib/server/redis');
        const res = await getRedis().set(
            `affiliate:sync:${sanitizeBoardId(boardId)}:${postId}`,
            '1',
            'EX',
            VIEW_SYNC_LOCK_TTL_SEC,
            'NX'
        );
        acquired = res === 'OK';
    } catch {
        acquired = true;
    }
    if (!acquired) return;
    await sync(boardId, postId);
}

export async function syncCommentAffiliateLinks(
    boardId: string,
    postId: number,
    commentId: number
): Promise<void> {
    if (!(await isLinkProcessingPluginEnabled())) return;

    const safeBoardId = sanitizeBoardId(boardId);
    const [rows] = await pool.query<CommentSourceRow[]>(
        `SELECT wr_id, wr_parent, wr_content, wr_link1, wr_link2 FROM ?? WHERE wr_id = ? AND wr_parent = ? AND wr_is_comment = 1`,
        [`g5_write_${safeBoardId}`, commentId, postId]
    );

    if (!rows[0]) {
        await deleteCommentAffiliateLinks(safeBoardId, postId, commentId);
        return;
    }

    const row = rows[0];
    const bodyEntries = await collectAnchorDecisions(
        row.wr_content || '',
        'comment_body',
        safeBoardId,
        postId,
        commentId
    );
    const fieldEntries = (
        await Promise.all([
            collectFieldDecision({
                entityType: 'comment_link1',
                url: row.wr_link1 || '',
                boardId: safeBoardId,
                postId,
                commentId,
                field: 'link1'
            }),
            collectFieldDecision({
                entityType: 'comment_link2',
                url: row.wr_link2 || '',
                boardId: safeBoardId,
                postId,
                commentId,
                field: 'link2'
            })
        ])
    ).filter((item): item is PersistAffiliateDecisionEntry => item !== null);
    const bodyRows = bodyEntries.map((entry) => entry.row);
    const fieldRows = fieldEntries.map((entry) => entry.row);

    // 넣을 것도 지울 것도 없으면 트랜잭션을 열지 않는다.
    if (
        bodyRows.length === 0 &&
        fieldRows.length === 0 &&
        !(await hasExistingEntityRows(pool, safeBoardId, postId, commentId, COMMENT_ENTITY_TYPES))
    ) {
        return;
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await replaceEntityRows(conn, safeBoardId, postId, commentId, ['comment_body'], bodyRows);
        await replaceEntityRows(
            conn,
            safeBoardId,
            postId,
            commentId,
            ['comment_link1', 'comment_link2'],
            fieldRows
        );
        await conn.commit();
        // 이 프로세스의 「변환된 댓글 링크가 있는 글」 집합을 버려 다음 댓글 조회가 새로 읽게 한다.
        invalidateCommentAffiliatePostSet();
        void sendAffiliateDecisionEvents(
            [...bodyEntries, ...fieldEntries].map((entry) => ({
                decision: entry.decision,
                source: entry.source,
                boardId: safeBoardId,
                postId,
                commentId
            }))
        ).catch(() => {});
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
}

export async function deletePostAffiliateLinks(boardId: string, postId: number): Promise<void> {
    try {
        await pool.query(`DELETE FROM g5_affiliate_links WHERE board_slug = ? AND post_id = ?`, [
            sanitizeBoardId(boardId),
            postId
        ]);
    } catch {
        // 테이블 없으면 무시
    }
}

export async function deleteCommentAffiliateLinks(
    boardId: string,
    postId: number,
    commentId: number
): Promise<void> {
    try {
        await pool.query(
            `DELETE FROM g5_affiliate_links WHERE board_slug = ? AND post_id = ? AND comment_id = ?`,
            [sanitizeBoardId(boardId), postId, commentId]
        );
    } catch {
        // 테이블 없으면 무시
    }
}

export async function fetchPostAffiliateLinks(
    boardId: string,
    postId: number
): Promise<AffiliateLinkRow[]> {
    try {
        const [rows] = await pool.query<AffiliateLinkRow[]>(
            `SELECT * FROM g5_affiliate_links WHERE board_slug = ? AND post_id = ? AND comment_id = 0 ORDER BY entity_type, link_index`,
            [sanitizeBoardId(boardId), postId]
        );
        return rows;
    } catch {
        return [];
    }
}

export async function fetchCommentAffiliateLinks(
    boardId: string,
    postId: number,
    commentIds: number[]
): Promise<AffiliateLinkRow[]> {
    if (commentIds.length === 0) return [];
    try {
        const [rows] = await pool.query<AffiliateLinkRow[]>(
            `SELECT * FROM g5_affiliate_links WHERE board_slug = ? AND post_id = ? AND comment_id IN (?) ORDER BY comment_id, entity_type, link_index`,
            [sanitizeBoardId(boardId), postId, commentIds]
        );
        return rows;
    } catch {
        return [];
    }
}

/**
 * 「변환된(converted) 댓글 제휴 링크가 있는 글」 집합 — 댓글 조회 게이트용.
 *
 * 댓글 렌더는 status='converted' 행만 쓰므로, 이 집합에 없는 글은 댓글 제휴 행을
 * 조회하지 않아도 렌더 결과가 같다. 집합은 프로세스 캐시(singleflight, 오류 미캐시).
 *
 * 한계: syncCommentAffiliateLinks 는 커밋한 프로세스의 집합만 무효화한다. 다른 인스턴스에서는
 * 새로 변환된 댓글 링크가 최대 TTL 동안 원래 링크로 보일 수 있다.
 */
export const COMMENT_AFFILIATE_POST_SET_TTL_MS = 30_000;

const commentAffiliatePostSetCache = createCache<Set<string>>({
    ttl: COMMENT_AFFILIATE_POST_SET_TTL_MS,
    maxSize: 4
});
// 무효화마다 키를 바꾼다. 무효화 전에 시작된 조회가 늦게 끝나도 옛 키에 저장되어 읽히지 않는다.
let commentAffiliatePostSetGeneration = 0;

// board_slug 비교는 DB 정렬 규칙처럼 대소문자를 가리지 않게 맞춘다(게이트가 조회보다 엄격하면 안 된다).
function commentAffiliatePostKey(boardSlug: string, postId: number): string {
    return `${boardSlug.toLowerCase()}:${postId}`;
}

// 집합 로드가 끝나지 않으면 singleflight 가 계속 그 약속을 돌려주므로 따로 끊는다(오류 → 미캐시 → 조회).
export const COMMENT_AFFILIATE_POST_SET_LOAD_TIMEOUT_MS = 1_500;

async function loadCommentAffiliatePostSet(): Promise<Set<string>> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const query = pool
        .query<RowDataPacket[]>(
            `SELECT DISTINCT board_slug, post_id FROM g5_affiliate_links WHERE comment_id <> 0 AND status = 'converted'`
        )
        .then(([rows]) => {
            const set = new Set<string>();
            for (const row of rows) {
                set.add(commentAffiliatePostKey(String(row.board_slug), Number(row.post_id)));
            }
            return set;
        });
    query.catch(() => {});
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
            () => reject(new Error('comment affiliate post set load timeout')),
            COMMENT_AFFILIATE_POST_SET_LOAD_TIMEOUT_MS
        );
    });
    try {
        return await Promise.race([query, timeout]);
    } finally {
        clearTimeout(timer);
    }
}

/**
 * 이 글의 댓글에 변환된 제휴 링크가 있을 수 있는지.
 * 집합을 읽지 못하면 true(= 지금처럼 조회, fail-open).
 */
export async function postMayHaveCommentAffiliateLinks(
    boardId: string,
    postId: number
): Promise<boolean> {
    try {
        const set = await commentAffiliatePostSetCache.getOrSet(
            `g${commentAffiliatePostSetGeneration}`,
            loadCommentAffiliatePostSet
        );
        return set.has(commentAffiliatePostKey(sanitizeBoardId(boardId), postId));
    } catch {
        return true;
    }
}

/** 이 프로세스의 댓글 제휴 글 집합을 버린다(다음 조회가 새로 읽는다). */
export function invalidateCommentAffiliatePostSet(): void {
    commentAffiliatePostSetGeneration += 1;
    commentAffiliatePostSetCache.clear();
}

export function groupAffiliateLinksByCommentId(
    rows: AffiliateLinkRow[]
): Map<number, AffiliateLinkRow[]> {
    const grouped = new Map<number, AffiliateLinkRow[]>();
    for (const row of rows) {
        const bucket = grouped.get(row.comment_id) || [];
        bucket.push(row);
        grouped.set(row.comment_id, bucket);
    }
    return grouped;
}

export function renderAffiliateContent(
    html: string,
    rows: AffiliateLinkRow[],
    entityType: 'post_body' | 'comment_body'
): string {
    if (!html) return html;

    const linked = linkifyPlainTextUrls(html);
    const converted = new Map(
        rows
            .filter((row) => row.entity_type === entityType && row.status === 'converted')
            .map((row) => [row.link_index, row])
    );

    if (converted.size === 0) return linked;

    let anchorIndex = 0;
    ANCHOR_REGEX.lastIndex = 0;
    return linked.replace(
        ANCHOR_REGEX,
        (full, beforeHref: string, href: string, afterHref: string, innerHtml: string) => {
            anchorIndex += 1;
            const row = converted.get(anchorIndex);
            if (!row?.redirect_id) return full;

            const redirectHref = sanitizeUrlForAttr(`/go/${row.redirect_id}`);
            return `<a ${beforeHref}href="${redirectHref}"${afterHref}>${innerHtml}</a>`;
        }
    );
}

export function applyAffiliateField(
    originalUrl: string,
    row: AffiliateLinkRow | undefined
): { href: string; displayUrl: string; affiliate: boolean; platform: string | null } {
    if (!row || row.status !== 'converted' || !row.redirect_id) {
        return {
            href: originalUrl,
            displayUrl: originalUrl,
            affiliate: false,
            platform: null
        };
    }

    return {
        href: `/go/${row.redirect_id}`,
        displayUrl: originalUrl,
        affiliate: true,
        platform: row.platform || null
    };
}

export function findAffiliateFieldRow(
    rows: AffiliateLinkRow[],
    entityType: Extract<
        AffiliateEntityType,
        'post_link1' | 'post_link2' | 'comment_link1' | 'comment_link2'
    >
): AffiliateLinkRow | undefined {
    return rows.find((row) => row.entity_type === entityType);
}

export async function resolveAffiliateRedirectFromStorage(
    id: string
): Promise<{ url: string; platform: string; board?: string; postId?: number } | null> {
    const cached = await resolveAffiliateRedirectFromCache(id);
    if (cached) return cached;

    const [rows] = await pool.query<RedirectPayload[]>(
        `SELECT affiliate_url, platform, board_slug, post_id FROM g5_affiliate_links WHERE redirect_id = ? LIMIT 1`,
        [id]
    );
    const row = rows[0];
    if (!row?.affiliate_url) return null;

    const payload = {
        url: row.affiliate_url,
        platform: row.platform || '',
        ...(row.board_slug ? { board: row.board_slug } : {}),
        ...(row.post_id ? { postId: row.post_id } : {})
    };

    try {
        const { getRedis } = await import('$lib/server/redis');
        await getRedis().setex(
            `${REDIRECT_PREFIX}${id}`,
            REDIRECT_TTL_SEC,
            JSON.stringify(payload)
        );
    } catch {
        // Redis 장애 시 DB fallback만 사용
    }

    return payload;
}

export async function backfillAffiliateLinks(input: {
    boardId: string;
    postIdFrom?: number;
    postIdTo?: number;
    limit?: number;
    entity?: 'post' | 'comment' | 'both';
}): Promise<{ posts: number; comments: number }> {
    const safeBoardId = sanitizeBoardId(input.boardId);
    const limit = Math.max(1, Math.min(input.limit || 100, 500));
    const entity = input.entity || 'both';
    let posts = 0;
    let comments = 0;

    if (entity === 'post' || entity === 'both') {
        const postWhere: string[] = ['wr_is_comment = 0'];
        const postParams: Array<string | number> = [`g5_write_${safeBoardId}`];
        if (input.postIdFrom) {
            postWhere.push('wr_id >= ?');
            postParams.push(input.postIdFrom);
        }
        if (input.postIdTo) {
            postWhere.push('wr_id <= ?');
            postParams.push(input.postIdTo);
        }
        const [postRows] = await pool.query<RowDataPacket[]>(
            `SELECT wr_id FROM ?? WHERE ${postWhere.join(' AND ')} ORDER BY wr_id DESC LIMIT ?`,
            [...postParams, limit]
        );
        for (const row of postRows) {
            await syncPostAffiliateLinks(safeBoardId, Number(row.wr_id));
            posts += 1;
        }
    }

    if (entity === 'comment' || entity === 'both') {
        const commentWhere: string[] = ['wr_is_comment = 1'];
        const commentParams: Array<string | number> = [`g5_write_${safeBoardId}`];
        if (input.postIdFrom) {
            commentWhere.push('wr_parent >= ?');
            commentParams.push(input.postIdFrom);
        }
        if (input.postIdTo) {
            commentWhere.push('wr_parent <= ?');
            commentParams.push(input.postIdTo);
        }
        const [commentRows] = await pool.query<RowDataPacket[]>(
            `SELECT wr_id, wr_parent FROM ?? WHERE ${commentWhere.join(' AND ')} ORDER BY wr_id DESC LIMIT ?`,
            [...commentParams, limit]
        );
        for (const row of commentRows) {
            await syncCommentAffiliateLinks(safeBoardId, Number(row.wr_parent), Number(row.wr_id));
            comments += 1;
        }
    }

    return { posts, comments };
}
