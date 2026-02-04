/**
 * Banner Message Plugin - Position-based Banner Advertising System
 *
 * This plugin provides:
 * - Header banners
 * - Sidebar banners
 * - Content banners (inserted within post content)
 * - Click tracking
 */

import type { Extension, ExtensionContext, Widget } from '@angple/types';

interface Banner {
    id: number;
    title: string;
    imageUrl: string;
    linkUrl: string;
    position: 'header' | 'sidebar' | 'content' | 'footer';
    altText?: string;
    target: '_self' | '_blank';
    priority: number;
}

interface BannerSettings {
    headerEnabled: boolean;
    sidebarEnabled: boolean;
    contentEnabled: boolean;
    contentInsertAfterParagraph: number;
    refreshInterval: number;
    apiBaseUrl: string;
}

export default class BannerPlugin implements Extension {
    private context!: ExtensionContext;
    private settings: BannerSettings = {
        headerEnabled: true,
        sidebarEnabled: true,
        contentEnabled: false,
        contentInsertAfterParagraph: 3,
        refreshInterval: 0,
        apiBaseUrl: '/api/v2'
    };
    private bannerCache: Map<string, Banner[]> = new Map();

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

        // Header banner
        if (this.settings.headerEnabled) {
            hooks.addAction('before_page_render', this.renderHeaderBanner.bind(this), 5);
        }

        // Content banner
        if (this.settings.contentEnabled) {
            hooks.addFilter('post_content', this.insertContentBanner.bind(this), 20);
        }

        // Sidebar banner
        if (this.settings.sidebarEnabled) {
            hooks.addFilter('sidebar_widgets', this.addBannerWidget.bind(this), 15);
        }

        console.log('[BannerPlugin] Activated');
    }

    /**
     * Deactivate the plugin
     */
    async deactivate(): Promise<void> {
        const { hooks } = await import('@angple/hook-system');

        hooks.removeAction('before_page_render', this.renderHeaderBanner.bind(this));
        hooks.removeFilter('post_content', this.insertContentBanner.bind(this));
        hooks.removeFilter('sidebar_widgets', this.addBannerWidget.bind(this));

        this.bannerCache.clear();

        console.log('[BannerPlugin] Deactivated');
    }

    /**
     * Fetch banners from API by position
     */
    private async fetchBanners(position: string): Promise<Banner[]> {
        // Check cache
        if (this.bannerCache.has(position)) {
            return this.bannerCache.get(position)!;
        }

        try {
            const response = await fetch(
                `${this.settings.apiBaseUrl}/banners?position=${position}`
            );

            if (!response.ok) {
                return [];
            }

            const data = await response.json();
            const banners = data.data?.banners || [];

            // Cache banners
            this.bannerCache.set(position, banners);

            return banners;
        } catch (error) {
            console.error('[BannerPlugin] Failed to fetch banners:', error);
            return [];
        }
    }

    /**
     * Generate click tracking URL
     */
    private getClickUrl(bannerId: number): string {
        return `${this.settings.apiBaseUrl}/banners/${bannerId}/click`;
    }

    /**
     * Render banner HTML
     */
    private renderBannerHtml(banner: Banner): string {
        const clickUrl = this.getClickUrl(banner.id);

        return `
            <a href="${clickUrl}" target="${banner.target}" class="banner-link" data-banner-id="${banner.id}">
                <img
                    src="${banner.imageUrl}"
                    alt="${banner.altText || banner.title}"
                    class="banner-image"
                    loading="lazy"
                />
            </a>
        `;
    }

    /**
     * Render header banner
     */
    private async renderHeaderBanner(): Promise<void> {
        const banners = await this.fetchBanners('header');

        if (banners.length === 0) {
            return;
        }

        // Get the first (highest priority) banner
        const banner = banners[0];

        // Create banner element
        const bannerContainer = document.createElement('div');
        bannerContainer.className = 'header-banner-container';
        bannerContainer.innerHTML = this.renderBannerHtml(banner);

        // Insert at the top of the page
        const header = document.querySelector('header');
        if (header) {
            header.insertAdjacentElement('afterend', bannerContainer);
        }
    }

    /**
     * Insert banner into content
     */
    private async insertContentBanner(content: string): Promise<string> {
        const banners = await this.fetchBanners('content');

        if (banners.length === 0) {
            return content;
        }

        const banner = banners[0];
        const bannerHtml = `
            <div class="content-banner-container">
                ${this.renderBannerHtml(banner)}
            </div>
        `;

        // Split content by paragraphs
        const paragraphs = content.split(/<\/p>/i);

        if (paragraphs.length <= this.settings.contentInsertAfterParagraph) {
            // Not enough paragraphs, append at end
            return content + bannerHtml;
        }

        // Insert after configured paragraph
        const insertIndex = this.settings.contentInsertAfterParagraph;
        paragraphs[insertIndex - 1] = paragraphs[insertIndex - 1] + '</p>' + bannerHtml;

        return paragraphs.join('</p>');
    }

    /**
     * Add banner widget to sidebar
     */
    private addBannerWidget(widgets: Widget[]): Widget[] {
        widgets.push({
            id: 'sidebar-banner',
            title: '',
            component: 'BannerWidget',
            priority: 15,
            props: {
                position: 'sidebar',
                apiBaseUrl: this.settings.apiBaseUrl
            }
        });

        return widgets;
    }
}
