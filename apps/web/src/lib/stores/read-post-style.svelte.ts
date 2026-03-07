/**
 * 읽은 글 제목 스타일 설정 스토어
 *
 * localStorage 기반으로 사용자가 선택한 읽은 글 표시 스타일을 저장합니다.
 * 옵션: dimmed(기본, 회색+투명도), bold, italic, underline, strikethrough
 */

import { browser } from '$app/environment';

const STORAGE_KEY = 'angple_read_post_style';

export type ReadPostStyle = 'dimmed' | 'bold' | 'italic' | 'underline' | 'strikethrough';

function createReadPostStyleStore() {
    let style = $state<ReadPostStyle>('dimmed');

    if (browser) {
        try {
            const stored = localStorage.getItem(STORAGE_KEY) as ReadPostStyle | null;
            if (
                stored === 'dimmed' ||
                stored === 'bold' ||
                stored === 'italic' ||
                stored === 'underline' ||
                stored === 'strikethrough'
            ) {
                style = stored;
            }
        } catch {
            // ignore
        }
    }

    return {
        get value() {
            return style;
        },
        set(s: ReadPostStyle) {
            style = s;
            if (browser) {
                try {
                    localStorage.setItem(STORAGE_KEY, s);
                } catch {
                    // ignore
                }
            }
        }
    };
}

export const readPostStyleStore = createReadPostStyleStore();

/**
 * 읽은 글 스타일에 따른 Tailwind 클래스 반환 (classic.svelte 외 컴포넌트용)
 */
export function getReadPostClasses(isRead: boolean): string {
    if (!isRead) return 'text-foreground';
    const s = readPostStyleStore.value;
    switch (s) {
        case 'dimmed':
            return 'text-muted-foreground opacity-55';
        case 'bold':
            return 'text-muted-foreground font-bold';
        case 'italic':
            return 'text-muted-foreground italic';
        case 'underline':
            return 'text-muted-foreground underline';
        case 'strikethrough':
            return 'text-muted-foreground line-through';
        default:
            return 'text-muted-foreground opacity-55';
    }
}
