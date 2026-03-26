import {
    convertAffiliateLinksDetailed,
    convertAffiliateUrl
} from '../../affiliate-link/lib/affiliate-api.server';
import { detectPlatform, extractHost, normalizeUrl, mergeMerchantDomains } from '../../affiliate-link/lib/domain-matcher';
import pool from '$lib/server/db.js';
import { buildAffiliateRedirectRecord, attachRedirectToDecision } from './redirect-store.server';
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
    AffiliateInputKind,
    AffiliateLinkFieldInput,
    AffiliateLinkFieldOutput
} from './types';

/** DB affiliate_merchants에서 linkprice 도메인을 읽어 LINKPRICE_MERCHANTS에 병합 (최초 1회) */
let _merchantsSynced = false;
async function _syncMerchants(): Promise<void> {
    if (_merchantsSynced) return;
    _merchantsSynced = true;
    try {
        const [rows] = await pool.query(
            "SELECT domain FROM affiliate_merchants WHERE platform = 'linkprice' AND is_active = 1"
        );
        mergeMerchantDomains(
            (rows as Array<{ domain: string }>).map((r) => r.domain)
        );
    } catch {
        // DB 미연결 시 하드코딩 폴백
    }
}

function classifyAffiliateInput(
    url: string,
    platform?: NonNullable<ReturnType<typeof detectPlatform>> | null
): AffiliateInputKind | null {
    const normalizedPlatform = platform ?? detectPlatform(url);
    if (!normalizedPlatform) return null;

    const host = extractHost(url);
    if (!host) return null;

    switch (normalizedPlatform) {
        case 'coupang': {
            if (/^link\.coupang\.com$/i.test(host)) {
                try {
                    const parsed = new URL(url);
                    const pathname = parsed.pathname.toLowerCase();
                    if (pathname.startsWith('/re/affsdp')) {
                        return parsed.searchParams.has('pageKey')
                            ? 'affiliate_url_rebindable'
                            : 'affiliate_url_non_rebindable';
                    }
                    if (pathname.startsWith('/a/')) {
                        return 'affiliate_url_non_rebindable';
                    }
                } catch {
                    return 'affiliate_url_non_rebindable';
                }
            }

            if (/^coupa\.ng$/i.test(host)) {
                return 'affiliate_url_non_rebindable';
            }

            return 'merchant_url';
        }
        case 'aliexpress':
            return /(^|\.)(s\.click|click|a)\.aliexpress\.com$/i.test(host)
                ? 'affiliate_url_rebindable'
                : 'merchant_url';
        case 'linkprice':
            return /(^|\.)(click\.linkprice\.com|lase\.kr|lpweb\.kr|app\.ac)$/i.test(host)
                ? 'affiliate_url_non_rebindable'
                : 'merchant_url';
        case 'amazon':
            return /(^|\.)(amzn\.to|amzn\.asia)$/i.test(host)
                ? 'affiliate_url_non_rebindable'
                : 'merchant_url';
        case 'kkday':
            return 'merchant_url';
        default:
            return 'merchant_url';
    }
}

function getRebindFailureReason(input: {
    platform: NonNullable<ReturnType<typeof detectPlatform>>;
    inputKind: AffiliateInputKind;
    upstreamError?: string;
}):
    | 'rebind_not_supported'
    | 'rebind_failed_short_affiliate'
    | 'rebind_failed_upstream_blocked'
    | 'api_error' {
    if (input.inputKind === 'affiliate_url_non_rebindable') {
        if (input.platform === 'coupang') {
            return 'rebind_failed_short_affiliate';
        }
        return 'rebind_not_supported';
    }

    if (
        input.inputKind === 'affiliate_url_rebindable' &&
        input.upstreamError === 'Conversion failed'
    ) {
        return 'rebind_failed_upstream_blocked';
    }

    return 'api_error';
}

export async function resolveAffiliateCandidate(
    candidate: AffiliateCandidate
): Promise<AffiliateDecision> {
    await _syncMerchants();
    const normalizedUrl = normalizeUrl(candidate.originalUrl) ?? candidate.originalUrl;
    const platform = detectPlatform(normalizedUrl);
    const inputKind = classifyAffiliateInput(normalizedUrl, platform);

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
            const decision = classifyLinkPriceFailure({
                originalUrl: candidate.originalUrl,
                normalizedUrl,
                upstreamError: result.error
            });
            return inputKind && inputKind !== 'merchant_url'
                ? {
                      ...decision,
                      reasonCode:
                          getRebindFailureReason({
                              platform,
                              inputKind,
                              upstreamError: result.error
                          }) === 'api_error'
                              ? decision.reasonCode
                              : getRebindFailureReason({
                                    platform,
                                    inputKind,
                                    upstreamError: result.error
                                }),
                      metadata: {
                          ...(decision.metadata || {}),
                          inputKind,
                          rebindAttempted: true
                      }
                  }
                : decision;
        }

        if (platform === 'aliexpress') {
            return createAliExpressApiErrorDecision(
                candidate.originalUrl,
                normalizedUrl,
                inputKind && inputKind !== 'merchant_url'
                    ? getRebindFailureReason({
                          platform,
                          inputKind,
                          upstreamError: result.error
                      })
                    : 'api_error'
            );
        }

        if (result.error === 'No converter found') {
            return createPassthroughDecision(
                candidate.originalUrl,
                normalizedUrl,
                'unsupported_domain'
            );
        }

        return createErrorDecision(
            candidate.originalUrl,
            normalizedUrl,
            inputKind && inputKind !== 'merchant_url'
                ? getRebindFailureReason({
                      platform,
                      inputKind,
                      upstreamError: result.error
                  })
                : 'api_error',
            {
                platform,
                upstreamError: result.error || null,
                ...(inputKind ? { inputKind, rebindAttempted: inputKind !== 'merchant_url' } : {})
            }
        );
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
            reasonCode: inputKind && inputKind !== 'merchant_url' ? 'rebind_success' : 'converted',
            network: result.platform,
            originalUrl: candidate.originalUrl,
            normalizedUrl,
            affiliateUrl: result.url,
            metadata:
                inputKind && inputKind !== 'merchant_url'
                    ? {
                          inputKind,
                          rebindAttempted: true,
                          rebindSucceeded: true
                      }
                    : undefined
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
