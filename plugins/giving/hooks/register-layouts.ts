/**
 * 나눔 플러그인 레이아웃/컴포넌트 등록 Hook
 *
 * 1. giving-card 레이아웃을 Layout Registry에 등록 (Plugin 우선순위)
 * 2. giving 게시판 타입을 Board Type Registry에 등록
 * 3. BidPanel을 post.after_content 슬롯에 등록
 */
import { layoutRegistry } from '$lib/components/features/board/layouts/registry.js';
import { boardTypeRegistry } from '$lib/components/features/board/board-type-registry.js';
import { postSlotRegistry } from '$lib/components/features/board/post-slot-registry.js';
import { writeFormRegistry } from '$lib/components/features/board/write-form-registry.js';
import GivingCardLayout from '../components/giving-card.svelte';
import GivingBoard from '../components/giving-board.svelte';
import BidPanel from '../components/bid-panel.svelte';
import GivingWriteForm from '../components/giving-write-form.svelte';
import { parseGivingStatus } from '../types/giving.js';

export default function registerGivingLayouts() {
    // 1. 나눔 카드 레이아웃 등록
    layoutRegistry.registerList(
        {
            id: 'giving-card',
            name: '나눔 카드',
            description: '나눔 게시판 전용 카드 레이아웃 (카운트다운, 참여자 배지)',
            wrapperClass: 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'
        },
        GivingCardLayout,
        'plugin'
    );

    // 2. 나눔 게시판 타입 등록 (boardType === 'giving' → GivingBoard)
    boardTypeRegistry.register('giving', GivingBoard, 'plugin');

    // 3. 나눔 글쓰기 폼 등록 (boardType === 'giving' → GivingWriteForm)
    writeFormRegistry.register('giving', GivingWriteForm, 'plugin');

    // 4. BidPanel을 post.after_content 슬롯에 등록
    postSlotRegistry.register('post.after_content', {
        component: BidPanel,
        condition: (boardType: string) => boardType === 'giving',
        priority: 10,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        propsMapper: (data: any) => {
            const givingStatus = parseGivingStatus(
                data.post.extra_4,
                data.post.extra_5,
                data.post.extra_7
            );
            return {
                postId: data.post.id,
                boardId: data.boardId,
                endTime: data.post.extra_5 || '',
                startTime: data.post.extra_4 || '',
                pointsPerNumber: parseInt(data.post.extra_2 || '0', 10),
                status: givingStatus,
                itemName: data.post.extra_3 || '',
                deliveryType: data.post.extra_6 || ''
            };
        }
    });
}
