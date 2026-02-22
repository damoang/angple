/**
 * 키보드 단축키 서비스
 *
 * PHP(www/)의 단축키 시스템을 SvelteKit으로 이식.
 * 3계층 구조: 시스템 단축키(A-Z) + 특수 단축키(R,H) + 사용자 단축키(0-9)
 *
 * event.code 기반으로 한영 전환과 무관하게 동작.
 * (예: 한글 'ㄹ' 입력 → event.code = 'KeyF' → 자유게시판)
 */

import { goto } from '$app/navigation';
import type { MenuItem } from '$lib/api/types';

// 특수 단축키 (하드코딩)
const SPECIAL_SHORTCUTS: Record<string, string> = {
    KeyR: '__refresh__',
    KeyH: '/'
};

// 미할당 시 기본 URL (홈)
const DEFAULT_URL = '/';

/**
 * 입력 요소인지 확인
 */
function isInputElement(el: EventTarget | null): boolean {
    if (!el || !(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * modifier 키 조합인지 확인
 */
function isKeyCombination(event: KeyboardEvent): boolean {
    return event.ctrlKey || event.shiftKey || event.altKey || event.metaKey;
}

/**
 * contentEditable 요소 안에 있는지 확인
 */
function isContentEditable(el: EventTarget | null): boolean {
    let node = el as HTMLElement | null;
    while (node) {
        if (node.contentEditable === 'true') return true;
        node = node.parentElement;
    }
    return false;
}

/**
 * 글 작성 중인지 확인 (댓글 등)
 */
function hasUnsavedContent(): boolean {
    const el = document.querySelector<HTMLTextAreaElement>('#wr_content');
    return !!el && el.value.trim().length > 0;
}

class KeyboardShortcutService {
    // 시스템 단축키: event.code → URL
    private systemShortcuts = $state<Map<string, string>>(new Map());
    // 사용자 숫자 단축키: event.code → URL
    private userShortcuts = $state<Map<string, string>>(new Map());
    // 디바운스 타이머
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    // 디바운스 딜레이 (ms)
    private readonly DEBOUNCE_DELAY = 300;

    /**
     * 메뉴 데이터에서 시스템 단축키 빌드
     * Admin에서 설정한 shortcut 필드(A-Z) 기반
     */
    buildFromMenus(menus: MenuItem[]) {
        const map = new Map<string, string>();

        // 특수 단축키 먼저 등록
        for (const [code, url] of Object.entries(SPECIAL_SHORTCUTS)) {
            map.set(code, url);
        }

        // 메뉴 트리 순회하며 shortcut 필드 수집
        const traverse = (items: MenuItem[]) => {
            for (const item of items) {
                if (item.shortcut) {
                    const key = item.shortcut.toUpperCase();
                    if (/^[A-Z]$/.test(key)) {
                        const code = `Key${key}`;
                        // 특수 단축키는 덮어쓰지 않음 (R=새로고침, H=홈)
                        if (!(code in SPECIAL_SHORTCUTS)) {
                            map.set(code, item.url);
                        }
                    }
                }
                if (item.children) {
                    traverse(item.children);
                }
            }
        };

        traverse(menus);
        this.systemShortcuts = map;
    }

    /**
     * 사용자 숫자 단축키 설정
     * @param shortcuts - { '1': '/free', '2': '/trade', ... }
     */
    setUserShortcuts(shortcuts: Record<string, string>) {
        const map = new Map<string, string>();
        for (const [digit, url] of Object.entries(shortcuts)) {
            if (/^\d$/.test(digit) && url) {
                map.set(`Digit${digit}`, url);
            }
        }
        this.userShortcuts = map;
    }

    /**
     * 전체 단축키 맵 조회 (디버깅/UI 표시용)
     */
    get allShortcuts(): Map<string, string> {
        const combined = new Map<string, string>();
        // 시스템 단축키
        for (const [code, url] of this.systemShortcuts) {
            if (url !== DEFAULT_URL) {
                combined.set(code, url);
            }
        }
        // 사용자 단축키 (시스템보다 우선)
        for (const [code, url] of this.userShortcuts) {
            combined.set(code, url);
        }
        return combined;
    }

    /**
     * 글로벌 keydown 이벤트 핸들러
     */
    handleKeydown = (event: KeyboardEvent) => {
        // 입력 필드 안에서는 무시
        if (isInputElement(event.target)) return;
        // modifier 키 조합 무시
        if (isKeyCombination(event)) return;
        // contentEditable 요소 안에서는 무시
        if (isContentEditable(event.target)) return;

        const code = event.code;

        // 사용자 숫자 단축키 먼저 체크
        const userUrl = this.userShortcuts.get(code);
        if (userUrl) {
            event.preventDefault();
            this.debouncedNavigate(userUrl);
            return;
        }

        // 시스템 단축키 체크
        const systemUrl = this.systemShortcuts.get(code);
        if (systemUrl && systemUrl !== DEFAULT_URL) {
            event.preventDefault();
            this.debouncedNavigate(systemUrl);
            return;
        }
    };

    /**
     * 디바운스 적용 네비게이션
     */
    private debouncedNavigate(url: string) {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => {
            this.navigate(url);
            this.debounceTimer = null;
        }, this.DEBOUNCE_DELAY);
    }

    /**
     * 네비게이션 실행
     */
    private navigate(url: string) {
        // 새로고침 처리
        if (url === '__refresh__') {
            window.location.reload();
            return;
        }

        // 작성 중인 내용이 있으면 확인
        if (hasUnsavedContent()) {
            if (
                !confirm(
                    '작성 중인 내용이 저장되지 않을 수 있습니다.\n정말로 페이지를 떠나시겠습니까?'
                )
            ) {
                return;
            }
        }

        // 외부 URL이면 location.href, 내부면 goto
        if (url.startsWith('http://') || url.startsWith('https://')) {
            window.location.href = url;
        } else {
            goto(url);
        }
    }
}

export const keyboardShortcuts = new KeyboardShortcutService();
