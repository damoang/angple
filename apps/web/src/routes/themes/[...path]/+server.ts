import { error } from '@sveltejs/kit';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { RequestHandler } from './$types';
import { sanitizePath } from '$lib/server/path-utils';

/**
 * 테마 정적 파일 서버
 *
 * /themes/** 경로의 정적 파일 (theme.json, components 등)을 서빙합니다.
 *
 * 예: /themes/corporate-landing/theme.json
 */
export const GET: RequestHandler = ({ params }) => {
    const path = params.path;

    // 보안: 경로 traversal 방지 (슬래시, 점 허용)
    const safePath = sanitizePath(path, /^[a-zA-Z0-9\-_/.]+$/);

    try {
        // 테마 디렉터리는 프로젝트 루트의 themes/
        const themesRoot = join(process.cwd(), '../../themes');
        // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        const filePath = join(themesRoot, safePath);

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

        const ext = safePath.substring(safePath.lastIndexOf('.'));
        const mimeType = mimeTypes[ext] || 'text/plain';

        return new Response(content, {
            headers: {
                'Content-Type': mimeType,
                'Cache-Control': 'public, max-age=3600'
            }
        });
    } catch (err) {
        // 보안: 포맷 스트링 인젝션 방지 (변수를 별도 인자로 전달)
        console.error('❌ [Theme Static] 파일 읽기 실패:', '/themes/' + safePath, err);
        throw error(404, 'Not found');
    }
};
