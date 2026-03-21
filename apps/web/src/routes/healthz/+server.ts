import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFileSync } from 'fs';
import { join } from 'path';

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
 * Lightweight app health endpoint.
 * GET /healthz
 *
 * Mirrors /health so kube probes can use the same path across canary and prod.
 */
export const GET: RequestHandler = async () => {
    return json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: appVersion,
        service: 'angple-web'
    });
};
