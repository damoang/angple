/**
 * 구 소모임 관리 화면 — /support(돌보기)로 개명되었다.
 *
 * 기존 당주들의 북마크·습관을 지키기 위해 영구 리다이렉트만 남긴다.
 */
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
    redirect(301, `/${params.boardId}/support`);
};
