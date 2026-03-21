import {
    convertAffiliateLinksDetailed,
    convertAffiliateUrl
} from '../../affiliate-link/lib/affiliate-api.server';
import { detectPlatform, normalizeUrl } from '../../affiliate-link/lib/domain-matcher';
import { buildAffiliateRedirectRecord, attachRedirectToDecision } from './redirect-store';
import { createErrorDecision, createPassthroughDecision } from './policies';
import {
    createAliExpressApiErrorDecision,
    createAliExpressEnvMissingDecision,
    hasAliExpressCredentials
} from './platforms/aliexpress';
import { classifyLinkPriceFailure } from './platforms/linkprice';
import type {
    AffiliateCandidate,
    AffiliateContentContext,
    AffiliateContentResolution,
    AffiliateDecision,
    AffiliateLinkFieldInput,
    AffiliateLinkFieldOutput
} from './types';

export async function resolveAffiliateCandidate(
    candidate: AffiliateCandidate
): Promise<AffiliateDecision> {
    const normalizedUrl = normalizeUrl(candidate.originalUrl) ?? candidate.originalUrl;
    const platform = detectPlatform(normalizedUrl);

    if (!platform) {
        return createPassthroughDecision(
            candidate.originalUrl,
            normalizedUrl,
            'unsupported_domain'
        );
    }

    if (platform === 'aliexpress' && !hasAliExpressCredentials()) {
        return createAliExpressEnvMissingDecision(candidate.originalUrl, normalizedUrl);
    }

    const result = await convertAffiliateUrl(normalizedUrl, {
        bo_table: candidate.boardId,
        wr_id: candidate.postId
    });

    if (!result.converted || !result.platform) {
        if (platform === 'linkprice') {
            return classifyLinkPriceFailure({
                originalUrl: candidate.originalUrl,
                normalizedUrl,
                upstreamError: result.error
            });
        }

        if (platform === 'aliexpress') {
            return createAliExpressApiErrorDecision(candidate.originalUrl, normalizedUrl);
        }

        if (result.error === 'No converter found') {
            return createPassthroughDecision(
                candidate.originalUrl,
                normalizedUrl,
                'unsupported_domain'
            );
        }

        return createErrorDecision(candidate.originalUrl, normalizedUrl, 'api_error', {
            platform,
            upstreamError: result.error || null
        });
    }

    const { redirectUrl, redirectId } = await buildAffiliateRedirectRecord({
        url: result.url,
        platform: result.platform,
        boardId: candidate.boardId,
        postId: candidate.postId
    });

    return attachRedirectToDecision(
        {
            status: 'converted',
            reasonCode: 'converted',
            network: result.platform,
            originalUrl: candidate.originalUrl,
            normalizedUrl,
            affiliateUrl: result.url
        },
        redirectUrl,
        redirectId
    );
}

export async function resolveAffiliateContent(
    html: string,
    context: AffiliateContentContext
): Promise<string> {
    if (!html) return html;

    const resolved = await resolveAffiliateContentDetailed(html, context);
    return resolved.content;
}

export async function resolveAffiliateContentDetailed(
    html: string,
    context: AffiliateContentContext
): Promise<AffiliateContentResolution> {
    if (!html) {
        return {
            content: html,
            decisions: [],
            summary: {
                total: 0,
                converted: 0,
                unsupported: 0,
                denied: 0,
                error: 0,
                passthrough: 0
            }
        };
    }

    const { content, results } = await convertAffiliateLinksDetailed(
        html,
        context.boardId,
        context.postId
    );

    const decisions: AffiliateDecision[] = await Promise.all(
        results.map((result) =>
            resolveAffiliateCandidate({
                originalUrl: result.original,
                normalizedUrl: normalizeUrl(result.original) ?? result.original,
                source: context.source,
                boardId: context.boardId,
                postId: context.postId,
                commentId: context.commentId
            })
        )
    );

    const summary = {
        total: decisions.length,
        converted: decisions.filter((d) => d.status === 'converted').length,
        unsupported: decisions.filter((d) => d.status === 'unsupported').length,
        denied: decisions.filter((d) => d.status === 'denied').length,
        error: decisions.filter((d) => d.status === 'error').length,
        passthrough: decisions.filter((d) => d.status === 'passthrough').length
    };

    return {
        content,
        decisions,
        summary
    };
}

export async function resolveAffiliateLinkField(
    input: AffiliateLinkFieldInput
): Promise<AffiliateLinkFieldOutput> {
    const decision = await resolveAffiliateCandidate({
        originalUrl: input.url,
        normalizedUrl: normalizeUrl(input.url) ?? input.url,
        source: input.source,
        boardId: input.boardId,
        postId: input.postId,
        commentId: input.commentId,
        linkField: input.field
    });

    return {
        href: decision.redirectUrl || input.url,
        displayUrl: input.url,
        decision
    };
}
