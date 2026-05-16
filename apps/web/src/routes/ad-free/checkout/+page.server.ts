import type { PageServerLoad } from './$types';
import { loadCheckout } from '$plugins/ad-free/server/loaders';

// Shim — 비회원도 진입 가능. 회원이면 user 정보 prefill, 비회원이면 guest 폼.
export const load: PageServerLoad = async ({ locals, url }) => {
    const planParam = url.searchParams.get('plan');
    const initialPlan: 'monthly' | 'half_yearly' =
        planParam === 'monthly' || planParam === 'half_yearly' ? planParam : 'monthly';
    const data = await loadCheckout({ siteId: 'default', initialPlan });
    const user = (locals as any).user;
    return {
        ...data,
        isGuest: !user?.mb_id,
        prefill: user
            ? {
                  email: user.mb_email ?? '',
                  nickname: user.mb_nickname ?? user.mb_nick ?? user.mb_id ?? ''
              }
            : { email: '', nickname: '' }
    };
};
