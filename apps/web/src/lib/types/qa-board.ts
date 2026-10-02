/**
 * Q&A 게시판 타입 정의
 *
 * extra 필드 매핑:
 * - extra_1: 질문 상태 ('unanswered' | 'answered' | 'solved' | 'closed')
 * - extra_2: 포인트 현상금 (0이면 없음)
 * - extra_3: 채택된 답변(댓글) ID
 */

import type { FreePost } from '$lib/api/types.js';

export type QAStatus = 'unanswered' | 'answered' | 'solved' | 'closed';

export interface QAInfo {
    status: QAStatus;
    bounty: number;
    acceptedAnswerId: number | null;
}

/** FreePost에서 Q&A 정보 파싱 */
export function parseQAInfo(post: FreePost): QAInfo {
    return {
        status: (post.extra_1 as QAStatus) || 'unanswered',
        bounty: parseInt(post.extra_2 || '0', 10),
        acceptedAnswerId: post.extra_3 ? parseInt(post.extra_3, 10) : null
    };
}

/** Q&A 상태 라벨 */
export function getQAStatusLabel(status: QAStatus): string {
    switch (status) {
        case 'unanswered':
            return '미해결';
        case 'answered':
            return '답변됨';
        case 'solved':
            return '해결됨';
        case 'closed':
            return '마감';
    }
}

/** Q&A 상태별 색상 클래스 */
export function getQAStatusColor(status: QAStatus): string {
    switch (status) {
        case 'unanswered':
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
        case 'answered':
            return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
        case 'solved':
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
        case 'closed':
            return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
}

/**
 * Q&A 게시판인지 판정한다.
 *
 * 게시판 API 는 board_type 이 비어 있는 게시판에 'standard' 를 내려준다. board_type 만
 * 믿으면 Q&A 게시판을 일반 게시판으로 오판하므로 게시판 id 를 먼저 본다.
 * (앙지도의 isAngmapBoard 와 같은 방식)
 */
export function isQaBoard(boardId: string, boardType?: string | null): boolean {
    return boardId === 'qa' || boardType === 'qa';
}
