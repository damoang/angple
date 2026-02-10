/**
 * 이모티콘 이미지 프록시
 * 로컬 파일 시스템에서 앙티콘/이모티콘 이미지 서빙
 *
 * /api/emoticons/nariya/damoang-emo-008.gif → 로컬 앙티콘 GIF
 * /api/emoticons/da_reaction/filename.webp → 로컬 import-image
 */
import type { RequestHandler } from './$types';
import { readFile } from 'fs/promises';
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

export const GET: RequestHandler = async ({ params }) => {
    const pathParts = params.path.split('/');

    if (pathParts.length < 2) {
        return new Response('Not found', { status: 404 });
    }

    const dirKey = pathParts[0];
    const filename = pathParts.slice(1).join('/');

    const baseDir = ALLOWED_DIRS[dirKey];
    if (!baseDir) {
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

    try {
        const filePath = resolve(baseDir, filename);

        // 절대 경로가 허용된 디렉토리 내에 있는지 확인
        if (!filePath.startsWith(baseDir)) {
            return new Response('Forbidden', { status: 403 });
        }

        const data = await readFile(filePath);

        return new Response(data, {
            headers: {
                'Content-Type': mimeType,
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch {
        return new Response('Not found', { status: 404 });
    }
};
