/**
 * Post List Filter Hook
 *
 * This hook intercepts the post list and inserts promotion posts
 * at the configured position (사잇광고)
 */

import type { Post } from '@angple/types';

interface PromotionPost extends Post {
    isPromotion: boolean;
    isPinned: boolean;
    advertiserName?: string;
    linkUrl?: string;
    imageUrl?: string;
}

interface FilterConfig {
    insertPosition: number;
    insertCount: number;
    excludeBoards: string[];
    apiBaseUrl: string;
}

const defaultConfig: FilterConfig = {
    insertPosition: 3,
    insertCount: 1,
    excludeBoards: ['promotion', 'promotion_my', 'notice'],
    apiBaseUrl: '/api/v2'
};

/**
 * Fetch promotion posts for insertion
 */
async function fetchPromotionPosts(count: number, apiBaseUrl: string): Promise<PromotionPost[]> {
    try {
        const response = await fetch(`${apiBaseUrl}/promotion/posts/insert?count=${count}`);

        if (!response.ok) {
            console.warn('[PostListFilter] Failed to fetch promotion posts:', response.status);
            return [];
        }

        const data = await response.json();
        return (data.data || []).map((post: PromotionPost) => ({
            ...post,
            isPromotion: true
        }));
    } catch (error) {
        console.error('[PostListFilter] Error fetching promotion posts:', error);
        return [];
    }
}

/**
 * Post list filter callback
 */
export async function postListFilter(
    posts: Post[],
    boardId: string,
    config: Partial<FilterConfig> = {}
): Promise<Post[]> {
    const mergedConfig = { ...defaultConfig, ...config };

    // Skip excluded boards
    if (mergedConfig.excludeBoards.includes(boardId)) {
        return posts;
    }

    // Fetch promotion posts
    const promotionPosts = await fetchPromotionPosts(
        mergedConfig.insertCount,
        mergedConfig.apiBaseUrl
    );

    if (promotionPosts.length === 0) {
        return posts;
    }

    // Insert at configured position
    const insertIndex = Math.min(mergedConfig.insertPosition, posts.length);
    const result = [...posts];
    result.splice(insertIndex, 0, ...promotionPosts);

    return result;
}

export default postListFilter;
