import type { AffiliateLinkFieldOutput } from '../lib/types';

export default async function postLinkFieldFilter(
    url: string,
    _context: unknown
): Promise<AffiliateLinkFieldOutput> {
    return {
        href: url,
        displayUrl: url,
        decision: {
            status: 'passthrough',
            reasonCode: 'unknown',
            network: 'none',
            originalUrl: url,
            normalizedUrl: url
        }
    };
}
