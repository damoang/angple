export type LinkProcessingSource =
    | 'post_body'
    | 'comment_body'
    | 'post_link1'
    | 'post_link2'
    | 'comment_link1'
    | 'comment_link2';

export type LinkProcessingOutcome =
    | 'transformed'
    | 'passthrough'
    | 'unsupported'
    | 'blocked'
    | 'failed';

export interface LinkProcessingResult {
    outcome: LinkProcessingOutcome;
    code: string;
    provider: string | null;
    inputUrl: string;
    normalizedUrl: string;
    targetUrl?: string;
    redirectUrl?: string;
    redirectId?: string;
    meta?: Record<string, string | number | boolean | null>;
}

export interface LinkProcessingContentSummary {
    total: number;
    transformed: number;
    unsupported: number;
    blocked: number;
    failed: number;
    passthrough: number;
}

export interface LinkProcessingContentResolution {
    content: string;
    results: LinkProcessingResult[];
    summary: LinkProcessingContentSummary;
}

export interface LinkFieldProcessingInput {
    url: string;
    boardId?: string;
    postId?: number;
    commentId?: number;
    source: Extract<
        LinkProcessingSource,
        'post_link1' | 'post_link2' | 'comment_link1' | 'comment_link2'
    >;
    field: 'link1' | 'link2';
}

export interface LinkFieldProcessingOutput {
    href: string;
    displayUrl: string;
    result: LinkProcessingResult;
}
