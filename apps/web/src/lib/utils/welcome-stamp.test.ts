import { describe, it, expect } from 'vitest';
import {
    isWelcomeStampContent,
    hasStampedWelcome,
    welcomeStampContent,
    WELCOME_PACK_PREFIX
} from './welcome-stamp';

describe('welcomeStampContent', () => {
    it('파일명을 {emo:} 토큰으로 감싼다', () => {
        expect(welcomeStampContent('welcome-001.jpg')).toBe('{emo:welcome-001.jpg}');
    });

    it('prefix 상수는 라이브 팩 prefix(welcome)와 일치한다', () => {
        expect(WELCOME_PACK_PREFIX).toBe('welcome');
    });
});

describe('isWelcomeStampContent', () => {
    it('welcome 팩 단일 토큰이면 true', () => {
        expect(isWelcomeStampContent('{emo:welcome-001.jpg}')).toBe(true);
        expect(isWelcomeStampContent('{emo:welcome-004.jpg}')).toBe(true);
    });

    it('에디터가 <p>로 감싼 저장분도 true', () => {
        expect(isWelcomeStampContent('<p>{emo:welcome-002.jpg}</p>')).toBe(true);
        expect(isWelcomeStampContent('<p>&nbsp;{emo:welcome-002.jpg}&nbsp;</p>')).toBe(true);
    });

    it('앞뒤 공백은 무시한다', () => {
        expect(isWelcomeStampContent('  {emo:welcome-003.jpg}  ')).toBe(true);
    });

    it('다른 팩 앙티콘은 false', () => {
        expect(isWelcomeStampContent('{emo:damoang-emo-001.gif}')).toBe(false);
        expect(isWelcomeStampContent('{emo:onion-012.gif}')).toBe(false);
    });

    it('토큰 + 다른 텍스트가 섞이면 일반 댓글로 본다 (false)', () => {
        expect(isWelcomeStampContent('환영해요 {emo:welcome-001.jpg}')).toBe(false);
        expect(isWelcomeStampContent('{emo:welcome-001.jpg} 반가워요')).toBe(false);
        expect(isWelcomeStampContent('{emo:welcome-001.jpg}{emo:welcome-002.jpg}')).toBe(false);
    });

    it('일반 텍스트·빈 값은 false', () => {
        expect(isWelcomeStampContent('환영합니다!')).toBe(false);
        expect(isWelcomeStampContent('')).toBe(false);
        expect(isWelcomeStampContent(null)).toBe(false);
        expect(isWelcomeStampContent(undefined)).toBe(false);
    });
});

describe('hasStampedWelcome', () => {
    const stamp = { author_id: 'me', content: '{emo:welcome-001.jpg}', deleted_at: null };
    const normal = { author_id: 'me', content: '어서오세요!', deleted_at: null };
    const others = { author_id: 'other', content: '{emo:welcome-002.jpg}', deleted_at: null };

    it('내 welcome 스탬프 댓글이 있으면 true', () => {
        expect(hasStampedWelcome([normal, stamp, others], 'me')).toBe(true);
    });

    it('내 스탬프가 없으면 false (남의 스탬프는 무관)', () => {
        expect(hasStampedWelcome([normal, others], 'me')).toBe(false);
    });

    it('삭제된 스탬프는 제외 — 다시 환영할 수 있다', () => {
        const deleted = { ...stamp, deleted_at: '2026-07-22T00:00:00Z' };
        expect(hasStampedWelcome([deleted], 'me')).toBe(false);
    });

    it('비로그인(myId 없음)·빈 목록은 false', () => {
        expect(hasStampedWelcome([stamp], null)).toBe(false);
        expect(hasStampedWelcome([stamp], undefined)).toBe(false);
        expect(hasStampedWelcome([], 'me')).toBe(false);
        expect(hasStampedWelcome(null, 'me')).toBe(false);
    });
});
