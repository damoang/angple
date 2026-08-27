import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { inspectSocialMbIdOccupant } from '$lib/server/auth/register.js';
import { ACCOUNT_RECOVERY_LOCKED } from '$lib/server/auth/account-recovery-lock.js';

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

    // ⛔ 응급 킬 스위치. 평상시 false 이며, 복구 경로에 다시 문제가 발견되면 즉시 잠근다.
    if (ACCOUNT_RECOVERY_LOCKED) {
        redirect(302, '/register?recovery=locked');
    }

    const occupant = await inspectSocialMbIdOccupant(
        socialProfile.provider,
        socialProfile.identifier
    );

    // ⛔ `owned` 가 아니면 이 화면을 보여주지 않는다.
    //    `unverified` 는 해시만 겹친 남의 계정일 수 있고, 이 화면은 그 계정의
    //    닉네임·가입일·글수를 보여주므로 그 자체가 남의 정보 노출이다.
    //    `blocked` 도 여기서 계정 정보를 흘리지 않는다.
    if (occupant.kind !== 'owned') {
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
