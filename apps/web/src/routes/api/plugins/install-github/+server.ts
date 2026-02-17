/**
 * GitHub Packages에서 플러그인 설치 API
 *
 * POST /api/plugins/install-github
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getGitHubInstaller, type InstallRequest } from '$lib/server/plugins/github-installer';

/** URL이 GitHub 호스트인지 hostname으로 정확히 검증 */
function isGitHubUrl(urlStr: string): boolean {
    try {
        const url = new URL(urlStr);
        return url.hostname === 'github.com' || url.hostname === 'www.github.com';
    } catch {
        return false;
    }
}

/** 요청 body 인터페이스 */
interface InstallRequestBody {
    packageName: string;
    version?: string;
    isPrivate?: boolean;
    token?: string;
    saveToken?: boolean;
}

export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = (await request.json()) as InstallRequestBody;

        // 필수 필드 검증
        if (!body.packageName) {
            throw error(400, { message: 'packageName은 필수 입력 항목입니다.' });
        }

        // 패키지명 형식 검증 (URL은 hostname으로 정확히 검증)
        if (!body.packageName.startsWith('@') && !isGitHubUrl(body.packageName)) {
            throw error(400, {
                message: '패키지명은 @scope/package-name 형식이거나 GitHub URL이어야 합니다.'
            });
        }

        const installer = getGitHubInstaller();

        // 설치 요청 구성
        const installRequest: InstallRequest = {
            packageName: body.packageName,
            version: body.version,
            isPrivate: body.isPrivate ?? false,
            token: body.token,
            saveToken: body.saveToken ?? false
        };

        // 설치 실행
        const result = await installer.install(installRequest);

        if (result.success) {
            return json({
                success: true,
                pluginId: result.pluginId,
                manifest: result.manifest
            });
        } else {
            return json(
                {
                    success: false,
                    error: result.error
                },
                { status: 400 }
            );
        }
    } catch (err) {
        console.error('[API] 플러그인 설치 오류:', err);

        if (err && typeof err === 'object' && 'status' in err) {
            throw err;
        }

        return json(
            {
                success: false,
                error: err instanceof Error ? err.message : '알 수 없는 오류'
            },
            { status: 500 }
        );
    }
};

/**
 * 패키지 정보 미리보기
 *
 * GET /api/plugins/install-github?packageName=@scope/package
 */
export const GET: RequestHandler = async ({ url }) => {
    const packageName = url.searchParams.get('packageName');
    const token = url.searchParams.get('token');

    if (!packageName) {
        throw error(400, { message: 'packageName 파라미터가 필요합니다.' });
    }

    const installer = getGitHubInstaller();
    const result = await installer.preview(packageName, token || undefined);

    if (result.success) {
        return json({
            success: true,
            packageInfo: result.packageInfo
        });
    } else {
        return json(
            {
                success: false,
                error: result.error
            },
            { status: 400 }
        );
    }
};
