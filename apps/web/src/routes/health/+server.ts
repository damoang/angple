import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Docker 헬스체크용 엔드포인트
 * GET /health
 */
export const GET: RequestHandler = async () => {
    return json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'angple-web'
    });
};
