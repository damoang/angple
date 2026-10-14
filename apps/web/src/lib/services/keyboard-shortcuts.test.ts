import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { goto } = vi.hoisted(() => ({
    goto: vi.fn<(url: string, opts?: unknown) => Promise<void>>(() => Promise.resolve())
}));
vi.mock('$app/navigation', () => ({ goto }));

import { keyboardShortcuts } from './keyboard-shortcuts.svelte';

interface KeyOpts {
    shiftKey?: boolean;
    defaultPrevented?: boolean;
}

function keyEvent(code: string, opts: KeyOpts = {}) {
    const event = {
        code,
        target: null,
        shiftKey: opts.shiftKey ?? false,
        ctrlKey: false,
        altKey: false,
        metaKey: false,
        defaultPrevented: opts.defaultPrevented ?? false,
        preventDefault: vi.fn()
    };
    return event as unknown as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> };
}

function setPath(pathname: string) {
    vi.stubGlobal('window', { location: { pathname } });
}

describe('keyboardShortcuts.handleKeydown', () => {
    beforeEach(() => {
        goto.mockClear();
        vi.stubGlobal('document', { pointerLockElement: null, querySelector: () => null });
        keyboardShortcuts.buildFromMenus([
            { shortcut: 'F', url: '/free' } as never,
            { shortcut: 'Z', url: '/zzz' } as never
        ]);
        keyboardShortcuts.setUserShortcuts({ '1': '/one' }, { '1': '/shift-one' });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('게임 화면(/games/<게임>)에서는 전역 단축키를 무시한다', () => {
        for (const path of ['/games/commando', '/games/snake', '/games/omok/room/123']) {
            it(`${path}: KeyZ·KeyA·Digit1·Shift+Digit1 이 이동을 일으키지 않는다`, () => {
                setPath(path);
                const events = [
                    keyEvent('KeyZ'),
                    keyEvent('KeyA'),
                    keyEvent('Digit1'),
                    keyEvent('Digit1', { shiftKey: true })
                ];
                for (const e of events) {
                    keyboardShortcuts.handleKeydown(e);
                    expect(e.preventDefault).not.toHaveBeenCalled();
                }
                expect(goto).not.toHaveBeenCalled();
            });
        }
    });

    describe('일반 경로에서는 기존대로 이동한다', () => {
        beforeEach(() => setPath('/free'));

        it('메뉴 단축키(KeyF)', () => {
            keyboardShortcuts.handleKeydown(keyEvent('KeyF'));
            expect(goto).toHaveBeenCalledWith('/free', { invalidateAll: true });
        });

        it('메뉴에 없는 글자키(KeyA)는 첫 화면으로', () => {
            keyboardShortcuts.handleKeydown(keyEvent('KeyA'));
            expect(goto).toHaveBeenCalledWith('/', { invalidateAll: true });
        });

        it('숫자 단축키(Digit1)', () => {
            keyboardShortcuts.handleKeydown(keyEvent('Digit1'));
            expect(goto).toHaveBeenCalledWith('/one', { invalidateAll: true });
        });

        it('Shift+숫자 단축키(Shift+Digit1)', () => {
            keyboardShortcuts.handleKeydown(keyEvent('Digit1', { shiftKey: true }));
            expect(goto).toHaveBeenCalledWith('/shift-one', { invalidateAll: true });
        });
    });

    it('게임 목록(/games)에서는 단축키가 유지된다', () => {
        setPath('/games');
        const e = keyEvent('KeyZ');
        keyboardShortcuts.handleKeydown(e);
        expect(e.preventDefault).toHaveBeenCalled();
        expect(goto).toHaveBeenCalledWith('/zzz', { invalidateAll: true });
    });

    it('/games 로 시작하지만 다른 경로(/gamesboard)는 게임 화면으로 보지 않는다', () => {
        setPath('/gamesboard');
        keyboardShortcuts.handleKeydown(keyEvent('KeyF'));
        expect(goto).toHaveBeenCalledWith('/free', { invalidateAll: true });
    });

    it('이미 처리된(defaultPrevented) 이벤트는 무시한다', () => {
        setPath('/free');
        const e = keyEvent('KeyF', { defaultPrevented: true });
        keyboardShortcuts.handleKeydown(e);
        expect(e.preventDefault).not.toHaveBeenCalled();
        expect(goto).not.toHaveBeenCalled();
    });
});
