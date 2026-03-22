export type {
    AffiliateCandidate,
    AffiliateDecision,
    AffiliateDecisionStatus,
    AffiliateReasonCode,
    AffiliateSource,
    LinkFieldName,
    AffiliateContentContext,
    AffiliateContentResolution,
    AffiliateLinkFieldInput,
    AffiliateLinkFieldOutput
} from './lib/types';

export {
    resolveAffiliateCandidate,
    resolveAffiliateContent,
    resolveAffiliateContentDetailed,
    resolveAffiliateLinkField
} from './lib/resolver.server';

export {
    buildAffiliateRedirectRecord,
    resolveAffiliateRedirectRecord
} from './lib/redirect-store.server';

export { default as postContentFilter } from './hooks/post-content-filter';
export { default as commentContentFilter } from './hooks/comment-content-filter';
export { default as postLinkFieldFilter } from './hooks/post-link-field-filter';
export { default as commentLinkFieldFilter } from './hooks/comment-link-field-filter';
