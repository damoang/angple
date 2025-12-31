import { error } from '@sveltejs/kit';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { RequestHandler } from './$types';

/**
 * 테마 정적 파일 서버
 *
 * /themes/** 경로의 정적 파일 (theme.json, components 등)을 서빙합니다.
 *
 * 예: /themes/corporate-landing/theme.json
 */
export const GET: RequestHandler = ({ params }) => {
    const path = params.path;

    // 보안: 경로 traversal 방지
    if (path.includes('..') || path.startsWith('/')) {
        throw error(403, 'Forbidden');
    }

    try {
        // 테마 디렉터리는 프로젝트 루트의 themes/
        const themesRoot = join(process.cwd(), '../../themes');
        const filePath = join(themesRoot, path);

        const content = readFileSync(filePath);

        // MIME 타입 결정
        const mimeTypes: Record<string, string> = {
            '.json': 'application/json',
            '.js': 'text/javascript',
            '.svelte': 'text/plain',
            '.css': 'text/css',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml'
        };

        const ext = path.substring(path.lastIndexOf('.'));
        const mimeType = mimeTypes[ext] || 'text/plain';

        return new Response(content, {
            headers: {
                'Content-Type': mimeType,
                'Cache-Control': 'public, max-age=3600'
            }
        });
    } catch (err) {
        console.error(`❌ [Theme Static] 파일 읽기 실패: /themes/${path}`, err);
        throw error(404, 'Not found');
    }
};
