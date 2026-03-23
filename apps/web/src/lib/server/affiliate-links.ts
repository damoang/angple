import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import pool from '$lib/server/db';
import { isLinkProcessingPluginEnabled } from '$lib/server/link-processing/runtime';
import { resolveAffiliateCandidate } from '$plugins/affiliate-link-private/lib/resolver.server';
import type { AffiliateDecision, AffiliateSource } from '$plugins/affiliate-link-private/lib/types';
import { resolveAffiliateRedirect as resolveAffiliateRedirectFromCache } from '$lib/server/affiliate-redirect';
import { sendAffiliateDecisionEvents } from '$lib/server/affiliate-events';

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
        lastError:
            status === 'failed'
                ? decision.reasonCode || 'conversion_failed'
                : decision.status === 'denied'
                  ? 'denied'
                  : null
    };
}

export function linkifyPlainTextUrls(html: string): string {
    const parts = html.split(/(<[^>]+>)/g);
    let insideAnchor = false;
    const urlPattern =
        /(^|[\s(>])((?:https?:\/\/|\/\/|www\.)[^\s<>"']+|(?:[a-z0-9-]+\.)+[a-z]{2,}[^\s<>"']*)/gi;

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

function collectAnchorDecisions(
    html: string,
    source: 'post_body' | 'comment_body',
    boardId: string,
    postId: number,
    commentId?: number
): Promise<PersistAffiliateDecisionEntry[]> {
    const linked = linkifyPlainTextUrls(html || '');
    const matches: Array<{ index: number; url: string }> = [];
    let match: RegExpExecArray | null;
    let index = 0;
    ANCHOR_REGEX.lastIndex = 0;

    while ((match = ANCHOR_REGEX.exec(linked)) !== null) {
        index += 1;
        matches.push({ index, url: match[2] });
    }

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

async function replaceEntityRows(
    conn: PoolConnection,
    boardSlug: string,
    postId: number,
    commentId: number,
    entityTypes: AffiliateEntityType[],
    rows: PersistAffiliateRow[]
): Promise<void> {
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
    await pool.query(`DELETE FROM g5_affiliate_links WHERE board_slug = ? AND post_id = ?`, [
        sanitizeBoardId(boardId),
        postId
    ]);
}

export async function deleteCommentAffiliateLinks(
    boardId: string,
    postId: number,
    commentId: number
): Promise<void> {
    await pool.query(
        `DELETE FROM g5_affiliate_links WHERE board_slug = ? AND post_id = ? AND comment_id = ?`,
        [sanitizeBoardId(boardId), postId, commentId]
    );
}

export async function fetchPostAffiliateLinks(
    boardId: string,
    postId: number
): Promise<AffiliateLinkRow[]> {
    const [rows] = await pool.query<AffiliateLinkRow[]>(
        `SELECT * FROM g5_affiliate_links WHERE board_slug = ? AND post_id = ? AND comment_id = 0 ORDER BY entity_type, link_index`,
        [sanitizeBoardId(boardId), postId]
    );
    return rows;
}

export async function fetchCommentAffiliateLinks(
    boardId: string,
    postId: number,
    commentIds: number[]
): Promise<AffiliateLinkRow[]> {
    if (commentIds.length === 0) return [];
    const [rows] = await pool.query<AffiliateLinkRow[]>(
        `SELECT * FROM g5_affiliate_links WHERE board_slug = ? AND post_id = ? AND comment_id IN (?) ORDER BY comment_id, entity_type, link_index`,
        [sanitizeBoardId(boardId), postId, commentIds]
    );
    return rows;
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
