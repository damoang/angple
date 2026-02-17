/**
 * GitHub 토큰 관리 API
 *
 * GET /api/plugins/tokens - 저장된 토큰 scope 목록
 * POST /api/plugins/tokens - 토큰 저장
 * DELETE /api/plugins/tokens?scope=@scope - 토큰 삭제
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
    getTokenProvider,
    listTokensMetadata,
    type TokenValidationResult
} from '$lib/server/github-tokens';

/**
 * GET: 저장된 토큰 scope 목록 조회
 */
export const GET: RequestHandler = async () => {
    try {
        const tokenProvider = getTokenProvider();

        if (!tokenProvider.isConfigured()) {
            return json({
                success: false,
                error: 'GITHUB_TOKEN_ENCRYPTION_KEY가 설정되지 않았습니다.',
                configured: false
            });
        }

        const tokens = await listTokensMetadata();

        return json({
            success: true,
            configured: true,
            tokens: tokens.map((t) => ({
                scope: t.scope,
                createdAt: t.createdAt,
                lastUsedAt: t.lastUsedAt
            }))
        });
    } catch (err) {
        console.error('[API] 토큰 목록 조회 오류:', err);
        return json(
            {
                success: false,
                error: err instanceof Error ? err.message : '알 수 없는 오류'
            },
            { status: 500 }
        );
    }
};

/** POST 요청 body */
interface SaveTokenBody {
    scope: string;
    token: string;
    validate?: boolean;
}

/**
 * POST: 토큰 저장
 */
export const POST: RequestHandler = async ({ request }) => {
    try {
        const body = (await request.json()) as SaveTokenBody;

        // 필수 필드 검증
        if (!body.scope) {
            throw error(400, { message: 'scope는 필수 입력 항목입니다.' });
        }
        if (!body.token) {
            throw error(400, { message: 'token은 필수 입력 항목입니다.' });
        }

        // scope 형식 검증
        const scope = body.scope.startsWith('@') ? body.scope : `@${body.scope}`;
        if (!/^@[a-z0-9-]+$/i.test(scope)) {
            throw error(400, {
                message: '잘못된 scope 형식입니다. @organization 형식이어야 합니다.'
            });
        }

        // 토큰 형식 기본 검증 (ghp_, github_pat_, gho_ 등)
        const tokenPrefixes = ['ghp_', 'github_pat_', 'gho_', 'ghu_', 'ghs_'];
        const tokenProvider = getTokenProvider();

        if (!tokenProvider.isConfigured()) {
            return json(
                {
                    success: false,
                    error: 'GITHUB_TOKEN_ENCRYPTION_KEY가 설정되지 않았습니다.'
                },
                { status: 500 }
            );
        }

        // 토큰 유효성 검증 (옵션)
        let validation: TokenValidationResult | null = null;
        if (body.validate !== false) {
            validation = await tokenProvider.validateToken(body.token);
            if (!validation.valid) {
                return json(
                    {
                        success: false,
                        error: validation.error || '토큰 검증 실패'
                    },
                    { status: 400 }
                );
            }
        }

        // 토큰 저장
        await tokenProvider.setToken(scope, body.token);

        return json({
            success: true,
            scope,
            validation: validation
                ? {
                      valid: validation.valid,
                      username: validation.username,
                      scopes: validation.scopes
                  }
                : null
        });
    } catch (err) {
        console.error('[API] 토큰 저장 오류:', err);

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
 * DELETE: 토큰 삭제
 */
export const DELETE: RequestHandler = async ({ url }) => {
    try {
        const scope = url.searchParams.get('scope');

        if (!scope) {
            throw error(400, { message: 'scope 파라미터가 필요합니다.' });
        }

        const tokenProvider = getTokenProvider();
        const deleted = await tokenProvider.deleteToken(scope);

        if (deleted) {
            return json({ success: true, scope });
        } else {
            return json(
                {
                    success: false,
                    error: '해당 scope의 토큰을 찾을 수 없습니다.'
                },
                { status: 404 }
            );
        }
    } catch (err) {
        console.error('[API] 토큰 삭제 오류:', err);

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
