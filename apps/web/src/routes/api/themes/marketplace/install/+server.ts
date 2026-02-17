/**
 * 마켓플레이스 테마 설치 오케스트레이터
 *
 * POST /api/themes/marketplace/install
 *
 * 레지스트리에서 테마 정보를 조회하고, 인증/라이선스 확인 후
 * GitHub에서 테마를 설치합니다.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRegistryTheme } from '$lib/server/themes/registry';
import { isThemeInstalled } from '$lib/server/themes';
import { getTokenProvider } from '$lib/server/github-tokens/token-provider';
import type { MarketplaceInstallResponse } from '$lib/types/registry';

/**
 * POST /api/themes/marketplace/install
 * Body: { themeId: string, licenseKey?: string }
 */
export const POST: RequestHandler = async ({ request, fetch: serverFetch }) => {
    try {
        const body = await request.json();
        const { themeId, licenseKey } = body;

        if (!themeId) {
            return json({ success: false, error: '테마 ID가 필요합니다.' }, { status: 400 });
        }

        // 1. 이미 설치되어 있는지 확인
        if (isThemeInstalled(themeId)) {
            return json({ success: false, error: '이미 설치된 테마입니다.' }, { status: 409 });
        }

        // 2. 레지스트리에서 테마 정보 조회
        const regTheme = await getRegistryTheme(themeId);

        if (!regTheme) {
            return json(
                { success: false, error: '레지스트리에서 테마를 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        // 3. 라이선스 확인 (필요한 경우)
        if (regTheme.licenseRequired) {
            if (!licenseKey) {
                const resp: MarketplaceInstallResponse = {
                    success: false,
                    error: '이 테마는 라이선스 키가 필요합니다.',
                    requiresLicense: true
                };
                return json(resp, { status: 402 });
            }

            // 라이선스 검증 API 호출
            const verifyResponse = await serverFetch('/api/licenses/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: licenseKey,
                    productId: regTheme.productId
                })
            });

            if (!verifyResponse.ok) {
                return json(
                    { success: false, error: '라이선스 키가 유효하지 않습니다.' },
                    { status: 403 }
                );
            }
        }

        // 4. GitHub 토큰 확인 (프리미엄 테마)
        if (regTheme.requiredScope) {
            const tokenProvider = getTokenProvider();
            const token = await tokenProvider.getToken(regTheme.requiredScope);

            if (!token) {
                const resp: MarketplaceInstallResponse = {
                    success: false,
                    error: `'${regTheme.requiredScope}' GitHub 토큰이 필요합니다.`,
                    requiresAuth: true,
                    requiredScope: regTheme.requiredScope
                };
                return json(resp, { status: 401 });
            }
        }

        // 5. install-github 엔드포인트로 설치 위임
        const installResponse = await serverFetch('/api/themes/install-github', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                githubUrl: regTheme.githubUrl,
                scope: regTheme.requiredScope,
                subdirectory: regTheme.githubPath
            })
        });

        const installResult = await installResponse.json();

        if (!installResponse.ok) {
            return json(
                {
                    success: false,
                    error: installResult.error || '테마 설치에 실패했습니다.',
                    requiresAuth: installResult.requiresAuth
                },
                { status: installResponse.status }
            );
        }

        const resp: MarketplaceInstallResponse = {
            success: true,
            theme: installResult.theme
        };

        return json(resp);
    } catch (error) {
        console.error('[Marketplace Install] 설치 실패:', error);
        return json(
            {
                success: false,
                error: '마켓플레이스 테마 설치 중 오류가 발생했습니다.'
            },
            { status: 500 }
        );
    }
};
