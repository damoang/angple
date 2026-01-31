/**
 * 게시판 목록 API
 *
 * post-list 위젯의 boardId 동적 옵션에서 사용합니다.
 * 향후 백엔드 API에서 실제 게시판 목록을 가져올 수 있습니다.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** 사용 가능한 게시판 목록 (정적) */
const BOARDS = [
    { label: '새소식 (공지/팁/리뷰)', value: 'notice' },
    { label: '알뜰구매', value: 'economy' },
    { label: '갤러리', value: 'gallery' },
    { label: '소모임', value: 'group' },
    { label: '자유게시판', value: 'free' }
];

export const GET: RequestHandler = async () => {
    // 향후: 백엔드에서 게시판 목록을 동적으로 가져오기
    return json({ success: true, options: BOARDS });
};
