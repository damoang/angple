import { beforeEach, describe, expect, it, vi } from 'vitest';

const { readQuery } = vi.hoisted(() => ({ readQuery: vi.fn() }));
vi.mock('$lib/server/db', () => ({
    default: { query: vi.fn(), execute: vi.fn() },
    readPool: { query: readQuery }
}));

describe('readAngttLinkFromSettings — 설정 JSON 해석', () => {
    it('객체·문자열 둘 다 읽는다', async () => {
        const { readAngttLinkFromSettings } = await import('./angtt-link-mode');
        expect(readAngttLinkFromSettings({ features: { angttLink: 'auto' } })).toBe('auto');
        expect(readAngttLinkFromSettings('{"features":{"angttLink":"suggest"}}')).toBe('suggest');
    });

    it('값이 없거나 모르는 값·깨진 JSON 이면 off', async () => {
        const { readAngttLinkFromSettings } = await import('./angtt-link-mode');
        expect(readAngttLinkFromSettings(null)).toBe('off');
        expect(readAngttLinkFromSettings({})).toBe('off');
        expect(readAngttLinkFromSettings({ features: {} })).toBe('off');
        expect(readAngttLinkFromSettings({ features: { angttLink: 'review' } })).toBe('off');
        expect(readAngttLinkFromSettings({ features: { angttLink: true } })).toBe('off');
        expect(readAngttLinkFromSettings('{broken')).toBe('off');
    });
});

describe('getAngttLinkMode — 게시판별 연결 방식', () => {
    beforeEach(() => {
        vi.resetModules();
        readQuery.mockReset();
    });

    it('angtt=review, free=auto 는 코드 기본값이라 설정을 읽지 않는다', async () => {
        const { getAngttLinkMode } = await import('./angtt-link-mode');
        expect(await getAngttLinkMode('angtt')).toBe('review');
        expect(await getAngttLinkMode('free')).toBe('auto');
        expect(readQuery).not.toHaveBeenCalled();
    });

    it('free 에 설정값이 있어도 코드 기본값이 이긴다', async () => {
        readQuery.mockResolvedValue([[{ settings: { features: { angttLink: 'off' } } }]]);
        const { getAngttLinkMode } = await import('./angtt-link-mode');
        expect(await getAngttLinkMode('free')).toBe('auto');
    });

    it('그 밖의 게시판은 설정값을 쓴다', async () => {
        readQuery.mockResolvedValueOnce([[{ settings: { features: { angttLink: 'auto' } } }]]);
        readQuery.mockResolvedValueOnce([[{ settings: '{"features":{"angttLink":"suggest"}}' }]]);
        const { getAngttLinkMode } = await import('./angtt-link-mode');
        expect(await getAngttLinkMode('movie')).toBe('auto');
        expect(await getAngttLinkMode('qa')).toBe('suggest');
    });

    it('설정 행이 없으면 off', async () => {
        readQuery.mockResolvedValue([[]]);
        const { getAngttLinkMode } = await import('./angtt-link-mode');
        expect(await getAngttLinkMode('hello')).toBe('off');
    });

    it('읽기 실패는 off — free·angtt 는 그대로', async () => {
        readQuery.mockRejectedValue(new Error('db down'));
        const { getAngttLinkMode } = await import('./angtt-link-mode');
        expect(await getAngttLinkMode('movie')).toBe('off');
        expect(await getAngttLinkMode('free')).toBe('auto');
        expect(await getAngttLinkMode('angtt')).toBe('review');
    });

    it('게시판별로 캐시해 같은 게시판은 한 번만 읽는다', async () => {
        readQuery.mockResolvedValue([[{ settings: { features: { angttLink: 'auto' } } }]]);
        const { getAngttLinkMode } = await import('./angtt-link-mode');
        await getAngttLinkMode('movie');
        await getAngttLinkMode('movie');
        await getAngttLinkMode('ott');
        expect(readQuery).toHaveBeenCalledTimes(2);
    });

    it('형식이 잘못된 게시판 이름은 읽지 않고 off', async () => {
        const { getAngttLinkMode } = await import('./angtt-link-mode');
        expect(await getAngttLinkMode('movie; DROP')).toBe('off');
        expect(readQuery).not.toHaveBeenCalled();
    });
});

describe('방식별 허용 범위', () => {
    it('제목 자동 연결은 auto·review 만', async () => {
        const { allowsTitleAutoLink } = await import('./angtt-link-mode');
        expect(allowsTitleAutoLink('auto')).toBe(true);
        expect(allowsTitleAutoLink('review')).toBe(true);
        expect(allowsTitleAutoLink('suggest')).toBe(false);
        expect(allowsTitleAutoLink('off')).toBe(false);
    });

    it('작성자가 확인한 연결은 off 만 막는다', async () => {
        const { allowsConfirmedLink } = await import('./angtt-link-mode');
        expect(allowsConfirmedLink('auto')).toBe(true);
        expect(allowsConfirmedLink('review')).toBe(true);
        expect(allowsConfirmedLink('suggest')).toBe(true);
        expect(allowsConfirmedLink('off')).toBe(false);
    });
});
