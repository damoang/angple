import { updateLoginTimestamp } from '$lib/server/auth/oauth/member.js';
import { grantLoginXP } from '$lib/server/auth/xp-grant.js';
import { grantLoginPoint } from '$lib/server/auth/point-grant.js';
import { checkAndPromoteMember } from '$lib/server/auth/auto-promotion.js';
import { LEVEL_HISTORY_REASONS } from '$lib/server/auth/member-level-history.js';

export async function runSocialLoginPostProcess(mbId: string, clientIp: string): Promise<void> {
    await updateLoginTimestamp(mbId, clientIp);
    await Promise.allSettled([grantLoginXP(mbId), grantLoginPoint(mbId)]);
    await checkAndPromoteMember(mbId, { reason: LEVEL_HISTORY_REASONS.AUTO_PROMOTE_SOCIAL });
}
