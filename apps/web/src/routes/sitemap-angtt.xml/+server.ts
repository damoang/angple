import type { RequestHandler } from './$types';
import { listShelfEntities } from '$plugins/angtt-review/lib/entities.server';
import { match as isEntitySlug } from '../../params/entityslug';

/**
 * 앙티티 작품 페이지(/angtt/{slug}) Sitemap
 *
 * 대상: 활성 작품 중 실제 회원 활동(별점 1개 이상 또는 review/mention 연결 글)이 있는 것만.
 * ⛔ 별점·글이 없는 빈 작품 페이지는 색인 대상에 넣지 않는다.
 * ⛔ /angtt/{숫자}(게시판 글)·/angtt/write 등을 가리는 slug 는 entityslug 매처로 거른다.
 *
 * 조회 실패 시 빈 urlset 을 돌려준다(다른 sitemap 라우트와 같은 관례).
 */
const MAX_ENTITIES = 5000;

function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export const GET: RequestHandler = async ({ url }) => {
    const siteUrl = url.origin.replace('http://', 'https://');

    let urlsXml = '';
    try {
        const entities = await listShelfEntities({ limit: MAX_ENTITIES });
        urlsXml = entities
            .filter((e) => isEntitySlug(e.slug))
            .map((e) => {
                const loc = escapeXml(`${siteUrl}/angtt/${encodeURIComponent(e.slug)}`);
                const lastmod = /^\d{4}-\d{2}-\d{2}$/.test(e.updatedAt)
                    ? `\n    <lastmod>${e.updatedAt}</lastmod>`
                    : '';
                return `  <url>
    <loc>${loc}</loc>${lastmod}
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
            })
            .join('\n');
    } catch (err) {
        console.error('[Sitemap Angtt] 작품 조회 실패:', err);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>`;

    return new Response(xml, {
        headers: {
            'Content-Type': 'application/xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600' // 1시간 캐시
        }
    });
};
