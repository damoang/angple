import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFileSync } from 'fs';
import { join } from 'path';
import { checkStorageHealth } from '$lib/server/media/s3-client.js';

function getVersion(): string {
    try {
        const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
        return pkg.version || '0.0.0';
    } catch {
        return '0.0.0';
    }
}

const appVersion = getVersion();

/**
 * Docker 헬스체크용 엔드포인트
 * GET /health
 *
 * Returns application health status, timestamp, version, and service name.
 * Used by Docker HEALTHCHECK and external monitoring.
 *
 * GET /health?deep=1 — 미디어 저장소(S3/R2) 접근까지 확인한다.
 * 배포 스크립트의 헬스체크에서 사용해, 저장소 설정이 빠진 이미지를 배포 단계에서 걸러낸다.
 * 저장소 장애 시 503 을 돌려주지만, Docker HEALTHCHECK(기본 /health)에는 영향을 주지 않는다.
 */
export const GET: RequestHandler = async ({ url }) => {
    const base = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: appVersion,
        service: 'angple-web'
    };

    if (url.searchParams.get('deep') !== '1') {
        return json(base);
    }

    const storage = await checkStorageHealth();
    return json(
        { ...base, status: storage.ok ? 'ok' : 'degraded', checks: { storage } },
        { status: storage.ok ? 200 : 503 }
    );
};
