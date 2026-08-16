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
    {
        category: 'angticon',
        title: '앙티콘',
        renderType: 'image',
        description: '다모앙 이모티콘'
    },
    { category: 'emoji', title: '이모지', renderType: 'emoji' },
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
    { reaction: 'emoji:2753', category: 'emoji', renderType: 'emoji', emoji: '❓' },
    // 추가(2026-08-10): 🙏 요청 + 슬랙 단골 반응들
    { reaction: 'emoji:1f64f', category: 'emoji', renderType: 'emoji', emoji: '🙏' },
    { reaction: 'emoji:1f44f', category: 'emoji', renderType: 'emoji', emoji: '👏' },
    { reaction: 'emoji:1f64c', category: 'emoji', renderType: 'emoji', emoji: '🙌' },
    { reaction: 'emoji:1f44c', category: 'emoji', renderType: 'emoji', emoji: '👌' },
    { reaction: 'emoji:2705', category: 'emoji', renderType: 'emoji', emoji: '✅' },
    { reaction: 'emoji:1f4af', category: 'emoji', renderType: 'emoji', emoji: '💯' },
    { reaction: 'emoji:1f62d', category: 'emoji', renderType: 'emoji', emoji: '😭' },
    { reaction: 'emoji:1fae1', category: 'emoji', renderType: 'emoji', emoji: '🫡' }
];

// 앙티콘 세트 (다모앙 커스텀 GIF)
const ANGTICON_IDS = [
    'emo-000',
    'emo-001', // 똥 모양 재활성화 — 이모지 닉네임 공개(2026-07-12) 이후 악용 억지가 생겨 복원.
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

/**
 * 리액션 아이콘은 **정지 썸네일**을 쓴다.
 *
 * 리액션바는 20×20(`h-5 w-5`)으로 그리는데 원본 GIF 를 그대로 받고 있었다.
 * 2026-08-17 실측: `damoang-emo-039.gif` 는 152,924B, 같은 파일의 `_thumb.webp` 는
 * 1,142B — **134배** 차이다. 리액션바 영역에서만 1,602KB 를 받고 있었다.
 * 44개 전체로는 3,347KB → 약 127KB(96% 감소).
 *
 * ⛔ 원본(`.gif`)으로 되돌리지 말 것. 20px 에서 애니메이션 인지가 거의 없어
 *    이모티콘 피커도 같은 이유로 정지 썸네일을 쓴다(2026-08-04 결정).
 * ⛔ 썸네일이 없는 앙티콘을 이 목록에 추가하면 아이콘이 깨진다(404).
 *    `scripts/make-reaction-thumbs.py` 로 `_thumb.webp` 를 **먼저** 만들어야 한다.
 *    (파일 먼저·코드 나중 — 2026-08-11 이모티콘 승격 때 전 파일 404 를 낸 전례)
 *
 * 경로는 그대로 `/api/emoticons/nariya/` 를 쓴다. nginx 가 `/emoticons/` 와 같은
 * 호스트 디렉토리를 alias 하므로 파일명만 바꾸면 된다(둘 다 200 확인).
 */
const ANGTICONS: EmoticonDef[] = ANGTICON_IDS.map((id) => ({
    reaction: `angticon:${id}`,
    category: 'angticon',
    renderType: 'image' as const,
    url: `${ANGTICON_BASE}/damoang-${id}_thumb.webp`
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
