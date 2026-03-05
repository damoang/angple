/**
 * 이모티콘 이미지 프록시
 *
 * 1차: 로컬 파일 시스템에서 서빙
 * 2차: PHP 서버(web.damoang.net)에서 프록시
 *
 * /api/emoticons/nariya/damoang-emo-008.gif → 앙티콘 GIF
 * /api/emoticons/da_reaction/filename.webp → 리액션 이미지
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

/** PHP 서버 URL → 경로 매핑 */
const PHP_URL_MAP: Record<string, string> = {
    nariya: 'https://web.damoang.net/plugin/nariya/skin/emo',
    da_reaction: 'https://web.damoang.net/plugin/da_reaction/public/emoticon-images'
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

    // 1차: 로컬 파일에서 서빙 (파일이 존재하는 경우)
    const baseDir = ALLOWED_DIRS[dirKey];
    const filePath = resolve(baseDir, filename); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal

    if (filePath.startsWith(baseDir) && existsSync(filePath)) {
        try {
            const data = await readFile(filePath);
            return new Response(data, {
                headers: { 'Content-Type': mimeType, ...CACHE_HEADERS }
            });
        } catch {
            // 로컬 읽기 실패 → PHP 서버로 fallback
        }
    }

    // 2차: PHP 서버에서 프록시
    const phpBaseUrl = PHP_URL_MAP[dirKey];
    if (!phpBaseUrl) {
        return new Response('Not found', { status: 404 });
    }

    try {
        const phpUrl = `${phpBaseUrl}/${filename}`;
        const response = await fetch(phpUrl, {
            signal: AbortSignal.timeout(5_000)
        });

        if (!response.ok) {
            return new Response('Not found', { status: 404 });
        }

        const data = await response.arrayBuffer();
        return new Response(data, {
            headers: {
                'Content-Type': response.headers.get('content-type') || mimeType,
                ...CACHE_HEADERS
            }
        });
    } catch {
        return new Response('Not found', { status: 404 });
    }
};
