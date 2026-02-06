<script lang="ts">
    /**
     * 축하메시지 위젯
     * 오늘의 축하메시지 카드 1개를 PHP 원본 스타일로 표시합니다.
     */
    import type { WidgetProps } from '$lib/types/widget-props';
    import { onMount } from 'svelte';

    let { config, slot, isEditMode = false }: WidgetProps = $props();

    interface CelebrationBanner {
        id: number;
        title: string;
        content: string;
        image_url: string;
        link_url: string;
        display_date: string;
        is_active: boolean;
        target_member_id?: string;
        target_member_nick?: string;
        target_member_photo?: string;
        external_link?: string;
    }

    let banner = $state<CelebrationBanner | null>(null);
    let gradientNum = $state(1);
    let loading = $state(true);

    function simpleHash(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        return Math.abs(hash);
    }

    onMount(async () => {
        try {
            const res = await fetch('/api/plugins/advertising/banners/today');
            if (res.ok) {
                const data = await res.json();
                const banners: CelebrationBanner[] = data.data ?? [];
                if (banners.length > 0) {
                    banner = banners[Math.floor(Math.random() * banners.length)];
                    const hashSource = banner.target_member_id || String(banner.id);
                    gradientNum = (simpleHash(hashSource) % 5) + 1;
                }
            }
        } catch (e) {
            // 조용히 실패
        } finally {
            loading = false;
        }
    });

    function stripHtml(html: string): string {
        return html.replace(/<[^>]*>/g, '').trim();
    }
</script>

{#if loading}
    <div class="h-24 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-700"></div>
{:else if banner}
    <div class="celeb-card grad-{gradientNum}">
        <div class="celeb-header">
            <span class="icon">🎈</span>
            <span class="celeb-nick"
                >{banner.target_member_nick || banner.title || '축하합니다'}</span
            >
            {#if banner.external_link || banner.link_url}
                <a
                    href={banner.external_link || banner.link_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="header-link"
                >
                    바로가기 →
                </a>
            {/if}
        </div>

        <div class="celeb-body">
            <div class="celeb-profile">
                {#if banner.target_member_photo}
                    <img
                        src={banner.target_member_photo}
                        class="celeb-avatar"
                        alt=""
                        loading="lazy"
                    />
                {:else}
                    <div class="celeb-avatar-placeholder">👤</div>
                {/if}
            </div>

            {#if banner.image_url}
                <a
                    href={banner.link_url || '#'}
                    class="celeb-banner-wrap"
                    target={banner.link_url?.startsWith('http') ? '_blank' : undefined}
                    rel={banner.link_url?.startsWith('http') ? 'noopener noreferrer' : undefined}
                >
                    <img src={banner.image_url} class="celeb-banner" alt="" loading="lazy" />
                    {#if banner.content}
                        <div class="celeb-overlay">
                            <div class="celeb-message">{stripHtml(banner.content)}</div>
                        </div>
                    {/if}
                </a>
            {:else}
                <div class="celeb-no-banner">
                    {#if banner.link_url}
                        <a href={banner.link_url} class="celeb-message-link">
                            {stripHtml(banner.content || banner.title)}
                        </a>
                    {:else}
                        <div class="celeb-message-text">
                            {stripHtml(banner.content || banner.title)}
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .celeb-card {
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        background: white;
    }

    .celeb-header {
        padding: 8px 12px;
        display: flex;
        align-items: center;
        gap: 6px;
        color: white;
        font-weight: 600;
        font-size: 0.8rem;
    }

    .celeb-nick {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .icon {
        flex-shrink: 0;
    }

    .grad-1 .celeb-header {
        background: linear-gradient(135deg, #667eea, #764ba2);
    }
    .grad-2 .celeb-header {
        background: linear-gradient(135deg, #f093fb, #f5576c);
    }
    .grad-3 .celeb-header {
        background: linear-gradient(135deg, #4facfe, #00f2fe);
    }
    .grad-4 .celeb-header {
        background: linear-gradient(135deg, #43e97b, #38f9d7);
    }
    .grad-5 .celeb-header {
        background: linear-gradient(135deg, #fa709a, #fee140);
    }

    .celeb-body {
        position: relative;
        min-height: 60px;
    }

    .celeb-profile {
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 10;
    }

    .celeb-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        border: 3px solid transparent;
        background:
            linear-gradient(white, white) padding-box,
            conic-gradient(from 0deg, red, orange, yellow, green, cyan, blue, violet, red)
                border-box;
        animation: rainbow-rotate 3s linear infinite;
        object-fit: cover;
    }

    @keyframes rainbow-rotate {
        to {
            filter: hue-rotate(360deg);
        }
    }

    .celeb-avatar-placeholder {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: white;
        font-size: 1.2rem;
    }

    .celeb-banner-wrap {
        display: block;
        width: 100%;
        min-height: 70px;
        position: relative;
    }

    .celeb-banner {
        width: 100%;
        height: 100%;
        min-height: 70px;
        max-height: 120px;
        object-fit: cover;
    }

    .celeb-overlay {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        padding: 8px 12px 8px 70px;
        background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
    }

    .celeb-message {
        color: white;
        font-size: 0.75rem;
        font-weight: 500;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .celeb-no-banner {
        padding: 16px 16px 16px 70px;
        background: #f8f9fa;
        min-height: 60px;
        display: flex;
        align-items: center;
    }

    .celeb-message-link {
        color: #333;
        font-size: 0.8rem;
        font-weight: 500;
        line-height: 1.4;
        text-decoration: none;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .celeb-message-link:hover {
        color: #667eea;
        text-decoration: underline;
    }

    .celeb-message-text {
        color: #333;
        font-size: 0.8rem;
        font-weight: 500;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    :global(.dark) .celeb-card {
        background: #2d2d2d;
    }
    :global(.dark) .celeb-no-banner {
        background: #3d3d3d;
    }
    :global(.dark) .celeb-message-link,
    :global(.dark) .celeb-message-text {
        color: #eee;
    }
    :global(.dark) .celeb-message-link:hover {
        color: #a5b4fc;
    }

    .header-link {
        flex-shrink: 0;
        font-size: 0.7rem;
        color: rgba(255, 255, 255, 0.85);
        padding: 3px 8px;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 10px;
        text-decoration: none;
        transition: background 0.2s;
    }

    .header-link:hover {
        background: rgba(255, 255, 255, 0.25);
    }
</style>
