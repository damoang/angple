import { error } from '@sveltejs/kit';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import type { RequestHandler } from './$types';
import { sanitizePath } from '$lib/server/path-utils';

/**
 * 여러 themes 디렉터리 후보를 반환합니다.
 * apps/web/themes/ 와 monorepo 루트 themes/ 모두 탐색합니다.
 */
function getThemesRoots(): string[] {
    const roots: string[] = [];
    const cwdThemes = join(process.cwd(), 'themes');
    const monoRepoThemes = resolve(process.cwd(), '..', '..', 'themes');

    // monorepo 루트 우선 (공식 테마가 여기에 있음)
    if (existsSync(monoRepoThemes)) roots.push(monoRepoThemes);
    if (existsSync(cwdThemes)) roots.push(cwdThemes);

    if (roots.length === 0) roots.push(cwdThemes);
    return roots;
}

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
        // 여러 themes 디렉터리에서 파일을 순서대로 탐색
        const themesRoots = getThemesRoots();
        let filePath = '';
        for (const root of themesRoots) {
            // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
            const candidate = join(root, safePath);
            if (existsSync(candidate)) {
                filePath = candidate;
                break;
            }
        }
        if (!filePath) {
            throw new Error(`File not found in any themes directory: ${safePath}`);
        }

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
