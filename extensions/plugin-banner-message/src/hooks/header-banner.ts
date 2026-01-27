/**
 * Header Banner Hook
 *
 * This hook renders a banner in the header area
 */

interface Banner {
    id: number;
    title: string;
    imageUrl: string;
    linkUrl: string;
    altText?: string;
    target: '_self' | '_blank';
}

interface HeaderBannerConfig {
    apiBaseUrl: string;
    containerClass: string;
    insertAfter: string;
}

const defaultConfig: HeaderBannerConfig = {
    apiBaseUrl: '/api/v2',
    containerClass: 'header-banner-container',
    insertAfter: 'header'
};

/**
 * Fetch header banners from API
 */
async function fetchHeaderBanners(apiBaseUrl: string): Promise<Banner[]> {
    try {
        const response = await fetch(`${apiBaseUrl}/banners?position=header`);

        if (!response.ok) {
            return [];
        }

        const data = await response.json();
        return data.data?.banners || [];
    } catch (error) {
        console.error('[HeaderBanner] Failed to fetch banners:', error);
        return [];
    }
}

/**
 * Render header banner
 */
export async function renderHeaderBanner(
    config: Partial<HeaderBannerConfig> = {}
): Promise<void> {
    const mergedConfig = { ...defaultConfig, ...config };

    const banners = await fetchHeaderBanners(mergedConfig.apiBaseUrl);

    if (banners.length === 0) {
        return;
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

    const insertTarget = document.querySelector(mergedConfig.insertAfter);
    if (insertTarget) {
        insertTarget.insertAdjacentHTML('afterend', bannerHtml);
    }
}

export default renderHeaderBanner;
