import type { RequestHandler } from './$types';

/**
 * 동적 robots.txt 생성
 * Sitemap URL을 동적으로 포함
 */
export const GET: RequestHandler = async ({ url }) => {
	const siteUrl = url.origin;

	const robotsTxt = `# Angple Community Platform
User-agent: *
Allow: /

Disallow: /admin/
Disallow: /api/
Disallow: /install/
Disallow: /plugin/
Disallow: /register
Disallow: /password-reset/
Disallow: /member/settings/

Sitemap: ${siteUrl}/sitemap.xml
`;

	return new Response(robotsTxt, {
		headers: {
			'Content-Type': 'text/plain',
			'Cache-Control': 'max-age=86400'
		}
	});
};
