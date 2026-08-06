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

# 회원 전용 운영 게시판 — 소명·신고누적·이용제한 기록 (bug/13348)
Disallow: /claim
Disallow: /truthroom
Disallow: /disciplinelog

# 외부 링크 추적
Disallow: /go/
Disallow: /link/

# 레거시 PHP 경로 (마이그레이션 대상)
Disallow: /bbs/link.php
Disallow: /plugin/

# ⛔ 깊은 페이지네이션 — 2026-07-30 장애 원인
#
#    구글봇(66.249.92.x)이 CloudFront 를 거쳐 ?page=17000~21000 대를 계속 긁고 있었다.
#    실측: 전체 요청 165,252 중 page>=1000 이 31,871건(**19%**), 그중 502/504 가 62건.
#
#    ?page=17510 은 오프셋 약 52만이다. MySQL 이 52만 행을 읽고 버리는 동안 결과 처리에서
#    힙이 순간 폭증해 V8 상한(--max-old-space-size=520)을 넘고 죽었다:
#      FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
#    평상시 heapUsed 는 181~229MB 로 멀쩡해서 60초 간격 heap_metrics 에는 안 잡혔다.
#    → 느린 누수가 아니라 **버스트 할당**이다. 7/25·7/28 OOM 도 같은 원인 의심.
#
#    색인 손실은 없다 — 글은 sitemap.xml 로 이미 노출하고 있고, 깊은 목록 페이지는
#    검색 가치가 없다. 오히려 크롤 예산을 본문으로 돌리는 효과가 있다.
#
# ⛔ 이것만으로는 반쪽이다. robots.txt 는 **협조 요청**이라 무시하는 크롤러엔 안 통한다.
#    앱에서 페이지 상한을 걸어 오프셋 쿼리 자체를 막는 것이 근본이다(별건 PR).
Disallow: /*?page=
Disallow: /*&page=

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
