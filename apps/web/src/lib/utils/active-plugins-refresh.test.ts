import { describe, expect, it } from 'vitest';
import { shouldRefreshActivePlugins } from './active-plugins-refresh';

describe('shouldRefreshActivePlugins', () => {
    it('비로그인 응답은 캐시된 것일 수 있으므로 다시 받는다', () => {
        expect(shouldRefreshActivePlugins({ ssrPluginCount: 5, ssrLoggedIn: false })).toBe(true);
    });

    it('로그인 응답은 캐시되지 않으므로 다시 받지 않는다', () => {
        expect(shouldRefreshActivePlugins({ ssrPluginCount: 5, ssrLoggedIn: true })).toBe(false);
    });

    it('로그인 여부가 실려 오지 않은 응답은 이전처럼 다시 받는다', () => {
        expect(shouldRefreshActivePlugins({ ssrPluginCount: 5, ssrLoggedIn: undefined })).toBe(
            true
        );
        expect(shouldRefreshActivePlugins({ ssrPluginCount: 5, ssrLoggedIn: null })).toBe(true);
    });

    it('활성 플러그인이 없으면 받지 않는다 (이전과 같다)', () => {
        expect(shouldRefreshActivePlugins({ ssrPluginCount: 0, ssrLoggedIn: false })).toBe(false);
        expect(shouldRefreshActivePlugins({ ssrPluginCount: 0, ssrLoggedIn: true })).toBe(false);
    });
});
