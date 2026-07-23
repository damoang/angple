import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { inspectSocialMbIdOccupant } from '$lib/server/auth/register.js';

/**
 * 이전 계정 안내 화면.
 *
 * 탈퇴한 회원이 같은 소셜 계정으로 다시 가입하려 할 때, 새 계정을 만들어 주는 대신
 * 이 화면으로 보낸다. mb_id 는 소셜 sub 에서 결정적으로 나오므로(generateSocialMbId)
 * 충돌한다는 것은 **같은 소셜 계정**, 즉 동일인이라는 뜻이다.
 *
 * 복구 폼은 /register 의 액션으로 보낸다(intent=recover). 세션 생성·SSO 쿠키 등
 * 로그인 마무리 로직을 그대로 재사용하기 위해서다.
 */
export const load: PageServerLoad = async ({ cookies }) => {
    const pendingData = cookies.get('pending_social_register');
    if (!pendingData) {
        redirect(302, '/login');
    }

    let socialProfile: { provider: string; identifier: string; email?: string };
    try {
        socialProfile = JSON.parse(pendingData);
    } catch {
        redirect(302, '/login');
    }

    if (!socialProfile.identifier) {
        redirect(302, '/register');
    }

    const occupant = await inspectSocialMbIdOccupant(
        socialProfile.provider,
        socialProfile.identifier
    );

    // 점유 계정이 없으면 평범한 가입 건이다. 원래 흐름으로 돌려보낸다.
    if (occupant.kind === 'none') {
        redirect(302, '/register');
    }

    return {
        provider: socialProfile.provider,
        email: socialProfile.email || '',
        // mb_id 는 내려보내지 않는다. 화면에 필요한 최소 정보만.
        account: {
            kind: occupant.kind,
            nick: occupant.nick,
            joinedAt: occupant.joinedAt ? String(occupant.joinedAt).slice(0, 10) : '',
            postCount: occupant.postCount,
            withdrawn: occupant.withdrawn
        }
    };
};
