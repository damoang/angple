import type { SiteContext, SiteResolver } from './index.js';

export class CompositeSiteResolver implements SiteResolver {
    constructor(private readonly resolvers: SiteResolver[]) {}

    async resolve(host: string): Promise<SiteContext | null> {
        for (const r of this.resolvers) {
            const ctx = await r.resolve(host);
            if (ctx) return ctx;
        }
        return null;
    }
}
