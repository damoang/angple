import { buildAffiliateRedirectUrl, resolveAffiliateRedirect } from '$lib/server/affiliate-redirect';
import type { AffiliateDecision } from './types';

export async function buildAffiliateRedirectRecord(input: {
    url: string;
    platform: string;
    boardId?: string;
    postId?: number;
}): Promise<{ redirectUrl: string; redirectId?: string }> {
    const redirectUrl = await buildAffiliateRedirectUrl({
        url: input.url,
        platform: input.platform,
        ...(input.boardId ? { board: input.boardId } : {}),
        ...(input.postId ? { postId: input.postId } : {})
    });

    const redirectId = redirectUrl.split('/go/')[1] || undefined;
    return { redirectUrl, redirectId };
}

export async function resolveAffiliateRedirectRecord(
    redirectId: string
): Promise<ReturnType<typeof resolveAffiliateRedirect>> {
    return resolveAffiliateRedirect(redirectId);
}

export function attachRedirectToDecision(
    decision: AffiliateDecision,
    redirectUrl: string,
    redirectId?: string
): AffiliateDecision {
    return {
        ...decision,
        redirectUrl,
        redirectId
    };
}
