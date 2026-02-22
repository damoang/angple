/**
 * GET /api/widgets/recommended/data?period=6h
 *
 * PHP 크론이 생성하는 추천글 JSON 캐시 파일을 읽어서 반환.
 * Go 백엔드의 /api/v1/recommended/ai/{period} 가 deprecated 되어
 * 빈 배열을 반환하므로, 캐시 파일을 직접 읽습니다.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';

// PHP 추천글 캐시 디렉토리
const RECOMMENDED_CACHE_DIR =
    process.env.RECOMMENDED_CACHE_DIR || '/home/damoang/www/data/cache/recommended';

// period 매핑: 클라이언트 → 파일명 (기본 + AI)
const PERIOD_FILES: Record<string, { base: string; ai: string }> = {
    '1h': { base: '1hour.json', ai: 'ai_1hour.json' },
    '3h': { base: '3hours.json', ai: 'ai_3hours.json' },
    '6h': { base: '6hours.json', ai: 'ai_6hours.json' },
    '12h': { base: '12hours.json', ai: 'ai_12hours.json' },
    '24h': { base: '24hours.json', ai: 'ai_24hours.json' },
    '48h': { base: '48hours.json', ai: 'ai_48hours.json' }
};

export const GET: RequestHandler = async ({ url }) => {
    const period = url.searchParams.get('period') || '6h';

    const files = PERIOD_FILES[period];
    if (!files) {
        error(400, `잘못된 period: ${period}. 가능한 값: ${Object.keys(PERIOD_FILES).join(', ')}`);
    }

    // AI 파일이 최신이면 AI 버전 사용, 아니면 기본 파일 사용
    const basePath = `${RECOMMENDED_CACHE_DIR}/${files.base}`;
    const aiPath = `${RECOMMENDED_CACHE_DIR}/${files.ai}`;

    let filePath = basePath;
    if (existsSync(aiPath) && existsSync(basePath)) {
        // AI 파일이 기본 파일보다 새로우면 AI 버전 사용
        if (statSync(aiPath).mtimeMs >= statSync(basePath).mtimeMs) {
            filePath = aiPath;
        }
    } else if (existsSync(aiPath)) {
        filePath = aiPath;
    }

    if (!existsSync(filePath)) {
        error(404, `추천글 캐시 파일을 찾을 수 없습니다`);
    }

    try {
        const content = await readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        return json(data, {
            headers: {
                'Cache-Control': 'public, max-age=60'
            }
        });
    } catch (err) {
        console.error('[recommended/data] 캐시 파일 읽기 실패:', err);
        error(500, '추천글 데이터 로드 실패');
    }
};
