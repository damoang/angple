import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// wikiang.org 메인 = 위키 대문 문서.
// 루트(/) 접속 시 대문(/대문)으로 이동 (위키는 reroute 로 루트 URL serving — src/hooks.ts).
export const load: PageServerLoad = () => {
    redirect(302, `/${encodeURIComponent('대문')}`);
};
