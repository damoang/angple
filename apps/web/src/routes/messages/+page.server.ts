import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ url, locals }) => {
    // SSR 인증이 비었어도 "일시 장애(authDegraded)"면 /login 하드 리다이렉트하지 않는다.
    // 세션 쿠키는 있는데 조회만 지연된 경우 리다이렉트하면 /messages ↔ /login 무한 왕복
    // ("새로고침 시 세션 끊겼다 연결" #12621/#12642). 셸을 렌더하고 클라이언트(authStore +
    // 쪽지 API 401)가 최종 판정한다 — 클라가 미인증이면 +page.svelte 가 1회만 로그인 유도.
    if (!locals.user && !locals.authDegraded) {
        redirect(302, `/login?redirect=${encodeURIComponent(url.pathname + url.search)}`);
    }
    const kind = (url.searchParams.get('kind') as 'recv' | 'send') || 'recv';
    const page = Number(url.searchParams.get('page')) || 1;
    const limit = 20;
    const to = url.searchParams.get('to') || '';

    return {
        kind,
        page,
        limit,
        to,
        authDegraded: !locals.user && locals.authDegraded
    };
};
