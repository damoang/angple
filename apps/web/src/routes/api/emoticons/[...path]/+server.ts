/**
 * 이모티콘 이미지 프록시 (SvelteKit fallback)
 *
 * 운영 환경에서는 nginx가 직접 서빙 (SvelteKit 우회):
 *   /api/emoticons/nariya/* → /home/damoang/legacy-data/emoticons/
 *   /emoticons/*            → /home/damoang/legacy-data/emoticons/
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
    nariya: '/home/damoang/legacy-data/emoticons',
    // 2026-08-29: 원래 PHP 플러그인 경로(`/home/damoang/www/plugin/da_reaction/public/emoticon-images`)
    // 를 가리켰는데 그 디렉터리는 서버에 **존재하지 않는다**. `import-image:` 리액션 139행이
    // 전부 액박이었다(글 34개). 실제 파일은 legacy-data 에 살아 있으므로 같은 곳을 본다.
    da_reaction: '/home/damoang/legacy-data/emoticons'
};

/**
 * 확장자 폴백 순서.
 *
 * ⛔ `import-image:` 리액션은 확장자 없이 이름만 저장한다(`import-image:damoang-emo-008`).
 *    소비 코드가 `.webp` 를 하드코딩해 왔는데 실제 파일은 `.gif` 49개 / `.jpg` 8개다.
 *    그래서 경로만 고쳐도 여전히 안 나온다 — 확장자를 찾아 줘야 한다.
 */
const EXT_FALLBACK = ['webp', 'gif', 'png', 'jpg', 'jpeg'] as const;

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
    // 요청된 확장자를 먼저 보고, 없으면 같은 이름의 다른 확장자를 찾는다.
    // ⛔ 후보마다 baseDir 하위인지 다시 확인한다 — 확장자만 바꾼다고 안전이 보장되지 않는다.
    const stem = filename.slice(0, filename.length - ext.length - 1);
    const candidates = [
        filename,
        ...EXT_FALLBACK.filter((e) => e !== ext).map((e) => `${stem}.${e}`)
    ];

    for (const candidate of candidates) {
        const candidateExt = candidate.split('.').pop()?.toLowerCase() || '';
        const candidateMime = MIME_TYPES[candidateExt];
        if (!candidateMime) continue;

        // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
        const candidatePath = resolve(baseDir, candidate);
        if (!candidatePath.startsWith(baseDir) || !existsSync(candidatePath)) continue;

        try {
            const data = await readFile(candidatePath);
            return new Response(data, {
                headers: { 'Content-Type': candidateMime, ...CACHE_HEADERS }
            });
        } catch {
            // 읽기 실패 — 다음 후보로
        }
    }

    return new Response('Not found', { status: 404 });
};
