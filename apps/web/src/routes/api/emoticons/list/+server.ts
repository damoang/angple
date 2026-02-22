/**
 * 이모티콘 목록 API
 * static/emoticons/ 디렉터리를 스캔하여 팩별로 그룹핑된 이모티콘 목록 반환
 */
import type { RequestHandler } from './$types';
import { readdir } from 'fs/promises';
import { resolve } from 'path';
import { dev } from '$app/environment';

/** 접두사 → 한글 팩명 매핑 */
const PACK_NAMES: Record<string, string> = {
    onion: '양파',
    'damoang-emo': '다모앙',
    'damoang-meme': '밈',
    'DINKIssTyle-3d-ang': '3D앙',
    'moon-emo': '문이모',
    'DINKIssTyle-ang': 'DINKI앙',
    'DINKIssTyle-flag': '깃발',
    'DINKIssTyle-face': '얼굴',
    'DINKIssTyle-ani': '애니',
    'DINKIssTyle-animal': '동물',
    'DINKIssTyle-anniversary': '기념일',
    'damoang-air': '에어',
    'damoang-sol': '솔',
    'damoang-lala': '라라',
    'damoang-session-0416': '세월호',
    'damoang-session': '시사',
    'damoang-fatherland': '조국',
    president: '대통령',
    'lee-president': '이대통령',
    southsky: '남천',
    usimin: '유시민',
    welcome: '환영'
};

/** 팩 표시 순서 (앞에 올수록 먼저 표시) */
const PACK_ORDER: string[] = [
    'damoang-emo',
    'onion',
    'damoang-meme',
    'DINKIssTyle-3d-ang',
    'moon-emo',
    'DINKIssTyle-ang',
    'DINKIssTyle-flag',
    'DINKIssTyle-face',
    'DINKIssTyle-ani',
    'DINKIssTyle-animal',
    'damoang-air',
    'damoang-sol',
    'damoang-lala',
    'president',
    'lee-president',
    'southsky',
    'usimin',
    'welcome',
    'damoang-session-0416',
    'damoang-session',
    'damoang-fatherland',
    'DINKIssTyle-anniversary'
];

const ALLOWED_EXTENSIONS = new Set(['gif', 'png', 'jpg', 'jpeg', 'webp']);
const SKIP_FILES = new Set(['onion-license.txt']);
const HIDDEN_PACKS = new Set(['southsky']);

interface EmoticonItem {
    file: string;
    thumb: string | null;
}

interface EmoticonPack {
    name: string;
    prefix: string;
    count: number;
    items: EmoticonItem[];
}

// 메모리 캐시 (서버 재시작까지 유지)
let cachedResult: { packs: EmoticonPack[] } | null = null;

/**
 * 파일명에서 팩 접두사를 추출
 * 예: "damoang-emo-001.gif" → "damoang-emo"
 *     "onion-001.gif" → "onion"
 *     "DINKIssTyle-3d-ang-001.webp" → "DINKIssTyle-3d-ang"
 */
function extractPrefix(filename: string): string | null {
    // 알려진 접두사와 매칭 (긴 것부터 시도)
    const sortedPrefixes = Object.keys(PACK_NAMES).sort((a, b) => b.length - a.length);
    for (const prefix of sortedPrefixes) {
        if (filename.startsWith(prefix + '-')) {
            return prefix;
        }
    }
    return null;
}

async function scanEmoticons(): Promise<{ packs: EmoticonPack[] }> {
    if (cachedResult) return cachedResult;

    const emoticonsDir = dev ? resolve('static/emoticons') : resolve('build/client/emoticons');
    const files = await readdir(emoticonsDir);

    // thumb 파일 맵 구축: "damoang-emo-001" → "damoang-emo-001_thumb.gif"
    const thumbMap = new Map<string, string>();
    for (const file of files) {
        if (!file.includes('_thumb')) continue;
        const baseName = file.substring(0, file.indexOf('_thumb'));
        thumbMap.set(baseName, file);
    }

    // 팩별 그룹핑
    const packMap = new Map<string, EmoticonItem[]>();

    for (const file of files) {
        // _thumb, 비이미지, 특수 파일 제외
        if (file.includes('_thumb') || SKIP_FILES.has(file)) continue;

        const ext = file.split('.').pop()?.toLowerCase() || '';
        if (!ALLOWED_EXTENSIONS.has(ext)) continue;

        // 로고 등 비이모티콘 제외
        if (file.startsWith('logo-') || file.startsWith('thumb-')) continue;

        const prefix = extractPrefix(file);
        if (!prefix) continue;
        if (HIDDEN_PACKS.has(prefix)) continue;

        if (!packMap.has(prefix)) {
            packMap.set(prefix, []);
        }

        // thumb 찾기: "damoang-emo-001.gif" → baseName "damoang-emo-001"
        const dotIdx = file.lastIndexOf('.');
        const baseName = dotIdx > 0 ? file.substring(0, dotIdx) : file;
        const thumb = thumbMap.get(baseName) || null;

        packMap.get(prefix)!.push({ file, thumb });
    }

    // 각 팩 내 파일 정렬
    for (const items of packMap.values()) {
        items.sort((a, b) => a.file.localeCompare(b.file));
    }

    // 팩 순서대로 정렬
    const packs: EmoticonPack[] = [];

    // 정의된 순서의 팩 먼저
    for (const prefix of PACK_ORDER) {
        const items = packMap.get(prefix);
        if (items && items.length > 0) {
            packs.push({
                name: PACK_NAMES[prefix] || prefix,
                prefix,
                count: items.length,
                items
            });
            packMap.delete(prefix);
        }
    }

    // 남은 팩 (정의되지 않은 것)
    for (const [prefix, items] of packMap) {
        if (items.length > 0) {
            packs.push({
                name: PACK_NAMES[prefix] || prefix,
                prefix,
                count: items.length,
                items
            });
        }
    }

    cachedResult = { packs };
    return cachedResult;
}

export const GET: RequestHandler = async () => {
    try {
        const result = await scanEmoticons();

        return new Response(JSON.stringify(result), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=3600'
            }
        });
    } catch (error) {
        console.error('이모티콘 목록 스캔 실패:', error);
        return new Response(JSON.stringify({ packs: [] }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
