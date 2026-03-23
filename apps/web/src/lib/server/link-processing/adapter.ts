import {
    applyAffiliateField,
    fetchCommentAffiliateLinks,
    fetchPostAffiliateLinks,
    findAffiliateFieldRow,
    renderAffiliateContent
} from '$lib/server/affiliate-links';
import { isLinkProcessingPluginEnabled } from './runtime';
import { logLinkProcessingResult } from './observability';
import type { LinkFieldProcessingInput, LinkFieldProcessingOutput } from './types';

function mapFieldResult(
    input: LinkFieldProcessingInput,
    output: { href: string; displayUrl: string; affiliate: boolean; platform: string | null }
): LinkFieldProcessingOutput {
    return {
        href: output.href,
        displayUrl: output.displayUrl,
        result: {
            outcome: output.affiliate ? 'transformed' : 'passthrough',
            code: output.affiliate ? 'converted' : 'not_synced',
            provider: output.platform,
            inputUrl: input.url,
            normalizedUrl: input.url,
            ...(output.affiliate ? { redirectUrl: output.href } : {})
        }
    };
}

export async function processPostContentLinks(
    html: string,
    context?: { boardId?: string; postId?: number }
): Promise<string> {
    if (!html) return html;
    if (!(await isLinkProcessingPluginEnabled())) return html;
    if (!context?.boardId || !context.postId) return html;

    const rows = await fetchPostAffiliateLinks(context.boardId, context.postId);
    return renderAffiliateContent(html, rows, 'post_body');
}

export async function processCommentContentLinks(
    html: string,
    context?: { boardId?: string; postId?: number; commentId?: number }
): Promise<string> {
    if (!html) return html;
    if (!(await isLinkProcessingPluginEnabled())) return html;
    if (!context?.boardId || !context.postId || !context.commentId) return html;

    const rows = await fetchCommentAffiliateLinks(context.boardId, context.postId, [
        context.commentId
    ]);
    return renderAffiliateContent(html, rows, 'comment_body');
}

export async function processLinkField(
    input: LinkFieldProcessingInput
): Promise<LinkFieldProcessingOutput> {
    if (!(await isLinkProcessingPluginEnabled())) {
        return mapFieldResult(input, {
            href: input.url,
            displayUrl: input.url,
            affiliate: false,
            platform: null
        });
    }

    const rows =
        input.commentId && input.postId
            ? await fetchCommentAffiliateLinks(input.boardId || '', input.postId, [input.commentId])
            : input.postId
              ? await fetchPostAffiliateLinks(input.boardId || '', input.postId)
              : [];

    const row = findAffiliateFieldRow(rows, input.source);
    const output = applyAffiliateField(input.url, row);
    const mapped = mapFieldResult(input, output);

    logLinkProcessingResult(mapped.result, {
        source: input.source,
        boardId: input.boardId,
        postId: input.postId,
        commentId: input.commentId,
        field: input.field
    });

    return mapped;
}
