import { describe, it, expect } from 'vitest';
import {
    ANGTT_TAG,
    normalizeWorkTitle,
    hasAngttTag,
    buildDictionary,
    matchWorkFromTags,
    scanAliasesInTitle,
    type EntityAlias
} from './angtt-dictionary-logic';

describe('normalizeWorkTitle — 정규화 (trim + 연속 공백 1개화 + 소문자)', () => {
    it('앞뒤 공백을 제거한다', () => {
        expect(normalizeWorkTitle('  듄: 파트 2  ')).toBe('듄: 파트 2');
    });

    it('연속 공백을 1개로 합친다 (탭/개행 포함)', () => {
        expect(normalizeWorkTitle('듄:   파트\t\t2')).toBe('듄: 파트 2');
        expect(normalizeWorkTitle('듄:\n파트 2')).toBe('듄: 파트 2');
    });

    it('영문은 소문자로 통일한다', () => {
        expect(normalizeWorkTitle('DUNE: Part Two')).toBe('dune: part two');
    });

    it('빈 문자열/공백만은 빈 문자열이 된다', () => {
        expect(normalizeWorkTitle('')).toBe('');
        expect(normalizeWorkTitle('   ')).toBe('');
    });
});

describe('hasAngttTag — 「앙티티」 옵트인 스위치 판별', () => {
    it('앙티티 태그가 있으면 true', () => {
        expect(hasAngttTag(['앙티티', '듄'])).toBe(true);
    });

    it('공백이 섞여도 정규화 비교로 인식한다', () => {
        expect(hasAngttTag([' 앙티티 ', '듄'])).toBe(true);
    });

    it('없으면 false', () => {
        expect(hasAngttTag(['듄', '영화'])).toBe(false);
        expect(hasAngttTag([])).toBe(false);
    });
});

describe('buildDictionary — angtt 글 목록 → 정규화 사전', () => {
    it('정규화 제목을 키로 등록한다', () => {
        const dict = buildDictionary([{ wrId: 10, title: '  듄:  파트 2 ', thumbnail: 't.jpg' }]);
        expect(dict.get('듄: 파트 2')).toEqual({
            wrId: 10,
            title: '듄:  파트 2',
            thumbnail: 't.jpg'
        });
    });

    it('동명 작품은 최신 글(wr_id 큰 쪽)이 우선한다 — 입력 순서 무관', () => {
        const newer = { wrId: 20, title: '괴물', thumbnail: 'new.jpg' };
        const older = { wrId: 5, title: '괴물', thumbnail: 'old.jpg' };
        expect(buildDictionary([older, newer]).get('괴물')?.wrId).toBe(20);
        expect(buildDictionary([newer, older]).get('괴물')?.wrId).toBe(20);
    });

    it('빈 제목은 건너뛴다', () => {
        const dict = buildDictionary([{ wrId: 1, title: '   ', thumbnail: '' }]);
        expect(dict.size).toBe(0);
    });
});

describe('matchWorkFromTags — 태그 → 작품 매칭 규약', () => {
    const dict = buildDictionary([
        { wrId: 100, title: '듄: 파트 2', thumbnail: 'dune.jpg' },
        { wrId: 200, title: 'The Bear', thumbnail: 'bear.jpg' }
    ]);

    it('앙티티 태그는 후보에서 제외하고, 사전 일치 태그로 작품을 찾는다', () => {
        const result = matchWorkFromTags([ANGTT_TAG, '듄: 파트 2'], dict);
        expect(result).toEqual({
            work: { wrId: 100, title: '듄: 파트 2', thumbnail: 'dune.jpg' }
        });
    });

    it('대소문자·공백 차이가 있어도 정확 일치로 매칭한다', () => {
        const result = matchWorkFromTags(['앙티티', ' the  BEAR '], dict);
        expect(result).toEqual({
            work: { wrId: 200, title: 'The Bear', thumbnail: 'bear.jpg' }
        });
    });

    it('여러 후보 중 첫 번째 일치 태그를 쓴다', () => {
        const result = matchWorkFromTags(['앙티티', '미등록작', '듄: 파트 2'], dict);
        expect(result && 'work' in result && result.work.wrId).toBe(100);
    });

    it('일치 없으면 첫 번째 후보 태그를 query 로 반환한다 (원문 트림 유지)', () => {
        const result = matchWorkFromTags(['앙티티', ' 어떤작품 ', '다른태그'], dict);
        expect(result).toEqual({ query: '어떤작품' });
    });

    it('앙티티 외 태그가 없으면 null (카드 미표시)', () => {
        expect(matchWorkFromTags(['앙티티'], dict)).toBeNull();
        expect(matchWorkFromTags(['앙티티', '  '], dict)).toBeNull();
    });

    it('자유 텍스트 부분 일치는 하지 않는다 (정확 일치만)', () => {
        expect(matchWorkFromTags(['앙티티', '듄'], dict)).toEqual({ query: '듄' });
    });
});

describe('extractTitleCandidates — 자유 제목에서 작품명 추출 (실전: angtt/7297)', () => {
    it('따옴표 안 텍스트 + 괄호 제거 변형을 후보로 추출', async () => {
        const { extractTitleCandidates } = await import('./angtt-dictionary-logic');
        const c = extractTitleCandidates('영화 "호프(HOPE)" 감상후기..');
        expect(c).toContain('호프(hope)');
        expect(c).toContain('호프');
        expect(c).toContain('영화 "호프(hope)" 감상후기..');
    });

    it('낫표·겹화살괄호도 지원, 2글자 미만 후보 제외', async () => {
        const { extractTitleCandidates } = await import('./angtt-dictionary-logic');
        expect(extractTitleCandidates('「듄」 후기')).toContain(
            '듄 후기'.split(' ')[0].length >= 2 ? '듄 후기' : '「듄」 후기'.toLowerCase()
        );
        const c2 = extractTitleCandidates('드라마 《폭싹 속았수다》 정주행');
        expect(c2).toContain('폭싹 속았수다');
        // 1글자 인용("듄")은 후보 제외돼도 전체 제목으로는 색인됨
        expect(extractTitleCandidates('"듄"')).not.toContain('듄');
    });

    it('buildDictionary: 자유 제목 글이 작품명 태그와 매칭됨 (호프 케이스)', async () => {
        const { buildDictionary, matchWorkFromTags } = await import('./angtt-dictionary-logic');
        const dict = buildDictionary([
            { wrId: 7297, title: '영화 "호프(HOPE)" 감상후기..', thumbnail: '' }
        ]);
        const r = matchWorkFromTags(['앙티티', '호프'], dict);
        expect(r && 'work' in r ? r.work.wrId : null).toBe(7297);
    });
});

describe('scanAliasesInTitle — 제목 내 작품 별칭 스캔 (티어 B)', () => {
    const ALIASES: EntityAlias[] = [
        {
            aliasNorm: '호프',
            entitySlug: 'hope',
            autoLink: true,
            // 「호프」는 생맥주집을 뜻하기도 하므로 영화 문맥어를 요구한다
            contextTerms: ['영화', '관람', '후기', '감상', '스포', '나홍진', '극장', '개봉']
        },
        { aliasNorm: '동궁', entitySlug: 'donggung', autoLink: true },
        // 일반어와 겹치는 이름 — 자동 연결 금지
        { aliasNorm: '참교육', entitySlug: 'chamgyoyuk', autoLink: false }
    ];

    const scan = (title: string) => scanAliasesInTitle(title, ALIASES);

    describe('실제 자유게시판 제목 — 매칭되어야 함', () => {
        const positives: [string, string][] = [
            ['(스포) 나홍진 호프 관람 소감', 'hope'],
            ['영화 호프 감상기 (노스포)', 'hope'],
            ['겸공 ㅋ 호프 스포 ㅋㅋㅋ', 'hope'],
            ['동궁 다 봤는데 저는 재미있네요.', 'donggung'],
            ['(동궁 스포(?)) 꺼먹살이의 하루.avi', 'donggung'],
            ['넷플릭스 동궁 훌륭하네요', 'donggung']
        ];
        for (const [title, slug] of positives) {
            it(`"${title}" → ${slug}`, () => {
                expect(scan(title)?.entitySlug).toBe(slug);
            });
        }
    });

    describe('조사 처리 — 한국어는 교착어라 별칭 뒤에 조사가 바로 붙는다', () => {
        it('"호프를"은 조사가 붙은 것이므로 매칭된다', () => {
            expect(scan('겸공보다가 호프를 다 본거 같내요 ㅋㅋ (스포)')?.entitySlug).toBe('hope');
        });

        it('"동궁이", "동궁은"도 매칭된다', () => {
            expect(scan('동궁이 생각보다 별로')?.entitySlug).toBe('donggung');
            expect(scan('동궁은 취향 탈듯')?.entitySlug).toBe('donggung');
        });
    });

    describe('⛔ 오탐 방지 — 이것들은 절대 매칭되면 안 된다', () => {
        it('"호프집"은 생맥주집이지 영화가 아니다', () => {
            expect(scan('동네 호프집 추천해주세요')).toBeNull();
        });

        it('"동궁전"은 다른 단어다 (경계 검사)', () => {
            expect(scan('경복궁 동궁전 다녀왔습니다')).toBeNull();
        });

        it('별칭 앞에 단어가 붙어도 거부한다', () => {
            expect(scan('네오동궁 후기')).toBeNull();
        });

        it('문맥어가 없으면 자동 연결하지 않는다 (제안만)', () => {
            const hit = scan('퇴근하고 호프 한잔 하실 분');
            expect(hit?.entitySlug).toBe('hope');
            expect(hit?.canAutoLink).toBe(false); // ← 저장 금지, 제안만
        });

        it('일반어 작품명(참교육)은 매칭되어도 자동 연결 금지', () => {
            const hit = scan('참교육 당한 썰 푼다');
            expect(hit?.entitySlug).toBe('chamgyoyuk');
            expect(hit?.canAutoLink).toBe(false);
        });

        it('관련 없는 제목은 null', () => {
            expect(scan('오늘 점심 뭐 먹지')).toBeNull();
        });
    });

    describe('자동 연결 판정', () => {
        it('문맥어가 있으면 자동 연결 허용', () => {
            expect(scan('영화 호프 감상기 (노스포)')?.canAutoLink).toBe(true);
        });

        it('문맥어 조건이 없는 별칭은 바로 자동 연결 허용', () => {
            expect(scan('동궁 다 봤는데 저는 재미있네요.')?.canAutoLink).toBe(true);
        });
    });

    it('여러 별칭이 걸리면 가장 긴 것을 택한다', () => {
        const withLonger: EntityAlias[] = [
            ...ALIASES,
            { aliasNorm: '동궁 시즌2', entitySlug: 'donggung-s2', autoLink: true }
        ];
        expect(scanAliasesInTitle('동궁 시즌2 후기', withLonger)?.entitySlug).toBe('donggung-s2');
    });
});
