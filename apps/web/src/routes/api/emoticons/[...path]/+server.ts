/**
 * 이모티콘 이미지 프록시 (SvelteKit fallback)
 *
 * 운영 환경에서는 nginx가 직접 서빙 (SvelteKit 우회):
 *   /api/emoticons/nariya/* → /home/damoang/www/plugin/nariya/skin/emo/
 *   /emoticons/*            → /home/damoang/www/plugin/nariya/skin/emo/
 *
 * 이 라우트는 dev 서버용 fallback으로만 사용됨.
 */
import type { RequestHandler } from './$types';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve } from 'path';

const MIME_TYPES: Record<string, string> = {
    gif: 'image/gif',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    webp: 'image/webp',
    svg: 'image/svg+xml'
};

const ALLOWED_DIRS: Record<string, string> = {
    nariya: '/home/damoang/www/plugin/nariya/skin/emo',
    da_reaction: '/home/damoang/www/plugin/da_reaction/public/emoticon-images'
};

const CACHE_HEADERS = {
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Access-Control-Allow-Origin': '*'
};

export const GET: RequestHandler = async ({ params }) => {
    const pathParts = params.path.split('/');

    if (pathParts.length < 2) {
        return new Response('Not found', { status: 404 });
    }

    const dirKey = pathParts[0];
    const filename = pathParts.slice(1).join('/');

    if (!ALLOWED_DIRS[dirKey]) {
        return new Response('Not found', { status: 404 });
    }

    // 경로 탐색 공격 방지
    if (filename.includes('..') || filename.includes('\\') || filename.startsWith('/')) {
        return new Response('Forbidden', { status: 403 });
    }

    // 확장자 검증
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeType = MIME_TYPES[ext];
    if (!mimeType) {
        return new Response('Unsupported file type', { status: 415 });
    }

    // 로컬 파일에서 서빙
    const baseDir = ALLOWED_DIRS[dirKey];
    const filePath = resolve(baseDir, filename); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal

    if (filePath.startsWith(baseDir) && existsSync(filePath)) {
        try {
            const data = await readFile(filePath);
            return new Response(data, {
                headers: { 'Content-Type': mimeType, ...CACHE_HEADERS }
            });
        } catch {
            // 읽기 실패
        }
    }

    return new Response('Not found', { status: 404 });
};
