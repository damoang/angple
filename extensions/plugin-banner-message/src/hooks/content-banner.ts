/**
 * Content Banner Hook
 *
 * This hook inserts a banner within post content
 */

interface Banner {
    id: number;
    title: string;
    imageUrl: string;
    linkUrl: string;
    altText?: string;
    target: '_self' | '_blank';
}

interface ContentBannerConfig {
    apiBaseUrl: string;
    insertAfterParagraph: number;
    containerClass: string;
}

const defaultConfig: ContentBannerConfig = {
    apiBaseUrl: '/api/v2',
    insertAfterParagraph: 3,
    containerClass: 'content-banner-container'
};

let bannerCache: Banner[] | null = null;

/**
 * Fetch content banners from API
 */
async function fetchContentBanners(apiBaseUrl: string): Promise<Banner[]> {
    if (bannerCache !== null) {
        return bannerCache;
    }

    try {
        const response = await fetch(`${apiBaseUrl}/banners?position=content`);

        if (!response.ok) {
            return [];
        }

        const data = await response.json();
        bannerCache = data.data?.banners || [];
        return bannerCache;
    } catch (error) {
        console.error('[ContentBanner] Failed to fetch banners:', error);
        return [];
    }
}

/**
 * Insert banner into content
 */
export async function insertContentBanner(
    content: string,
    config: Partial<ContentBannerConfig> = {}
): Promise<string> {
    const mergedConfig = { ...defaultConfig, ...config };

    const banners = await fetchContentBanners(mergedConfig.apiBaseUrl);

    if (banners.length === 0) {
        return content;
    }

    const banner = banners[0];
    const clickUrl = `${mergedConfig.apiBaseUrl}/banners/${banner.id}/click`;

    const bannerHtml = `
        <div class="${mergedConfig.containerClass}">
            <a href="${clickUrl}" target="${banner.target}" class="banner-link" data-banner-id="${banner.id}">
                <img
                    src="${banner.imageUrl}"
                    alt="${banner.altText || banner.title}"
                    class="banner-image"
                    loading="lazy"
                />
            </a>
        </div>
    `;

    // Split content by paragraph closing tags
    const paragraphRegex = /<\/p>/gi;
    const parts = content.split(paragraphRegex);

    if (parts.length <= mergedConfig.insertAfterParagraph) {
        // Not enough paragraphs, append at end
        return content + bannerHtml;
    }

    // Reconstruct content with banner inserted
    const result: string[] = [];
    for (let i = 0; i < parts.length; i++) {
        result.push(parts[i]);
        if (i < parts.length - 1) {
            result.push('</p>');
        }
        if (i === mergedConfig.insertAfterParagraph - 1) {
            result.push(bannerHtml);
        }
    }

    return result.join('');
}

/**
 * Clear banner cache
 */
export function clearCache(): void {
    bannerCache = null;
}

export default insertContentBanner;
