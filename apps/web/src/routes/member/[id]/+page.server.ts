import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types.js';

export const load: PageServerLoad = async ({ params, fetch, locals, url }) => {
    const memberId = params.id;

    // #12501: 비로그인 사용자는 타 회원 프로필 열람 불가 → 로그인 페이지로 유도 (개인정보 보호)
    if (!locals.user) {
        redirect(302, `/login?redirect=${encodeURIComponent(url.pathname)}`);
    }

    try {
        const res = await fetch(`/api/members/${memberId}/profile`);
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return { profile: null, error: data.error || '회원 정보를 불러오는데 실패했습니다.' };
        }

        const data = await res.json();
        if (!data.success) {
            return { profile: null, error: data.error || '회원 정보를 불러오는데 실패했습니다.' };
        }

        return { profile: data.data, error: null };
    } catch (error) {
        console.error('회원 프로필 로딩 에러:', error);
        return { profile: null, error: '회원 정보를 불러오는데 실패했습니다.' };
    }
};
