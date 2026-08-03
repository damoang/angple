import { describe, expect, it } from 'vitest';
import {
    animatedThumbUrl,
    hasSeparateAnimation,
    stillThumbUrl,
    type EmoticonThumbSource
} from './emoticon-thumb';

/** DINKIssTyle 처럼 정지본까지 있는 무거운 항목 */
const heavy: EmoticonThumbSource = {
    file: 'DINKIssTyle-3d-ang-001.webp',
    thumb: 'DINKIssTyle-3d-ang-001_thumb.webp',
    still: 'DINKIssTyle-3d-ang-001_still.webp'
};

/** onion 처럼 이미 가벼워서 정지본을 만들지 않은 항목 */
const light: EmoticonThumbSource = {
    file: 'onion-001.gif',
    thumb: 'onion-001_thumb.webp',
    still: null
};

/** 썸네일 자체가 없는 항목 */
const bare: EmoticonThumbSource = { file: 'welcome-001.png', thumb: null, still: null };

describe('stillThumbUrl', () => {
    it('정지본이 있으면 정지본을 쓴다', () => {
        expect(stillThumbUrl(heavy)).toBe('/emoticons/DINKIssTyle-3d-ang-001_still.webp');
    });

    it('정지본이 없으면 기존 썸네일로 떨어진다 — 회귀 없음', () => {
        expect(stillThumbUrl(light)).toBe('/emoticons/onion-001_thumb.webp');
    });

    it('썸네일도 없으면 원본을 쓴다', () => {
        expect(stillThumbUrl(bare)).toBe('/emoticons/welcome-001.png');
    });

    it('필드가 아예 없어도 원본으로 동작한다', () => {
        expect(stillThumbUrl({ file: 'x.gif' })).toBe('/emoticons/x.gif');
    });
});

describe('animatedThumbUrl', () => {
    it('⛔ 원본이 아니라 _thumb 을 쓴다 — 원본은 5.7MB 짜리가 있다', () => {
        expect(animatedThumbUrl(heavy)).toBe('/emoticons/DINKIssTyle-3d-ang-001_thumb.webp');
        expect(animatedThumbUrl(heavy)).not.toContain('_still');
    });

    it('정지본이 있어도 애니는 _thumb 이다', () => {
        expect(animatedThumbUrl(light)).toBe('/emoticons/onion-001_thumb.webp');
    });

    it('_thumb 이 없을 때만 원본으로 떨어진다', () => {
        expect(animatedThumbUrl(bare)).toBe('/emoticons/welcome-001.png');
    });
});

describe('hasSeparateAnimation', () => {
    it('정지본이 따로 있으면 바꿔 낄 값이 있다', () => {
        expect(hasSeparateAnimation(heavy)).toBe(true);
    });

    it('정지본이 없으면 바꿔 낄 필요가 없다 — 같은 파일을 두 번 요청하지 않는다', () => {
        expect(hasSeparateAnimation(light)).toBe(false);
        expect(hasSeparateAnimation(bare)).toBe(false);
    });
});
