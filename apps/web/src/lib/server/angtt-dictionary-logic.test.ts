import { describe, it, expect } from 'vitest';
import {
    ANGTT_TAG,
    normalizeWorkTitle,
    hasAngttTag,
    buildDictionary,
    matchWorkFromTags
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
        expect(extractTitleCandidates('「듄」 후기')).toContain('듄 후기'.split(' ')[0].length >= 2 ? '듄 후기' : '「듄」 후기'.toLowerCase());
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
