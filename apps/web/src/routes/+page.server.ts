import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// wikiang.org 메인 = 위키 대문 문서.
// 루트(/) 접속 시 위키 대문(/wiki/대문)으로 이동한다 (MediaWiki Main_Page 패턴).
// 위키 렌더는 routes/wiki/[...path] 가 담당.
export const load: PageServerLoad = () => {
    redirect(302, `/wiki/${encodeURIComponent('대문')}`);
};
