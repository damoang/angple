import type { PageServerLoad } from './$types';
import { loadLanding } from '$plugins/ad-free/server/loaders';

// Shim — 모든 로직은 $plugins/ad-free/ 안. 이 파일은 라우트 마운트 슬롯.
export const load: PageServerLoad = async () => {
    return await loadLanding({ siteId: 'default' });
};
