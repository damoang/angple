export type AffiliateSource =
    | 'post_body'
    | 'comment_body'
    | 'post_link1'
    | 'post_link2'
    | 'comment_link1'
    | 'comment_link2';

export type AffiliateDecisionStatus =
    | 'converted'
    | 'passthrough'
    | 'unsupported'
    | 'denied'
    | 'error';

export type AffiliateReasonCode =
    | 'converted'
    | 'unsupported_domain'
    | 'already_affiliate'
    | 'invalid_url'
    | 'env_missing'
    | 'merchant_denied'
    | 'api_error'
    | 'unknown';

export type AffiliateNetwork =
    | 'linkprice'
    | 'aliexpress'
    | 'coupang'
    | 'amazon'
    | 'kkday'
    | 'none';

export type LinkFieldName = 'link1' | 'link2';

export interface AffiliateCandidate {
    originalUrl: string;
    normalizedUrl: string;
    source: AffiliateSource;
    boardId?: string;
    postId?: number;
    commentId?: number;
    linkField?: LinkFieldName;
}

export interface AffiliateDecision {
    status: AffiliateDecisionStatus;
    reasonCode: AffiliateReasonCode;
    network: AffiliateNetwork;
    originalUrl: string;
    normalizedUrl: string;
    affiliateUrl?: string;
    redirectUrl?: string;
    redirectId?: string;
    metadata?: Record<string, string | number | boolean | null>;
}

export interface AffiliateContentContext {
    boardId?: string;
    postId?: number;
    commentId?: number;
    source: Extract<AffiliateSource, 'post_body' | 'comment_body'>;
}

export interface AffiliateContentResolution {
    content: string;
    decisions: AffiliateDecision[];
    summary: {
        total: number;
        converted: number;
        unsupported: number;
        denied: number;
        error: number;
        passthrough: number;
    };
}

export interface AffiliateLinkFieldInput {
    url: string;
    boardId?: string;
    postId?: number;
    commentId?: number;
    source: Extract<
        AffiliateSource,
        'post_link1' | 'post_link2' | 'comment_link1' | 'comment_link2'
    >;
    field: LinkFieldName;
}

export interface AffiliateLinkFieldOutput {
    href: string;
    displayUrl: string;
    decision: AffiliateDecision;
}
