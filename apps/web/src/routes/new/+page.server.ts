/**
 * 새글 모아보기 페이지 서버
 */
import type { PageServerLoad } from './$types';
import { getNewPosts, getBoardGroups } from '$lib/server/new-posts.js';

export const load: PageServerLoad = async ({ url }) => {
	const view = (url.searchParams.get('view') as string) || '';
	const grId = url.searchParams.get('gr_id') || '';
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
	const perPage = 30;

	const [result, groups] = await Promise.all([
		getNewPosts(view, grId, page, perPage),
		getBoardGroups()
	]);

	return {
		items: result.items,
		total: result.total,
		groups,
		currentView: view,
		currentGroup: grId,
		pagination: {
			page,
			perPage,
			total: result.total,
			totalPages: Math.ceil(result.total / perPage)
		}
	};
};
