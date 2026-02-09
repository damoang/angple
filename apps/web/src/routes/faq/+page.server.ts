/**
 * FAQ 페이지 서버
 */
import type { PageServerLoad } from './$types';
import { getAllFaq } from '$lib/server/faq.js';

export const load: PageServerLoad = async () => {
	const { categories, items } = await getAllFaq();

	return { categories, items };
};
