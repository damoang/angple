/**
 * 마켓플레이스 테마 업데이트 API
 *
 * POST /api/themes/marketplace/update
 *
 * 설치된 테마를 레지스트리의 최신 버전으로 업데이트합니다.
 * GitHub에서 최신 코드를 re-clone하고, 테마 설정(settings.json)은 보존됩니다.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRegistryTheme } from '$lib/server/themes/registry';
import { isThemeInstalled } from '$lib/server/themes';
import { getTokenProvider } from '$lib/server/github-tokens/token-provider';

/**
 * POST /api/themes/marketplace/update
 * Body: { themeId: string }
 */
export const POST: RequestHandler = async ({ request, fetch: serverFetch }) => {
    try {
        const body = await request.json();
        const { themeId } = body;

        if (!themeId) {
            return json({ success: false, error: '테마 ID가 필요합니다.' }, { status: 400 });
        }

        // 1. 테마가 설치되어 있는지 확인
        if (!isThemeInstalled(themeId)) {
            return json(
                { success: false, error: '설치되지 않은 테마입니다. 먼저 설치해주세요.' },
                { status: 404 }
            );
        }

        // 2. 레지스트리에서 테마 정보 조회
        const regTheme = await getRegistryTheme(themeId);

        if (!regTheme) {
            return json(
                { success: false, error: '레지스트리에서 테마를 찾을 수 없습니다.' },
                { status: 404 }
            );
        }

        // 3. GitHub 토큰 확인 (프리미엄 테마)
        if (regTheme.requiredScope) {
            const tokenProvider = getTokenProvider();
            const token = await tokenProvider.getToken(regTheme.requiredScope);

            if (!token) {
                return json(
                    {
                        success: false,
                        error: `'${regTheme.requiredScope}' GitHub 토큰이 필요합니다.`,
                        requiresAuth: true,
                        requiredScope: regTheme.requiredScope
                    },
                    { status: 401 }
                );
            }
        }

        // 4. install-github 엔드포인트로 업데이트 위임 (force=true)
        const installResponse = await serverFetch('/api/themes/install-github', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                githubUrl: regTheme.githubUrl,
                scope: regTheme.requiredScope,
                subdirectory: regTheme.githubPath,
                force: true
            })
        });

        const installResult = await installResponse.json();

        if (!installResponse.ok) {
            return json(
                {
                    success: false,
                    error: installResult.error || '테마 업데이트에 실패했습니다.'
                },
                { status: installResponse.status }
            );
        }

        return json({
            success: true,
            message: '테마가 최신 버전으로 업데이트되었습니다.',
            theme: installResult.theme
        });
    } catch (error) {
        console.error('[Marketplace Update] 업데이트 실패:', error);
        return json(
            {
                success: false,
                error: '마켓플레이스 테마 업데이트 중 오류가 발생했습니다.'
            },
            { status: 500 }
        );
    }
};
