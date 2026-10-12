/**
 * 앙티티 작품 관리 — 서버·관리자 화면 공용 상수 (서버 의존 없음).
 */

/** 작품 종류 (기존 작품의 type 값 포함) */
export const ENTITY_TYPES = [
    'movie',
    'drama',
    'variety',
    'documentary',
    'animation',
    'webtoon',
    'comic',
    'novel',
    'book',
    'game',
    'show',
    'exhibition'
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export const ENTITY_TYPE_LABELS: Readonly<Record<EntityType, string>> = {
    movie: '영화',
    drama: '드라마',
    variety: '예능',
    documentary: '다큐',
    animation: '애니',
    webtoon: '웹툰',
    comic: '만화',
    novel: '소설',
    book: '책',
    game: '게임',
    show: '공연',
    exhibition: '전시'
};

/**
 * 자동 연결 문맥어 기본값 — 사람이 손으로 고른 기존 작품(「호프」 계열)의 목록에서
 * 작품 고유어(감독·배우 이름)를 뺀 공통 부분이다.
 *
 * 문맥어가 있으면 자유게시판 글 제목에 이 중 하나가 함께 있어야 자동 연결된다.
 * 작품명이 일반어와 겹칠수록(「호프」=생맥주집) 반드시 넣는다.
 */
export const DEFAULT_CONTEXT_TERMS: Readonly<Record<'movie' | 'drama', readonly string[]>> = {
    movie: [
        '영화',
        '관람',
        '후기',
        '감상',
        '소감',
        '스포',
        '극장',
        '개봉',
        '시사회',
        '예고편',
        '보러',
        '봤',
        '보고',
        '쿠키',
        '4dx',
        '아이맥스',
        'imax',
        '돌비',
        '관객',
        '재밌',
        '재미',
        '결말',
        '해석',
        '평점',
        '리뷰',
        '상영',
        'cgv',
        '씨네'
    ],
    drama: [
        '넷플',
        '드라마',
        '후기',
        '감상',
        '스포',
        '봤',
        '보는',
        '보고',
        '시즌',
        '정주행',
        '재밌',
        '재미',
        '결말',
        '해석',
        '리뷰',
        '몰아',
        '화까지'
    ]
};

/** 종류에 맞는 문맥어 기본값 (영화 외에는 드라마 목록) */
export function defaultContextTerms(type: string): readonly string[] {
    return type === 'movie' ? DEFAULT_CONTEXT_TERMS.movie : DEFAULT_CONTEXT_TERMS.drama;
}

/** TMDB 포스터 주소인지 — 작품 페이지의 출처 표기(TMDB 이용 약관) 판단용 */
export function isTmdbImageUrl(url: string | null | undefined): boolean {
    return typeof url === 'string' && url.startsWith('https://image.tmdb.org/');
}
