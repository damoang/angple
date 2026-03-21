import {
    processCommentContentLinks,
    processLinkField,
    processPostContentLinks
} from '$lib/server/link-processing/adapter';

export async function transformAffiliateContent(
    html: string,
    context?: { bo_table?: string; wr_id?: number }
): Promise<string> {
    return processPostContentLinks(html, {
        boardId: context?.bo_table,
        postId: context?.wr_id
    });
}

export async function transformAffiliateCommentContent(
    html: string,
    context?: { bo_table?: string; wr_id?: number; comment_id?: number }
): Promise<string> {
    return processCommentContentLinks(html, {
        boardId: context?.bo_table,
        postId: context?.wr_id,
        commentId: context?.comment_id
    });
}

export async function transformAffiliateLinkField(input: {
    url: string;
    boardId?: string;
    postId?: number;
    commentId?: number;
    source: 'post_link1' | 'post_link2' | 'comment_link1' | 'comment_link2';
    field: 'link1' | 'link2';
}): Promise<{
    href: string;
    displayUrl: string;
    decision: {
        status: 'converted' | 'passthrough' | 'unsupported' | 'denied' | 'error';
        reasonCode: string;
        network: string;
        originalUrl: string;
        normalizedUrl: string;
    };
}> {
    const result = await processLinkField(input);
    return {
        href: result.href,
        displayUrl: result.displayUrl,
        decision: {
            status:
                result.result.outcome === 'transformed'
                    ? 'converted'
                    : result.result.outcome === 'blocked'
                      ? 'denied'
                      : result.result.outcome === 'failed'
                        ? 'error'
                        : result.result.outcome,
            reasonCode: result.result.code,
            network: result.result.provider ?? 'none',
            originalUrl: result.result.inputUrl,
            normalizedUrl: result.result.normalizedUrl
        }
    };
}
