import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { goto } = vi.hoisted(() => ({
    goto: vi.fn<(url: string, opts?: unknown) => Promise<void>>(() => Promise.resolve())
}));
vi.mock('$app/navigation', () => ({ goto }));

import { keyboardShortcuts } from './keyboard-shortcuts.svelte';

interface KeyOpts {
    shiftKey?: boolean;
    defaultPrevented?: boolean;
    target?: unknown;
}

function keyEvent(code: string, opts: KeyOpts = {}) {
    const event = {
        code,
        target: opts.target ?? null,
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

/** `closest` 만 흉내 낸 가짜 요소 — 표식 속성 영역 안/밖을 고른다 */
class FakeElement {
    tagName = 'DIV';
    contentEditable = 'inherit';
    parentElement = null;
    insideOptOut: boolean;
    constructor(insideOptOut: boolean) {
        this.insideOptOut = insideOptOut;
    }
    closest(selector: string) {
        return selector === '[data-no-global-shortcuts]' && this.insideOptOut ? this : null;
    }
}

function stubDocument(opts: { activeElement?: unknown; bodyOptOut?: boolean } = {}) {
    vi.stubGlobal('document', {
        pointerLockElement: null,
        querySelector: () => null,
        activeElement: opts.activeElement ?? null,
        body: {
            hasAttribute: (name: string) =>
                name === 'data-no-global-shortcuts' && (opts.bodyOptOut ?? false)
        }
    });
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

    describe('data-no-global-shortcuts 표식으로 전역 단축키를 끈다', () => {
        beforeEach(() => {
            setPath('/brickang');
            // isInputElement 의 instanceof 검사용 (node 환경엔 HTMLElement 가 없다)
            vi.stubGlobal('HTMLElement', FakeElement);
        });

        const optOutKeys = () => [
            keyEvent('KeyZ'),
            keyEvent('KeyA'),
            keyEvent('Digit1'),
            keyEvent('Digit1', { shiftKey: true })
        ];

        it('이벤트 대상이 표식 영역 안이면 이동하지 않는다', () => {
            stubDocument();
            for (const code of ['KeyZ', 'KeyA', 'Digit1']) {
                const e = keyEvent(code, { target: new FakeElement(true) });
                keyboardShortcuts.handleKeydown(e);
                expect(e.preventDefault).not.toHaveBeenCalled();
            }
            const shifted = keyEvent('Digit1', { shiftKey: true, target: new FakeElement(true) });
            keyboardShortcuts.handleKeydown(shifted);
            expect(shifted.preventDefault).not.toHaveBeenCalled();
            expect(goto).not.toHaveBeenCalled();
        });

        it('포커스 요소(activeElement)가 표식 영역 안이면 이동하지 않는다', () => {
            stubDocument({ activeElement: new FakeElement(true) });
            for (const e of optOutKeys()) {
                keyboardShortcuts.handleKeydown(e);
                expect(e.preventDefault).not.toHaveBeenCalled();
            }
            expect(goto).not.toHaveBeenCalled();
        });

        it('body 에 표식이 있으면 대상·포커스와 무관하게 이동하지 않는다', () => {
            stubDocument({ bodyOptOut: true, activeElement: new FakeElement(false) });
            for (const e of optOutKeys()) {
                keyboardShortcuts.handleKeydown(e);
                expect(e.preventDefault).not.toHaveBeenCalled();
            }
            const outside = keyEvent('KeyF', { target: new FakeElement(false) });
            keyboardShortcuts.handleKeydown(outside);
            expect(outside.preventDefault).not.toHaveBeenCalled();
            expect(goto).not.toHaveBeenCalled();
        });

        it('표식 영역 밖이면 기존대로 이동한다', () => {
            stubDocument({ activeElement: new FakeElement(false) });
            const e = keyEvent('KeyF', { target: new FakeElement(false) });
            keyboardShortcuts.handleKeydown(e);
            expect(e.preventDefault).toHaveBeenCalled();
            expect(goto).toHaveBeenCalledWith('/free', { invalidateAll: true });

            goto.mockClear();
            keyboardShortcuts.handleKeydown(keyEvent('KeyA', { target: new FakeElement(false) }));
            expect(goto).toHaveBeenCalledWith('/', { invalidateAll: true });
        });

        it('body 표식이 없는 document(body 없음)에서도 기존대로 이동한다', () => {
            setPath('/free');
            keyboardShortcuts.handleKeydown(keyEvent('KeyF'));
            expect(goto).toHaveBeenCalledWith('/free', { invalidateAll: true });
        });
    });
});
