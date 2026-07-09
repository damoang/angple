import type { PageServerLoad } from './$types';
import { promoteDuePolicyVersions, getContentVersions } from '$lib/server/content.js';

export const load: PageServerLoad = async () => {
    // 이력 조회 시에도 시행일 도래 버전을 자동 승격
    await promoteDuePolicyVersions('privacy');
    const versions = await getContentVersions('privacy');
    return { versions };
};
