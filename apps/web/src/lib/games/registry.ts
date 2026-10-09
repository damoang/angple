/**
 * 미니게임 목록 — 게임 이름·설명은 여기 한 곳에서만 정한다.
 * (/games 목록 화면과 각 게임 페이지 제목이 모두 이 값을 읽는다.)
 */
import Crown from '@lucide/svelte/icons/crown';
import Circle from '@lucide/svelte/icons/circle';
import Zap from '@lucide/svelte/icons/zap';
import Blocks from '@lucide/svelte/icons/blocks';

export interface GameEntry {
    id: string;
    name: string;
    description: string;
    href: string;
    icon: typeof Crown;
    /** 아이콘 색 (Tailwind 클래스) */
    color: string;
    /** 카드 배경 (Tailwind 클래스) */
    bgColor: string;
}

export const GAMES: GameEntry[] = [
    {
        id: 'janggi',
        name: '장기',
        description: 'AI와 대결하는 한국 전통 장기',
        href: '/games/janggi',
        icon: Crown,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50 dark:bg-amber-950/30'
    },
    {
        id: 'omok',
        name: '오목',
        description: '15x15 바둑판 위의 오목 대결',
        href: '/games/omok',
        icon: Circle,
        color: 'text-stone-700 dark:text-stone-300',
        bgColor: 'bg-stone-50 dark:bg-stone-900/30'
    },
    {
        id: 'snake',
        name: '뱀 게임',
        description: '클래식 스네이크 게임',
        href: '/games/snake',
        icon: Zap,
        color: 'text-green-600',
        bgColor: 'bg-green-50 dark:bg-green-950/30'
    },
    {
        id: 'stack',
        name: '앙쌓기',
        description: '떨어지는 블록을 쌓아 줄을 지우는 퍼즐',
        href: '/games/stack',
        icon: Blocks,
        color: 'text-sky-600',
        bgColor: 'bg-sky-50 dark:bg-sky-950/30'
    }
];

/** id 로 게임 정보를 찾는다. 없는 id 는 프로그래밍 오류다. */
export function getGame(id: string): GameEntry {
    const game = GAMES.find((g) => g.id === id);
    if (!game) throw new Error(`unknown game: ${id}`);
    return game;
}
