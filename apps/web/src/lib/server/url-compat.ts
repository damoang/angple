/**
 * 그누보드 URL 호환 리다이렉트
 *
 * 그누보드 URL 패턴을 Angple URL로 301 리다이렉트하여
 * 검색엔진 색인(SEO)을 보존합니다.
 *
 * 주요 매핑:
 * - /bbs/board.php?bo_table=free → /free
 * - /bbs/board.php?bo_table=free&wr_id=123 → /free/123
 * - /bbs/write.php?bo_table=free → /free/write
 * - /bbs/login.php → /login
 * - /bbs/register.php → /register
 * - /bbs/member_confirm.php → /my/settings
 * - /bbs/profile.php?mb_id=user1 → /members/user1
 */

/**
 * 그누보드 URL을 Angple URL로 변환
 *
 * @returns 리다이렉트 대상 URL 또는 null (매핑 없음)
 */
export function mapGnuboardUrl(pathname: string, searchParams: URLSearchParams): string | null {
    // /bbs/board.php → 게시판/게시글
    if (pathname === '/bbs/board.php') {
        const boTable = searchParams.get('bo_table');
        const wrId = searchParams.get('wr_id');
        const page = searchParams.get('page');

        if (!boTable) return null;

        if (wrId) {
            return `/${boTable}/${wrId}`;
        }

        if (page && page !== '1') {
            return `/${boTable}?page=${page}`;
        }

        return `/${boTable}`;
    }

    // /bbs/write.php → 게시글 작성
    if (pathname === '/bbs/write.php') {
        const boTable = searchParams.get('bo_table');
        if (boTable) {
            const wrId = searchParams.get('wr_id');
            if (wrId) {
                return `/${boTable}/${wrId}/edit`;
            }
            return `/${boTable}/write`;
        }
        return null;
    }

    // /bbs/login.php → 로그인
    if (pathname === '/bbs/login.php') {
        return '/login';
    }

    // /bbs/register.php → 회원가입
    if (pathname === '/bbs/register.php') {
        return '/register';
    }

    // /bbs/member_confirm.php → 마이페이지
    if (pathname === '/bbs/member_confirm.php') {
        return '/my/settings';
    }

    // /bbs/profile.php → 회원 프로필
    if (pathname === '/bbs/profile.php') {
        const mbId = searchParams.get('mb_id');
        if (mbId) {
            return `/members/${mbId}`;
        }
        return null;
    }

    // /bbs/search.php → 검색
    if (pathname === '/bbs/search.php') {
        const query = searchParams.get('stx') || searchParams.get('sfl') || '';
        if (query) {
            return `/search?q=${encodeURIComponent(query)}`;
        }
        return '/search';
    }

    // /bbs/content.php → 콘텐츠 페이지
    if (pathname === '/bbs/content.php') {
        const co = searchParams.get('co_id');
        if (co) {
            return `/pages/${co}`;
        }
        return null;
    }

    // /bbs/faq.php → FAQ
    if (pathname === '/bbs/faq.php') {
        return '/faq';
    }

    // /bbs/qa_write.php → QA 작성
    if (pathname === '/bbs/qa_write.php') {
        return '/qa/write';
    }

    return null;
}

/**
 * 라이믹스 URL 호환 리다이렉트 (기본 패턴)
 *
 * 라이믹스 기본 URL은 /mid 형태로 Angple과 동일하므로
 * document_srl 기반 URL만 변환합니다.
 *
 * - /index.php?mid=board&document_srl=123 → /board/123
 * - /board/123 → 이미 호환
 */
export function mapRhymixUrl(pathname: string, searchParams: URLSearchParams): string | null {
    if (pathname === '/index.php' || pathname === '/') {
        const mid = searchParams.get('mid');
        const documentSrl = searchParams.get('document_srl');

        if (mid && documentSrl) {
            return `/${mid}/${documentSrl}`;
        }
        if (mid) {
            return `/${mid}`;
        }
    }

    return null;
}
