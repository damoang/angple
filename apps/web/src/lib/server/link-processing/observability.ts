import type {
    LinkProcessingContentResolution,
    LinkProcessingResult,
    LinkProcessingSource
} from './types';

interface ResultContext {
    source: LinkProcessingSource;
    boardId?: string;
    postId?: number;
    commentId?: number;
    field?: 'link1' | 'link2';
}

export function logLinkProcessingResult(
    result: LinkProcessingResult,
    context: ResultContext
): void {
    if (result.outcome === 'transformed') {
        console.info('[LinkProcessing] transformed', {
            source: context.source,
            boardId: context.boardId,
            postId: context.postId,
            commentId: context.commentId,
            field: context.field,
            provider: result.provider,
            code: result.code,
            redirectId: result.redirectId || null
        });
        return;
    }

    if (result.outcome === 'unsupported' || result.outcome === 'passthrough') {
        return;
    }

    console.warn('[LinkProcessing] non-transformed', {
        source: context.source,
        boardId: context.boardId,
        postId: context.postId,
        commentId: context.commentId,
        field: context.field,
        outcome: result.outcome,
        code: result.code,
        provider: result.provider,
        inputUrl: result.inputUrl
    });
}

export function logLinkProcessingContentResolution(
    resolution: LinkProcessingContentResolution,
    context: Omit<ResultContext, 'field'>
): void {
    if (resolution.summary.total === 0) {
        return;
    }

    console.info('[LinkProcessing] content-summary', {
        source: context.source,
        boardId: context.boardId,
        postId: context.postId,
        commentId: context.commentId,
        total: resolution.summary.total,
        transformed: resolution.summary.transformed,
        unsupported: resolution.summary.unsupported,
        blocked: resolution.summary.blocked,
        failed: resolution.summary.failed,
        passthrough: resolution.summary.passthrough
    });

    for (const result of resolution.results) {
        if (result.outcome === 'blocked' || result.outcome === 'failed') {
            console.warn('[LinkProcessing] content-non-transformed', {
                source: context.source,
                boardId: context.boardId,
                postId: context.postId,
                commentId: context.commentId,
                outcome: result.outcome,
                code: result.code,
                provider: result.provider,
                inputUrl: result.inputUrl
            });
        }
    }
}
