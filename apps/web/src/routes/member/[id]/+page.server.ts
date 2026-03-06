import type { PageServerLoad } from './$types.js';
import type { MemberProfile } from '$lib/api/types.js';

export const load: PageServerLoad = async ({ params, fetch }) => {
    const memberId = params.id;

    try {
        const res = await fetch(`/api/members/${memberId}/profile`);
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return {
                profile: null,
                error: data.error || '회원 정보를 불러오는데 실패했습니다.'
            };
        }

        const data = await res.json();
        if (!data.success) {
            return {
                profile: null,
                error: data.error || '회원 정보를 불러오는데 실패했습니다.'
            };
        }

        return {
            profile: data.data as MemberProfile,
            error: null
        };
    } catch (error) {
        console.error('회원 프로필 로딩 에러:', error);
        return {
            profile: null,
            error: '회원 정보를 불러오는데 실패했습니다.'
        };
    }
};
