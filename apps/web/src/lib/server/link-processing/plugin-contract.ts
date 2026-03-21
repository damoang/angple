import type { LinkFieldProcessingInput, LinkProcessingSource } from './types';

export interface LinkProcessingPluginDecision {
    status: 'converted' | 'passthrough' | 'unsupported' | 'denied' | 'error';
    reasonCode: string;
    network: string;
    originalUrl: string;
    normalizedUrl: string;
    affiliateUrl?: string;
    redirectUrl?: string;
    redirectId?: string;
    metadata?: Record<string, string | number | boolean | null>;
}

export interface LinkProcessingPluginContentResolution {
    content: string;
    decisions: LinkProcessingPluginDecision[];
    summary: {
        total: number;
        converted: number;
        unsupported: number;
        denied: number;
        error: number;
        passthrough: number;
    };
}

export interface LinkProcessingPluginRuntime {
    configureAffiliateRuntime?: (deps: {
        convertAffiliateUrl: (
            url: string,
            context?: { bo_table?: string; wr_id?: number }
        ) => Promise<{
            url: string;
            original: string;
            platform: string | null;
            converted: boolean;
            cached: boolean;
            error?: string;
        }>;
        convertAffiliateLinksDetailed: (
            content: string,
            boTable?: string,
            wrId?: number
        ) => Promise<{
            content: string;
            results: Array<{
                url: string;
                original: string;
                platform: string | null;
                converted: boolean;
                cached: boolean;
                error?: string;
            }>;
        }>;
        normalizeUrl: (url: string) => string | null | undefined;
        detectPlatform: (url: string) => string | null;
        buildAffiliateRedirectRecord: (input: {
            url: string;
            platform: string;
            boardId?: string;
            postId?: number;
        }) => Promise<{ redirectUrl: string; redirectId?: string }>;
    }) => void;
    resolveAffiliateContentDetailed: (
        html: string,
        context: {
            source: Extract<LinkProcessingSource, 'post_body' | 'comment_body'>;
            boardId?: string;
            postId?: number;
            commentId?: number;
        }
    ) => Promise<LinkProcessingPluginContentResolution>;
    resolveAffiliateLinkField: (input: LinkFieldProcessingInput) => Promise<{
        href: string;
        displayUrl: string;
        decision: LinkProcessingPluginDecision;
    }>;
}
