import { describe, it, expect } from 'vitest';
import {
    appendSourcePost,
    baseSlug,
    extractTitleCandidate,
    findMatchingEntity,
    matchKeys,
    newCandidateMeta,
    parseNameList,
    slugError,
    uniqueSlug,
    type MatchableEntity
} from './angtt-candidate-logic';

/**
 * 실제 앙티티 원글 제목(카테고리, 제목) → 기대 후보.
 * null = 후보를 만들지 않는다.
 */
const REAL_TITLES: {
    ca: string;
    subject: string;
    expected: { title: string; aliases?: string[]; seasons?: number[]; type: string } | null;
    note?: string;
}[] = [
    {
        ca: '영화',
        subject: '영화 "호프(HOPE)" 감상후기..',
        expected: { title: '호프', aliases: ['호프', 'HOPE'], type: 'movie' }
    },
    {
        ca: '영화',
        subject: '영화 "모아나 실사판" 감상후기..',
        expected: { title: '모아나 실사판', type: 'movie' },
        note: '「실사판」 은 작품명 일부로 둔다 — 애니판과 구분은 관리자가 한다'
    },
    {
        ca: '영화',
        subject: '영화 "양탐정 릴리" 감상후기..',
        expected: { title: '양탐정 릴리', type: 'movie' }
    },
    {
        ca: '영화',
        subject: '영화 호프(HOPE) 후기 - 영화 안보셨으면 절대 클릭마세요',
        expected: { title: '호프', aliases: ['호프', 'HOPE'], type: 'movie' },
        note: '따옴표가 없으면 「후기」 앞까지가 작품명'
    },
    {
        ca: 'NETFLIX',
        subject: '예능 "모태솔로지만 연애는 하고 싶어 시즌2" 감상후기..',
        expected: { title: '모태솔로지만 연애는 하고 싶어', seasons: [2], type: 'variety' },
        note: '접두 「예능」 이 카테고리(NETFLIX→drama)보다 우선'
    },
    {
        ca: 'NETFLIX',
        subject: '더 루키',
        expected: { title: '더 루키', type: 'drama' }
    },
    {
        ca: '영화',
        subject: '스파이더맨 - 브랜드뉴데이',
        expected: { title: '스파이더맨 - 브랜드뉴데이', type: 'movie' },
        note: '양쪽 다 한글인 「-」 는 한 제목 — 기존 작품 slug 와는 matchKeys 가 맞춘다'
    },
    {
        ca: '영화',
        subject: '영화 "오딧세이" 감상후기..(스포 없음)',
        expected: { title: '오딧세이', type: 'movie' }
    },
    {
        ca: '음악',
        subject: '리센느 Busy Boy에서 이래서  브아걸 L.O.V.E의 Deja Vu가 느껴진건가?',
        expected: null,
        note: '음악 카테고리 제외'
    },
    {
        ca: '영화',
        subject: '스파이더맨4? 브랜뉴데이',
        expected: null,
        note: '물음표가 남는 제목은 잡담·질문으로 보고 후보를 만들지 않는다'
    },
    {
        ca: 'NETFLIX',
        subject: '드라마 "동궁" 감상완료 후기..',
        expected: { title: '동궁', type: 'drama' }
    },
    {
        ca: '게임',
        subject: '프리스타일 이라는 농구게임이 있습니다',
        expected: null,
        note: '게임 카테고리 제외'
    },
    {
        ca: 'NETFLIX',
        subject: '드라마 "더 실버타운(The boroughs)" 감상완료 후기',
        expected: { title: '더 실버타운', aliases: ['더 실버타운', 'The boroughs'], type: 'drama' }
    },
    {
        ca: 'APPLE_TV',
        subject: '드라마 "럭키(LUCKY))" 감상완료 후기..',
        expected: { title: '럭키', aliases: ['럭키', 'LUCKY'], type: 'drama' },
        note: '짝 안 맞는 닫는 괄호는 버린다'
    },
    { ca: '영화', subject: '헤로니모', expected: { title: '헤로니모', type: 'movie' } },
    { ca: '영화', subject: '가네코 후미코', expected: { title: '가네코 후미코', type: 'movie' } },
    {
        ca: '영화',
        subject: '영화 "콰이어트 플레이스 1,2" 감상후기..',
        expected: { title: '콰이어트 플레이스', type: 'movie' },
        note: '편 번호 나열(1,2)은 시리즈명으로 묶는다'
    },
    {
        ca: '영화',
        subject: '영화 "더 울프 오브 월 스트리트(2014)" 감상후기..',
        expected: {
            title: '더 울프 오브 월 스트리트',
            aliases: ['더 울프 오브 월 스트리트'],
            type: 'movie'
        }
    },
    {
        ca: 'APPLE_TV',
        subject: '영화 "메이데이(MAYDAY)" 감상후기..',
        expected: { title: '메이데이', aliases: ['메이데이', 'MAYDAY'], type: 'movie' },
        note: '접두 「영화」 가 카테고리(APPLE_TV→drama)보다 우선'
    },
    { ca: '영화', subject: '박하사탕', expected: { title: '박하사탕', type: 'movie' } },
    {
        ca: '드라마',
        subject: '미드 "리처 시즌4" 감상완료 후기..',
        expected: { title: '리처', seasons: [4], type: 'drama' }
    },
    {
        ca: '영화',
        subject: '라자레스쿠씨의 죽음 - The Death of Mr. Lazarescu',
        expected: {
            title: '라자레스쿠씨의 죽음',
            aliases: ['라자레스쿠씨의 죽음', 'The Death of Mr. Lazarescu'],
            type: 'movie'
        },
        note: '「한글 - English」 는 영문 쪽을 원제 별칭으로'
    },
    {
        ca: '영화',
        subject: '영화 "족구왕(2014)" 감상후기..',
        expected: { title: '족구왕', aliases: ['족구왕'], type: 'movie' }
    },
    {
        ca: 'APPLE_TV',
        subject: '드라마 "지하창고 사일로의 비밀(SILO) 시즌1" 감상후기..',
        expected: {
            title: '지하창고 사일로의 비밀',
            aliases: ['지하창고 사일로의 비밀', 'SILO'],
            seasons: [1],
            type: 'drama'
        }
    },
    {
        ca: '영화',
        subject: '소년시절의 너 <Better Days>',
        expected: {
            title: '소년시절의 너',
            aliases: ['소년시절의 너', 'Better Days'],
            type: 'movie'
        },
        note: '< > 는 따옴표가 아니라 원제 병기'
    },
    {
        ca: '다큐',
        subject: '영화 암살자들 후기. 육영수 여사 피격사건의 범인은 경호실장',
        expected: { title: '암살자들', type: 'movie' },
        note: '「후기」 뒤 본문 요약은 버린다. 접두 「영화」 가 카테고리(다큐)보다 우선'
    },
    {
        ca: '영화',
        subject: '룩백 (2026,영화)',
        expected: { title: '룩백', aliases: ['룩백'], type: 'movie' }
    },
    {
        ca: 'APPLE_TV',
        subject: '드라마 "지하창고 사일로의 비밀(SILO) 시즌2" 감상후기..',
        expected: {
            title: '지하창고 사일로의 비밀',
            aliases: ['지하창고 사일로의 비밀', 'SILO'],
            seasons: [2],
            type: 'drama'
        }
    }
];

describe('extractTitleCandidate — 실제 앙티티 제목 표', () => {
    for (const row of REAL_TITLES) {
        it(`[${row.ca}] ${row.subject}${row.note ? ` — ${row.note}` : ''}`, () => {
            const got = extractTitleCandidate(row.subject, row.ca);
            if (row.expected === null) {
                expect(got).toBeNull();
                return;
            }
            expect(got).not.toBeNull();
            expect(got?.title).toBe(row.expected.title);
            expect(got?.type).toBe(row.expected.type);
            expect(got?.seasons).toEqual(row.expected.seasons ?? []);
            expect(got?.aliases).toEqual(row.expected.aliases ?? [row.expected.title]);
        });
    }
});

describe('extractTitleCandidate — 규칙', () => {
    it('음악·게임·공지 카테고리는 접두가 있어도 후보를 만들지 않는다', () => {
        expect(extractTitleCandidate('영화 "라라랜드" OST', '음악')).toBeNull();
        expect(extractTitleCandidate('애니 "원신"', '게임')).toBeNull();
        expect(extractTitleCandidate('앙티티 이용 안내', '공지')).toBeNull();
    });

    it('종류를 판단할 수 없는 카테고리(소설·책 등)는 접두가 없으면 null', () => {
        expect(extractTitleCandidate('채식주의자', '소설')).toBeNull();
        expect(extractTitleCandidate('채식주의자', '')).toBeNull();
        expect(extractTitleCandidate('채식주의자', null)).toBeNull();
    });

    it('카테고리를 판단할 수 없어도 제목 접두가 있으면 그 종류로', () => {
        expect(extractTitleCandidate('애니 "룩백" 후기', '만화')?.type).toBe('animation');
        expect(extractTitleCandidate('다큐 "어느 가족"', '')?.type).toBe('documentary');
    });

    it('「영화관」 처럼 접두어로 시작하는 단어는 접두로 보지 않는다', () => {
        const got = extractTitleCandidate('영화관에서 생긴 일', '영화');
        expect(got?.title).toBe('영화관에서 생긴 일');
    });

    it('[영화] 괄호 접두도 뗀다', () => {
        expect(extractTitleCandidate('[영화] 파묘 후기', '')?.title).toBe('파묘');
    });

    it('겹낫표·꺾쇠 따옴표도 작품명으로 읽는다', () => {
        expect(extractTitleCandidate('「파묘」 보고 왔습니다', '영화')?.title).toBe('파묘');
        expect(extractTitleCandidate('《서울의 봄》 후기', '영화')?.title).toBe('서울의 봄');
    });

    it('한글 괄호 병기(주석)는 별칭으로 넣지 않는다', () => {
        const got = extractTitleCandidate('영화 "슬램덩크(극장판)" 후기', '영화');
        expect(got?.title).toBe('슬램덩크');
        expect(got?.aliases).toEqual(['슬램덩크']);
    });

    it('한자 병기는 별칭으로 넣는다', () => {
        expect(extractTitleCandidate('드라마 "동궁(東宮)" 후기', '드라마')?.aliases).toEqual([
            '동궁',
            '東宮'
        ]);
    });

    it('40자를 넘는 문장은 작품명으로 보지 않는다', () => {
        const long =
            '오늘 아침에 일어나서 커피를 마시고 출근길에 생각난 옛날 영화 이야기를 조금 해보려 합니다';
        expect(extractTitleCandidate(long, '영화')).toBeNull();
    });

    it('2글자 미만은 후보가 아니다 (「듄」 같은 한 글자 작품은 관리자가 수동 등록)', () => {
        expect(extractTitleCandidate('영화 "M" 후기', '영화')).toBeNull();
        expect(extractTitleCandidate('', '영화')).toBeNull();
        expect(extractTitleCandidate('듄 (Dune : Part One / 2021)', '영화')).toBeNull();
    });
});

/** 오래된 앙티티 글의 자유 형식 제목 (백필 대상) — 기대값: [카테고리, 제목, 작품명, 별칭(작품명 제외), 시즌] */
const LEGACY_TITLES: [string, string, string, string[], number[]][] = [
    [
        '영화',
        '[스포없음] 맨 프롬 어스 (Man from earth. 2007)',
        '맨 프롬 어스',
        ['Man from earth'],
        []
    ],
    ['영화', '전지적 독자 시점(전독시) 간단 후기', '전지적 독자 시점', [], []],
    ['영화', '쏘우 (Saw) [2004]', '쏘우', ['Saw'], []],
    ['영화', '코코 2017', '코코', [], []],
    ['APPLE_TV', 'BAD SISTERS  (배드 시스터즈)', '배드 시스터즈', ['BAD SISTERS'], []],
    ['영화', '트루먼 쇼 - The Truman Show. 1998', '트루먼 쇼', ['The Truman Show'], []],
    ['드라마', '24시 (2001~2010)', '24시', [], []],
    ['영화', '알리타: 배틀 엔젤 (2019) 스포무', '알리타: 배틀 엔젤', [], []],
    ['영화', '파일럿 2024. 스포무', '파일럿', [], []],
    ['드라마', '덱스터(시즌 1~8 & New Blood, 2006~2021년, 스포 무)', '덱스터', [], []],
    ['영화', '세기말의 사랑 / 2024', '세기말의 사랑', [], []],
    ['영화', '하이제킹 노스포 리뷰', '하이제킹', [], []],
    ['영화', '2012 (2009 스포유)', '2012', [], []],
    ['영화', '영화 "엔트랩먼트 (ENTRAPMENT), 1999" 재감상후기..', '엔트랩먼트', ['ENTRAPMENT'], []],
    ['드라마', '나의 아저씨 (2018년)', '나의 아저씨', [], []],
    [
        '영화',
        'Mission : Impossible (미션 임파서블) [1996]',
        '미션 임파서블',
        ['Mission : Impossible'],
        []
    ],
    ['영화', '오버 더 레인 보우 2002 스포일러 유', '오버 더 레인 보우', [], []],
    ['드라마', '돌풍/2024/스포무/비추천/그냥 보지마세요', '돌풍', [], []],
    ['영화', '용쟁호투 Enter the Dragon (1973)', '용쟁호투', ['Enter the Dragon'], []],
    ['드라마', '비밀은 없어(2024) 1화-10화 / 스포무', '비밀은 없어', [], []],
    ['APPLE_TV', 'For All Mankind / 포 올 맨카인드', '포 올 맨카인드', ['For All Mankind'], []],
    [
        '영화',
        'A Most Wanted Man 모스트 원티드 맨 2014',
        '모스트 원티드 맨',
        ['A Most Wanted Man'],
        []
    ],
    ['영화', 'Transformers ONE / 트랜스포머 ONE', 'Transformers ONE', [], []],
    ['드라마', '[AMAZON] 리처 드라마시리즈 1,2시즌', '리처 드라마시리즈', [], [1, 2]],
    ['영화', '스포트라이트', '스포트라이트', [], []],
    [
        '영화',
        '라비린스 (Labyrinth, 1986) /데이빗 보위, 제니퍼 코넬리/스포무',
        '라비린스',
        ['Labyrinth'],
        []
    ],
    ['NETFLIX', '베터 콜 사울 Better Call Saul', '베터 콜 사울', ['Better Call Saul'], []],
    ['영화', 'The Hurt Locker 2008', 'The Hurt Locker', [], []]
];

describe('extractTitleCandidate — 자유 형식 옛 제목 (스포 표기·연도·원제 병기)', () => {
    for (const [ca, subject, title, aliases, seasons] of LEGACY_TITLES) {
        it(`[${ca}] ${subject}`, () => {
            const got = extractTitleCandidate(subject, ca);
            expect(got?.title).toBe(title);
            expect(got?.aliases).toEqual([title, ...aliases]);
            expect(got?.seasons).toEqual(seasons);
        });
    }

    it('⛔ 「스포트라이트」 의 「스포」 는 스포 표기가 아니다', () => {
        expect(extractTitleCandidate('스포트라이트 후기', '영화')?.title).toBe('스포트라이트');
    });

    it('글자 없는 괄호 병기(「?」)는 별칭이 아니다', () => {
        expect(
            extractTitleCandidate('만달로리안과 그로구 - 성장하는 부자(?) 관계', '영화')?.aliases
        ).toEqual(['만달로리안과 그로구 - 성장하는 부자 관계']);
    });

    it('연도를 떼면 남는 게 없는 제목(영화 「2012」)은 연도를 남긴다', () => {
        expect(extractTitleCandidate('2012', '영화')?.title).toBe('2012');
    });
});

describe('slug', () => {
    it('공백은 하이픈, 문장부호는 제거, 소문자', () => {
        expect(baseSlug('스파이더맨: 브랜드 뉴 데이')).toBe('스파이더맨-브랜드-뉴-데이');
        expect(baseSlug('The Boroughs')).toBe('the-boroughs');
        expect(baseSlug('족구왕')).toBe('족구왕');
    });

    it('⛔ 순수 숫자 slug 금지 — /angtt/{wr_id} 와 겹친다', () => {
        expect(baseSlug('1987')).toBe('1987-작품');
        expect(baseSlug('1917')).not.toMatch(/^\d+$/);
    });

    it('예약된 하위 경로(write 등)는 접미를 붙인다', () => {
        expect(baseSlug('Write')).toBe('write-작품');
    });

    it('충돌하면 -2, -3 을 붙인다 (대소문자 무시)', () => {
        expect(uniqueSlug('호프', new Set(['호프']))).toBe('호프-2');
        expect(uniqueSlug('호프', new Set(['호프', '호프-2']))).toBe('호프-3');
        expect(uniqueSlug('Hope', new Set(['hope']))).toBe('hope-2');
        expect(uniqueSlug('1987', new Set(['1987-작품']))).toBe('1987-작품-2');
    });

    it('만들 수 없으면 null', () => {
        expect(uniqueSlug('!!!', new Set())).toBeNull();
    });

    it('관리자 입력 slug 검증', () => {
        expect(slugError('스파이더맨-브랜드뉴데이')).toBeNull();
        expect(slugError('7297')).not.toBeNull();
        expect(slugError('write')).not.toBeNull();
        expect(slugError('a/b')).not.toBeNull();
        expect(slugError('')).not.toBeNull();
    });
});

describe('findMatchingEntity — 중복·시즌 묶기·거절 재생성 방지', () => {
    const entities: MatchableEntity[] = [
        {
            id: 1,
            slug: '호프',
            status: 'active',
            canonicalTitle: '호프',
            aliases: ['호프', 'HOPE', 'Hope']
        },
        {
            id: 4,
            slug: '스파이더맨-브랜드뉴데이',
            status: 'active',
            canonicalTitle: '스파이더맨: 브랜드 뉴 데이',
            aliases: ['스파이더맨', '브랜드 뉴 데이']
        },
        {
            id: 5,
            slug: '오디세이',
            status: 'active',
            canonicalTitle: '오디세이',
            aliases: ['오디세이', '오딧세이']
        },
        {
            id: 10,
            slug: '지하창고-사일로의-비밀',
            status: 'pending',
            canonicalTitle: '지하창고 사일로의 비밀',
            aliases: ['지하창고 사일로의 비밀', 'SILO']
        },
        {
            id: 11,
            slug: '모아나-실사판',
            status: 'rejected',
            canonicalTitle: '모아나 실사판',
            aliases: ['모아나 실사판']
        },
        {
            id: 12,
            slug: '옛-이름',
            status: 'merged',
            canonicalTitle: '럭키',
            aliases: ['럭키']
        }
    ];

    const pick = (subject: string, ca: string) => {
        const c = extractTitleCandidate(subject, ca);
        return c ? findMatchingEntity(c.aliases, entities) : null;
    };

    it('별칭(오딧세이)으로 기존 active 작품에 붙는다', () => {
        expect(pick('영화 "오딧세이" 감상후기..(스포 없음)', '영화')?.id).toBe(5);
    });

    it('「스파이더맨 - 브랜드뉴데이」 는 slug 로 기존 작품에 붙는다', () => {
        expect(pick('스파이더맨 - 브랜드뉴데이', '영화')?.id).toBe(4);
    });

    it('시즌2 글은 시즌1 로 만든 pending 후보에 묶인다', () => {
        expect(pick('드라마 "지하창고 사일로의 비밀(SILO) 시즌2" 감상후기..', 'APPLE_TV')?.id).toBe(
            10
        );
    });

    it('거절된 작품과 같은 제목이면 거절 작품을 돌려준다(호출부가 새로 만들지 않는다)', () => {
        expect(pick('영화 "모아나 실사판" 감상후기..', '영화')?.status).toBe('rejected');
    });

    it('merged 작품은 매칭 대상이 아니다', () => {
        expect(pick('드라마 "럭키(LUCKY))" 감상완료 후기..', 'APPLE_TV')).toBeNull();
    });

    it('active 와 pending 이 함께 걸리면 active 우선', () => {
        const list: MatchableEntity[] = [
            { id: 20, slug: 'x', status: 'pending', canonicalTitle: '파묘', aliases: [] },
            { id: 30, slug: 'y', status: 'active', canonicalTitle: 'Exhuma', aliases: ['파묘'] }
        ];
        expect(findMatchingEntity(['파묘'], list)?.id).toBe(30);
    });

    it('매칭 키는 2글자 미만을 버리고 구분자 공백 제거형을 더한다', () => {
        expect(matchKeys(['A', '스파이더맨 - 브랜드뉴데이'])).toEqual([
            '스파이더맨 - 브랜드뉴데이',
            '스파이더맨-브랜드뉴데이'
        ]);
    });
});

describe('meta 헬퍼', () => {
    it('새 후보 meta 는 source·근거 원글·시즌·카테고리를 담고 auto_link 는 없다', () => {
        const c = extractTitleCandidate(
            '드라마 "지하창고 사일로의 비밀(SILO) 시즌1" 감상후기..',
            'APPLE_TV'
        );
        expect(c).not.toBeNull();
        const meta = newCandidateMeta(c!, [7449], 'APPLE_TV');
        expect(meta).toEqual({
            source: 'angtt_post',
            source_posts: [7449],
            seasons: [1],
            ca_name: 'APPLE_TV'
        });
        expect('auto_link' in meta).toBe(false);
    });

    it('pending 에 근거 원글·시즌을 더한다 (이미 있으면 null)', () => {
        const meta = { source: 'angtt_post', source_posts: [7449], seasons: [1] };
        expect(appendSourcePost(meta, 7471, [2])).toEqual({
            source: 'angtt_post',
            source_posts: [7449, 7471],
            seasons: [1, 2]
        });
        expect(appendSourcePost(meta, 7449, [1])).toBeNull();
        expect(appendSourcePost(JSON.stringify(meta), 7449, [])).toBeNull();
    });

    it('이름 목록 입력: 줄바꿈·쉼표 구분, 정규화 중복 제거', () => {
        expect(parseNameList('호프\nHOPE, hope ,')).toEqual(['호프', 'HOPE']);
        expect(parseNameList(['동궁', '동궁 ', 1])).toEqual(['동궁']);
    });
});
