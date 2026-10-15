import { describe, expect, it } from 'vitest';
import {
    ACTIVE_PLUGINS_STALE_AFTER_MS,
    shouldRefreshActivePlugins
} from './active-plugins-refresh';

const NOW = 1_800_000_000_000;

describe('shouldRefreshActivePlugins', () => {
    it('로그인 응답은 캐시되지 않으므로 다시 받지 않는다', () => {
        expect(shouldRefreshActivePlugins({ ssrPluginCount: 5, ssrLoggedIn: true })).toBe(false);
        // 오래된 시각이 실려 와도 로그인 응답이면 받지 않는다
        expect(
            shouldRefreshActivePlugins({
                ssrPluginCount: 5,
                ssrLoggedIn: true,
                renderedAt: NOW - 10 * ACTIVE_PLUGINS_STALE_AFTER_MS,
                now: NOW
            })
        ).toBe(false);
    });

    it('활성 플러그인이 없으면 받지 않는다 (이전과 같다)', () => {
        expect(shouldRefreshActivePlugins({ ssrPluginCount: 0, ssrLoggedIn: false })).toBe(false);
        expect(shouldRefreshActivePlugins({ ssrPluginCount: 0, ssrLoggedIn: true })).toBe(false);
        expect(
            shouldRefreshActivePlugins({
                ssrPluginCount: 0,
                ssrLoggedIn: false,
                renderedAt: NOW - 10 * ACTIVE_PLUGINS_STALE_AFTER_MS,
                now: NOW
            })
        ).toBe(false);
    });

    it('비로그인이라도 방금 만든 페이지면 다시 받지 않는다', () => {
        expect(
            shouldRefreshActivePlugins({
                ssrPluginCount: 5,
                ssrLoggedIn: false,
                renderedAt: NOW - 1_000,
                now: NOW
            })
        ).toBe(false);
        expect(
            shouldRefreshActivePlugins({
                ssrPluginCount: 5,
                ssrLoggedIn: false,
                renderedAt: NOW - (ACTIVE_PLUGINS_STALE_AFTER_MS - 1),
                now: NOW
            })
        ).toBe(false);
    });

    it('비로그인 페이지가 기준 시간 이상 오래됐으면 다시 받는다', () => {
        expect(
            shouldRefreshActivePlugins({
                ssrPluginCount: 5,
                ssrLoggedIn: false,
                renderedAt: NOW - ACTIVE_PLUGINS_STALE_AFTER_MS,
                now: NOW
            })
        ).toBe(true);
        expect(
            shouldRefreshActivePlugins({
                ssrPluginCount: 5,
                ssrLoggedIn: false,
                renderedAt: NOW - 3_600_000,
                now: NOW
            })
        ).toBe(true);
    });

    it('만든 시각이 실려 오지 않은 응답(이전 버전 HTML)은 이전처럼 다시 받는다', () => {
        expect(shouldRefreshActivePlugins({ ssrPluginCount: 5, ssrLoggedIn: false })).toBe(true);
        expect(
            shouldRefreshActivePlugins({
                ssrPluginCount: 5,
                ssrLoggedIn: false,
                renderedAt: null
            })
        ).toBe(true);
        expect(
            shouldRefreshActivePlugins({
                ssrPluginCount: 5,
                ssrLoggedIn: false,
                renderedAt: Number.NaN,
                now: NOW
            })
        ).toBe(true);
    });

    it('로그인 여부가 실려 오지 않은 응답도 시각 기준으로 판단한다', () => {
        expect(shouldRefreshActivePlugins({ ssrPluginCount: 5, ssrLoggedIn: undefined })).toBe(
            true
        );
        expect(shouldRefreshActivePlugins({ ssrPluginCount: 5, ssrLoggedIn: null })).toBe(true);
        expect(
            shouldRefreshActivePlugins({
                ssrPluginCount: 5,
                ssrLoggedIn: undefined,
                renderedAt: NOW - 1_000,
                now: NOW
            })
        ).toBe(false);
    });

    it('브라우저 시계가 크게 어긋나 만든 시각이 미래로 보이면 다시 받는다', () => {
        expect(
            shouldRefreshActivePlugins({
                ssrPluginCount: 5,
                ssrLoggedIn: false,
                renderedAt: NOW + ACTIVE_PLUGINS_STALE_AFTER_MS,
                now: NOW
            })
        ).toBe(true);
        // 조금 어긋난 정도는 방금 만든 페이지로 본다
        expect(
            shouldRefreshActivePlugins({
                ssrPluginCount: 5,
                ssrLoggedIn: false,
                renderedAt: NOW + 5_000,
                now: NOW
            })
        ).toBe(false);
    });
});
