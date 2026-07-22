import { describe, it, expect } from 'vitest';
import {
    DEFAULT_ASPECTS,
    getAspectPreset,
    getAspectLabel,
    validateAspects,
    buildScorecardTableHtml
} from '../lib/aspect-presets';

/**
 * 앙티티 항목별 평점 프리셋 — 화이트리스트 검증이 핵심 안전장치.
 * 프리셋 밖 aspect 가 저장되면 자유텍스트 오염(집계 불능 키 난립)이 시작되므로,
 * validateAspects 의 "전체 거부" 동작이 무너지면 이 테스트가 깨져야 한다.
 */
describe('getAspectPreset — type별 고정 프리셋', () => {
    it('영화·드라마·애니메이션은 스토리/연출/연기/영상/음악 5항목', () => {
        for (const type of ['movie', 'drama', 'animation']) {
            expect(getAspectPreset(type).map((a) => a.key)).toEqual([
                'story',
                'directing',
                'acting',
                'visual',
                'music'
            ]);
        }
    });

    it('책·웹툰은 스토리/문장(작화)/몰입 3항목', () => {
        expect(getAspectPreset('book').map((a) => a.label)).toEqual(['스토리', '문장', '몰입']);
        expect(getAspectPreset('webtoon').map((a) => a.label)).toEqual(['스토리', '작화', '몰입']);
        // 키는 공유(writing) — 라벨만 type별로 다르다
        expect(getAspectPreset('book').map((a) => a.key)).toEqual(
            getAspectPreset('webtoon').map((a) => a.key)
        );
    });

    it('게임은 스토리/게임성/그래픽/사운드 4항목', () => {
        expect(getAspectPreset('game').map((a) => a.key)).toEqual([
            'story',
            'gameplay',
            'graphics',
            'sound'
        ]);
    });

    it('모르는 type 은 default 프리셋(스토리/완성도/몰입)', () => {
        for (const type of ['show', 'exhibition', 'netflix', 'documentary', '']) {
            expect(getAspectPreset(type)).toEqual(DEFAULT_ASPECTS);
        }
        expect(DEFAULT_ASPECTS.map((a) => a.key)).toEqual(['story', 'completeness', 'immersion']);
    });
});

describe('getAspectLabel — 키 ↔ 라벨', () => {
    it('type 프리셋 안의 키는 한글 라벨을 돌려준다', () => {
        expect(getAspectLabel('movie', 'directing')).toBe('연출');
        expect(getAspectLabel('game', 'gameplay')).toBe('게임성');
    });

    it('프리셋 밖 키는 null', () => {
        expect(getAspectLabel('movie', 'gameplay')).toBeNull();
        expect(getAspectLabel('book', 'directing')).toBeNull();
    });
});

describe('validateAspects — 프리셋 화이트리스트 + 1~5 범위', () => {
    it('부분 입력을 수용한다(프리셋 일부 항목만)', () => {
        const r = validateAspects('movie', { story: 4 });
        expect(r).toEqual({ ok: true, aspects: { story: 4 } });
    });

    it('복수 항목 입력을 수용하고 반올림한다(4.4 → 4)', () => {
        const r = validateAspects('movie', { story: 4.4, music: 5 });
        expect(r).toEqual({ ok: true, aspects: { story: 4, music: 5 } });
    });

    it('프리셋 밖 키가 하나라도 있으면 전체 거부 — 자유텍스트 오염 원천 차단', () => {
        expect(validateAspects('movie', { story: 4, gameplay: 5 }).ok).toBe(false);
        expect(validateAspects('book', { hacked: 3 }).ok).toBe(false);
    });

    it('범위 밖 값 거부(반올림 후 1~5 밖)', () => {
        expect(validateAspects('movie', { story: 0 }).ok).toBe(false);
        expect(validateAspects('movie', { story: 6 }).ok).toBe(false);
        expect(validateAspects('movie', { story: 5.6 }).ok).toBe(false); // round → 6
        expect(validateAspects('movie', { story: 0.4 }).ok).toBe(false); // round → 0
        expect(validateAspects('movie', { story: NaN }).ok).toBe(false);
        expect(validateAspects('movie', { story: '별로' }).ok).toBe(false);
    });

    it('객체가 아니거나 빈 입력은 거부', () => {
        expect(validateAspects('movie', null).ok).toBe(false);
        expect(validateAspects('movie', [4, 5]).ok).toBe(false);
        expect(validateAspects('movie', 'story=4').ok).toBe(false);
        expect(validateAspects('movie', {}).ok).toBe(false);
    });
});

describe('buildScorecardTableHtml — 본문 채점표 템플릿', () => {
    it('항목|점수|한줄평 헤더와 항목별 /10 행을 만든다', () => {
        const html = buildScorecardTableHtml(DEFAULT_ASPECTS);
        expect(html).toContain('<th>항목</th><th>점수</th><th>한줄평</th>');
        for (const a of DEFAULT_ASPECTS) {
            expect(html).toContain(`<tr><td>${a.label}</td><td> /10</td><td></td></tr>`);
        }
        // tiptap insertContent 가 그대로 받는 단일 테이블
        expect(html.startsWith('<table>')).toBe(true);
        expect(html.endsWith('</table>')).toBe(true);
    });
});
