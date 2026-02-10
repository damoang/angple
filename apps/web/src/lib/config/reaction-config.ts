/**
 * 리액션 이모티콘/카테고리 설정
 *
 * PHP da_reaction.config.php와 동일한 구성.
 * 카테고리: 이모지, 앙티콘 (다모앙 GIF), Noto 움직이는 이모지
 */
import type { CategoryDef, EmoticonDef } from '$lib/types/reaction.js';

// ============================================================
// 카테고리
// ============================================================
export const REACTION_CATEGORIES: CategoryDef[] = [
    { category: 'emoji', title: '이모지', renderType: 'emoji' },
    {
        category: 'angticon',
        title: '앙티콘',
        renderType: 'image',
        description: '다모앙 이모티콘'
    },
    {
        category: 'noto-animoji',
        title: 'Noto 움직이는 이모지',
        renderType: 'image'
    }
];

// ============================================================
// Base URLs
// ============================================================
// 앙티콘: 로컬 프록시 사용 (Cloudflare 우회)
const ANGTICON_BASE = '/api/emoticons/nariya';
const NOTO_BASE = 'https://fonts.gstatic.com/s/e/notoemoji/latest';

// ============================================================
// 이모티콘 정의
// ============================================================

// 이모지 세트
const EMOJIS: EmoticonDef[] = [
    { reaction: 'emoji:1f44d', category: 'emoji', renderType: 'emoji', emoji: '👍' },
    { reaction: 'emoji:1f44e', category: 'emoji', renderType: 'emoji', emoji: '👎' },
    { reaction: 'emoji:1f600', category: 'emoji', renderType: 'emoji', emoji: '😀' },
    { reaction: 'emoji:1f604', category: 'emoji', renderType: 'emoji', emoji: '😄' },
    { reaction: 'emoji:1f602', category: 'emoji', renderType: 'emoji', emoji: '😂' },
    { reaction: 'emoji:1f60d', category: 'emoji', renderType: 'emoji', emoji: '😍' },
    { reaction: 'emoji:2764', category: 'emoji', renderType: 'emoji', emoji: '❤️' },
    { reaction: 'emoji:1f622', category: 'emoji', renderType: 'emoji', emoji: '😢' },
    { reaction: 'emoji:1f60e', category: 'emoji', renderType: 'emoji', emoji: '😎' },
    { reaction: 'emoji:1f631', category: 'emoji', renderType: 'emoji', emoji: '😱' },
    { reaction: 'emoji:1f914', category: 'emoji', renderType: 'emoji', emoji: '🤔' },
    { reaction: 'emoji:1f389', category: 'emoji', renderType: 'emoji', emoji: '🎉' },
    { reaction: 'emoji:1f680', category: 'emoji', renderType: 'emoji', emoji: '🚀' },
    { reaction: 'emoji:1f525', category: 'emoji', renderType: 'emoji', emoji: '🔥' },
    { reaction: 'emoji:1f440', category: 'emoji', renderType: 'emoji', emoji: '👀' },
    { reaction: 'emoji:2b55', category: 'emoji', renderType: 'emoji', emoji: '⭕' },
    { reaction: 'emoji:274c', category: 'emoji', renderType: 'emoji', emoji: '❌' },
    { reaction: 'emoji:2753', category: 'emoji', renderType: 'emoji', emoji: '❓' }
];

// 앙티콘 세트 (다모앙 커스텀 GIF)
const ANGTICON_IDS = [
    'emo-000',
    'emo-001',
    'emo-002',
    'emo-003',
    'emo-004',
    'emo-005',
    'emo-006',
    'emo-007',
    'emo-008',
    'emo-011',
    'emo-012',
    'emo-013',
    'emo-014',
    'emo-015',
    'emo-016',
    'emo-017',
    'emo-018',
    'emo-019',
    'emo-020',
    'emo-023',
    'emo-025',
    'emo-026',
    'emo-027',
    'emo-028',
    'emo-029',
    'emo-030',
    'emo-031',
    'emo-032',
    'emo-033',
    'emo-034',
    'emo-035',
    'emo-036',
    'emo-037',
    'emo-038',
    'emo-039',
    'emo-040',
    'emo-041',
    'emo-042',
    'emo-043',
    'emo-045',
    'emo-046',
    'emo-054',
    'emo-059',
    'emo-067'
];

const ANGTICONS: EmoticonDef[] = ANGTICON_IDS.map((id) => ({
    reaction: `angticon:${id}`,
    category: 'angticon',
    renderType: 'image' as const,
    url: `${ANGTICON_BASE}/damoang-${id}.gif`
}));

// Noto 움직이는 이모지
const NOTO_ANIMOJI: EmoticonDef[] = [
    {
        reaction: 'noto-animoji:1f680',
        category: 'noto-animoji',
        renderType: 'image',
        url: `${NOTO_BASE}/1f680/512.webp`
    },
    {
        reaction: 'noto-animoji:2764-fe0f',
        category: 'noto-animoji',
        renderType: 'image',
        url: `${NOTO_BASE}/2764_fe0f/512.webp`
    },
    {
        reaction: 'noto-animoji:1f44d',
        category: 'noto-animoji',
        renderType: 'image',
        url: `${NOTO_BASE}/1f44d/512.webp`
    },
    {
        reaction: 'noto-animoji:1f602',
        category: 'noto-animoji',
        renderType: 'image',
        url: `${NOTO_BASE}/1f602/512.webp`
    },
    {
        reaction: 'noto-animoji:1f389',
        category: 'noto-animoji',
        renderType: 'image',
        url: `${NOTO_BASE}/1f389/512.webp`
    },
    {
        reaction: 'noto-animoji:1f914',
        category: 'noto-animoji',
        renderType: 'image',
        url: `${NOTO_BASE}/1f914/512.webp`
    },
    {
        reaction: 'noto-animoji:1f60d',
        category: 'noto-animoji',
        renderType: 'image',
        url: `${NOTO_BASE}/1f60d/512.webp`
    },
    {
        reaction: 'noto-animoji:1f525',
        category: 'noto-animoji',
        renderType: 'image',
        url: `${NOTO_BASE}/1f525/512.webp`
    },
    {
        reaction: 'noto-animoji:1f622',
        category: 'noto-animoji',
        renderType: 'image',
        url: `${NOTO_BASE}/1f622/512.webp`
    },
    {
        reaction: 'noto-animoji:1f631',
        category: 'noto-animoji',
        renderType: 'image',
        url: `${NOTO_BASE}/1f631/512.webp`
    }
];

// 리액션 교체 맵 (PHP와 동일: emoji:1f389 → import-image:ezgif-55990bc446328e)
export const REACTION_REPLACE: Record<string, string> = {
    'emoji:1f389': 'import-image:ezgif-55990bc446328e'
};

/** 전체 이모티콘 목록 */
export const REACTION_EMOTICONS: EmoticonDef[] = [...EMOJIS, ...ANGTICONS, ...NOTO_ANIMOJI];

/** 리액션 ID로 이모티콘 정의 찾기 */
export function findEmoticon(reaction: string): EmoticonDef | undefined {
    // 교체 맵 확인
    const replaced = REACTION_REPLACE[reaction];
    if (replaced) {
        return REACTION_EMOTICONS.find((e) => e.reaction === replaced);
    }
    return REACTION_EMOTICONS.find((e) => e.reaction === reaction);
}
