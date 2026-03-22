import {
    convertAffiliateLinksDetailed,
    convertAffiliateUrl
} from '$plugins/affiliate-link/lib/affiliate-api.server';
import { detectPlatform, normalizeUrl } from '$plugins/affiliate-link/lib/domain-matcher';
import { buildAffiliateRedirectRecord } from '$lib/server/affiliate-redirect';
import { isLinkProcessingPluginEnabled } from './runtime';
import { logLinkProcessingContentResolution, logLinkProcessingResult } from './observability';
import type { LinkProcessingPluginDecision, LinkProcessingPluginRuntime } from './plugin-contract';
import type {
    LinkFieldProcessingInput,
    LinkFieldProcessingOutput,
    LinkProcessingContentResolution,
    LinkProcessingResult
} from './types';

let privateAffiliatePluginPromise: Promise<LinkProcessingPluginRuntime> | null = null;

async function loadPrivateAffiliatePlugin(): Promise<LinkProcessingPluginRuntime> {
    if (!privateAffiliatePluginPromise) {
        privateAffiliatePluginPromise = import(
            '$plugins/affiliate-link-private'
        ) as Promise<LinkProcessingPluginRuntime>;
    }

    const plugin = await privateAffiliatePluginPromise;
    if (typeof plugin.configureAffiliateRuntime === 'function') {
        plugin.configureAffiliateRuntime({
            convertAffiliateUrl,
            convertAffiliateLinksDetailed,
            normalizeUrl,
            detectPlatform: (url) => detectPlatform(url) ?? null,
            buildAffiliateRedirectRecord: async ({ url, platform, boardId, postId }) => {
                const redirect = await buildAffiliateRedirectRecord({
                    url,
                    platform,
                    ...(boardId ? { board: boardId } : {}),
                    ...(postId ? { postId } : {})
                });

                return {
                    redirectUrl: redirect.redirectUrl,
                    redirectId: redirect.redirectId
                };
            }
        });
    }

    return plugin;
}

function linkifyPlainTextUrls(html: string): string {
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

function mapDecisionToResult(decision: LinkProcessingPluginDecision): LinkProcessingResult {
    return {
        outcome:
            decision.status === 'converted'
                ? 'transformed'
                : decision.status === 'denied'
                  ? 'blocked'
                  : decision.status === 'error'
                    ? 'failed'
                    : decision.status,
        code: decision.reasonCode,
        provider: decision.network === 'none' ? null : decision.network,
        inputUrl: decision.originalUrl,
        normalizedUrl: decision.normalizedUrl,
        targetUrl: decision.affiliateUrl,
        redirectUrl: decision.redirectUrl,
        redirectId: decision.redirectId,
        meta: decision.metadata
    };
}

export async function processPostContentLinks(
    html: string,
    context?: { boardId?: string; postId?: number }
): Promise<string> {
    if (!html) return html;
    if (!(await isLinkProcessingPluginEnabled())) return html;

    try {
        const linked = linkifyPlainTextUrls(html);
        const plugin = await loadPrivateAffiliatePlugin();
        const resolution = await plugin.resolveAffiliateContentDetailed(linked, {
            source: 'post_body',
            boardId: context?.boardId,
            postId: context?.postId
        });
        const mapped: LinkProcessingContentResolution = {
            content: resolution.content,
            results: resolution.decisions.map(mapDecisionToResult),
            summary: {
                total: resolution.summary.total,
                transformed: resolution.summary.converted,
                unsupported: resolution.summary.unsupported,
                blocked: resolution.summary.denied,
                failed: resolution.summary.error,
                passthrough: resolution.summary.passthrough
            }
        };
        logLinkProcessingContentResolution(mapped, {
            source: 'post_body',
            boardId: context?.boardId,
            postId: context?.postId
        });
        return mapped.content;
    } catch (error) {
        console.error('[LinkProcessing] content transform error:', error);
        return html;
    }
}

export async function processCommentContentLinks(
    html: string,
    context?: { boardId?: string; postId?: number; commentId?: number }
): Promise<string> {
    if (!html) return html;
    if (!(await isLinkProcessingPluginEnabled())) return html;

    try {
        const linked = linkifyPlainTextUrls(html);
        const plugin = await loadPrivateAffiliatePlugin();
        const resolution = await plugin.resolveAffiliateContentDetailed(linked, {
            source: 'comment_body',
            boardId: context?.boardId,
            postId: context?.postId,
            commentId: context?.commentId
        });
        const mapped: LinkProcessingContentResolution = {
            content: resolution.content,
            results: resolution.decisions.map(mapDecisionToResult),
            summary: {
                total: resolution.summary.total,
                transformed: resolution.summary.converted,
                unsupported: resolution.summary.unsupported,
                blocked: resolution.summary.denied,
                failed: resolution.summary.error,
                passthrough: resolution.summary.passthrough
            }
        };
        logLinkProcessingContentResolution(mapped, {
            source: 'comment_body',
            boardId: context?.boardId,
            postId: context?.postId,
            commentId: context?.commentId
        });
        return mapped.content;
    } catch (error) {
        console.error('[LinkProcessing] comment transform error:', error);
        return html;
    }
}

export async function processLinkField(
    input: LinkFieldProcessingInput
): Promise<LinkFieldProcessingOutput> {
    if (!(await isLinkProcessingPluginEnabled())) {
        return {
            href: input.url,
            displayUrl: input.url,
            result: {
                outcome: 'passthrough',
                code: 'plugin_disabled',
                provider: null,
                inputUrl: input.url,
                normalizedUrl: input.url
            }
        };
    }

    const plugin = await loadPrivateAffiliatePlugin();
    const result = await plugin.resolveAffiliateLinkField(input);
    const mapped = mapDecisionToResult(result.decision);
    logLinkProcessingResult(mapped, {
        source: input.source,
        boardId: input.boardId,
        postId: input.postId,
        commentId: input.commentId,
        field: input.field
    });

    return {
        href: result.href,
        displayUrl: result.displayUrl,
        result: mapped
    };
}
