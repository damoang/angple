import type { PageServerLoad } from './$types';
import { loadCheckout } from '$plugins/ad-free/server/loaders';

// Shim — 비회원도 진입 가능. 회원이면 user 정보 prefill, 비회원이면 guest 폼.
// 회원 식별은 hooks.server.ts 가 채우는 App.Locals.user.id(=mb_id) 기준.
export const load: PageServerLoad = async ({ locals, url }) => {
    const planParam = url.searchParams.get('plan');
    const initialPlan: 'monthly' | 'half_yearly' =
        planParam === 'monthly' || planParam === 'half_yearly' ? planParam : 'monthly';
    const data = await loadCheckout({ siteId: 'default', initialPlan });
    const user = locals.user;
    const memberId = user?.id ?? '';
    return {
        ...data,
        isGuest: !memberId,
        // 이메일은 locals.user 에 없으므로 빈 값으로 둔다.
        prefill: memberId
            ? { email: '', nickname: user?.nickname ?? memberId }
            : { email: '', nickname: '' }
    };
};
