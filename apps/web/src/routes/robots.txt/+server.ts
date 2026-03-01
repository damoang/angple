import type { RequestHandler } from './$types';

/**
 * 동적 robots.txt 생성
 *
 * SEO 최적화:
 * - 최소한의 차단만 유지 (과도한 차단 제거)
 * - AI 크롤러 차단 (선택적)
 * - Sitemap URL 포함
 */
export const GET: RequestHandler = async ({ url }) => {
    // HTTPS 강제
    const siteUrl = url.origin.replace('http://', 'https://');

    const robotsTxt = `# Angple Community Platform
# https://angple.com

User-agent: *
Allow: /

# Admin & API (비공개)
Disallow: /admin/
Disallow: /api/
Disallow: /install/

# 인증 페이지 (검색 노출 불필요)
Disallow: /login
Disallow: /register/
Disallow: /password-reset/

# 사용자 개인 페이지
Disallow: /member/
Disallow: /messages/
Disallow: /my/

# 외부 링크 추적
Disallow: /go/
Disallow: /link/

# 레거시 PHP 경로 (마이그레이션 대상)
Disallow: /bbs/link.php
Disallow: /plugin/

# AI 크롤러 차단 (콘텐츠 학습 방지)
User-agent: GPTBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: Claude-Web
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: cohere-ai
Disallow: /

# Sitemap
Sitemap: ${siteUrl}/sitemap.xml
`;

    return new Response(robotsTxt, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'public, max-age=86400' // 24시간 캐시
        }
    });
};
