import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { isValidKeyFormat } from '$lib/server/license.js';
import type { LicenseVerifyRequest, LicenseVerifyResponse } from '$lib/types/license.js';

/**
 * 라이선스 검증 API (공개)
 *
 * POST /api/licenses/verify
 * Body: { key, domain, productId }
 *
 * 플러그인/테마가 설치 시 이 API를 호출하여 라이선스 유효성을 확인합니다.
 * 실제 DB 연동은 Go 백엔드에서 처리하며, 이 엔드포인트는 프록시 역할입니다.
 */
export const POST: RequestHandler = async ({ request, fetch }) => {
    try {
        const body: LicenseVerifyRequest = await request.json();

        if (!body.key || !body.domain || !body.productId) {
            return json(
                {
                    valid: false,
                    error: 'key, domain, productId가 필요합니다.'
                } satisfies Partial<LicenseVerifyResponse>,
                { status: 400 }
            );
        }

        if (!isValidKeyFormat(body.key)) {
            return json(
                {
                    valid: false,
                    error: '잘못된 라이선스 키 형식입니다.'
                } satisfies Partial<LicenseVerifyResponse>,
                { status: 400 }
            );
        }

        // Go 백엔드로 검증 요청 프록시
        const backendUrl = process.env.INTERNAL_API_URL || 'http://localhost:8090/api/v2';
        const res = await fetch(`${backendUrl}/licenses/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            return json(
                {
                    valid: false,
                    error: '라이선스 검증 실패'
                } satisfies Partial<LicenseVerifyResponse>,
                { status: res.status }
            );
        }

        const result: LicenseVerifyResponse = await res.json();
        return json(result);
    } catch (err) {
        console.error('[license-verify] 오류:', err);
        return json(
            {
                valid: false,
                error: '라이선스 검증 중 오류가 발생했습니다.'
            } satisfies Partial<LicenseVerifyResponse>,
            { status: 500 }
        );
    }
};
