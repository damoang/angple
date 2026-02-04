/**
 * Promotion Plugin - Direct Promotion Board System
 *
 * This plugin provides:
 * - Promotion post insertion into other board lists (사잇광고)
 * - Promotion sidebar widget
 * - Promotion badge for sponsored posts
 */

import type { Extension, ExtensionContext, Post, Widget } from '@angple/types';

interface PromotionPost extends Post {
    isPromotion: boolean;
    isPinned: boolean;
    advertiserName?: string;
    linkUrl?: string;
    imageUrl?: string;
}

interface PromotionSettings {
    insertPosition: number;
    insertCount: number;
    excludeBoards: string[];
}

export default class PromotionPlugin implements Extension {
    private context!: ExtensionContext;
    private settings: PromotionSettings = {
        insertPosition: 3,
        insertCount: 1,
        excludeBoards: ['promotion', 'promotion_my', 'notice']
    };

    /**
     * Activate the plugin
     */
    async activate(context: ExtensionContext): Promise<void> {
        this.context = context;

        // Load settings from context
        if (context.settings) {
            this.settings = {
                ...this.settings,
                ...context.settings
            };
        }

        // Register hooks
        const { hooks } = await import('@angple/hook-system');

        // Insert promotion posts into board lists
        hooks.addFilter('post_list', this.insertPromotionPosts.bind(this), 10);

        // Add promotion widget to sidebar
        hooks.addFilter('sidebar_widgets', this.addPromotionWidget.bind(this), 5);

        // Mark promotion posts with badge
        hooks.addFilter('post_title', this.addPromotionBadge.bind(this), 10);

        console.log('[PromotionPlugin] Activated');
    }

    /**
     * Deactivate the plugin
     */
    async deactivate(): Promise<void> {
        const { hooks } = await import('@angple/hook-system');

        hooks.removeFilter('post_list', this.insertPromotionPosts.bind(this));
        hooks.removeFilter('sidebar_widgets', this.addPromotionWidget.bind(this));
        hooks.removeFilter('post_title', this.addPromotionBadge.bind(this));

        console.log('[PromotionPlugin] Deactivated');
    }

    /**
     * Insert promotion posts into board post lists
     */
    private async insertPromotionPosts(posts: Post[], boardId: string): Promise<Post[]> {
        // Skip excluded boards
        if (this.settings.excludeBoards.includes(boardId)) {
            return posts;
        }

        try {
            // Fetch promotion posts from API
            const response = await fetch(
                `/api/v2/promotion/posts/insert?count=${this.settings.insertCount}`
            );

            if (!response.ok) {
                return posts;
            }

            const data = await response.json();
            const promotionPosts: PromotionPost[] = data.data || [];

            if (promotionPosts.length === 0) {
                return posts;
            }

            // Mark posts as promotions
            const markedPosts = promotionPosts.map((post) => ({
                ...post,
                isPromotion: true
            }));

            // Insert at configured position
            const insertIndex = Math.min(this.settings.insertPosition, posts.length);
            const result = [...posts];
            result.splice(insertIndex, 0, ...markedPosts);

            return result;
        } catch (error) {
            console.error('[PromotionPlugin] Failed to fetch promotion posts:', error);
            return posts;
        }
    }

    /**
     * Add promotion widget to sidebar
     */
    private addPromotionWidget(widgets: Widget[]): Widget[] {
        widgets.push({
            id: 'promotion-latest',
            title: '직접홍보 최신글',
            component: 'PromotionWidget',
            priority: 10,
            props: {
                limit: 5
            }
        });

        return widgets;
    }

    /**
     * Add promotion badge to post titles
     */
    private addPromotionBadge(title: string, post: Post): string {
        const promotionPost = post as PromotionPost;

        if (promotionPost.isPromotion) {
            const badge = promotionPost.isPinned
                ? '<span class="promotion-badge pinned">AD</span>'
                : '<span class="promotion-badge">AD</span>';
            return `${badge} ${title}`;
        }

        return title;
    }
}
