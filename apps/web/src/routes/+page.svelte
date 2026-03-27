<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { WidgetRenderer } from '$lib/components/widget-renderer';
    import { indexWidgetsStore } from '$lib/stores/index-widgets.svelte';
    import { widgetLayoutStore } from '$lib/stores/widget-layout.svelte';
    import { untrack } from 'svelte';
    import { SeoHead, createWebSiteJsonLd, getSiteUrl } from '$lib/seo/index.js';
    import type { SeoConfig } from '$lib/seo/types.js';
    import { Button } from '$lib/components/ui/button/index.js';

    let { data } = $props();
    const ANNIVERSARY_POPUP_SEEN_KEY = 'damoang_2nd_anniversary_home_seen_2026';
    const ANNIVERSARY_RELEASE_AT_KST = '2026-03-28T00:00:00+09:00';
    let anniversaryOpen = $state(false);

    // SSR 데이터 즉시 스토어 초기화 (hydration 전에 실행)
    indexWidgetsStore.initFromServer(data.indexWidgets);
    widgetLayoutStore.initFromServer(data.widgetLayout, data.sidebarWidgetLayout);

    // SSR 데이터 변경 시 스토어 동기화 (SPA 내비게이션 대응)
    $effect(() => {
        const widgets = data.indexWidgets;
        const layout = data.widgetLayout;
        const sidebarLayout = data.sidebarWidgetLayout;
        untrack(() => {
            indexWidgetsStore.initFromServer(widgets);
            widgetLayoutStore.initFromServer(layout, sidebarLayout);
        });
    });

    // SEO 설정 (홈페이지)
    const siteName = import.meta.env.VITE_SITE_NAME || '다모앙';
    const siteTagline = '종합 포털 커뮤니티';
    const homeTitle = `${siteName} | ${siteTagline}`;
    const homeDescription = `${siteName} ${siteTagline} - 자유로운 소통의 공간 | Damoang Community Portal`;

    const seoConfig: SeoConfig = $derived({
        meta: {
            title: homeTitle,
            description: homeDescription,
            canonicalUrl: getSiteUrl(),
            includeSiteName: false
        },
        og: {
            title: homeTitle,
            description: homeDescription,
            type: 'website',
            url: getSiteUrl()
        },
        jsonLd: [createWebSiteJsonLd(`${getSiteUrl()}/search?stx={search_term_string}`)]
    });

    const leftMessageVisible = $derived(page.url.searchParams.get('left') === '1');

    onMount(() => {
        if (typeof localStorage === 'undefined') return;
        if (localStorage.getItem(ANNIVERSARY_POPUP_SEEN_KEY) === '1') return;
        if (!isAnniversaryReleased()) return;

        anniversaryOpen = true;
        localStorage.setItem(ANNIVERSARY_POPUP_SEEN_KEY, '1');
        launchAnniversaryConfetti();
    });

    function isAnniversaryReleased() {
        if (typeof window !== 'undefined' && window.location.hostname === 'dev.damoang.net') {
            return true;
        }
        return Date.now() >= new Date(ANNIVERSARY_RELEASE_AT_KST).getTime();
    }

    async function launchAnniversaryConfetti() {
        try {
            const moduleName = 'canvas-confetti';
            const confetti = (await import(/* @vite-ignore */ moduleName)).default;

            confetti({
                particleCount: 90,
                spread: 72,
                origin: { x: 0.18, y: 0.58 },
                colors: ['#0f766e', '#14b8a6', '#f59e0b', '#fb923c', '#fef3c7']
            });

            setTimeout(() => {
                confetti({
                    particleCount: 100,
                    spread: 86,
                    origin: { x: 0.82, y: 0.58 },
                    colors: ['#0f766e', '#0ea5e9', '#facc15', '#fb923c', '#fff7ed']
                });
            }, 180);

            setTimeout(() => {
                confetti({
                    particleCount: 120,
                    spread: 150,
                    startVelocity: 26,
                    origin: { x: 0.5, y: 0 },
                    colors: ['#0f766e', '#14b8a6', '#f59e0b', '#fb923c', '#fef3c7', '#fff7ed']
                });
            }, 420);
        } catch {
            // ignore
        }
    }
</script>

<SeoHead config={seoConfig} />

{#if leftMessageVisible}
    <div class="mx-auto mb-4 max-w-5xl px-4 pt-4">
        <div
            class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
            회원 탈퇴가 완료되었습니다. 안전하게 로그아웃되었습니다.
        </div>
    </div>
{/if}

{#if anniversaryOpen}
    <div
        class="anniversary-popup-backdrop"
        role="button"
        tabindex="0"
        aria-label="2주년 안내 닫기"
        onclick={() => (anniversaryOpen = false)}
        onkeydown={(e) => {
            if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                anniversaryOpen = false;
            }
        }}
    >
        <div
            class="anniversary-popup"
            role="dialog"
            tabindex="-1"
            aria-modal="true"
            aria-labelledby="anniversary-popup-title"
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
        >
            <div class="anniversary-popup__header">
                <h2 id="anniversary-popup-title">다모앙 2주년입니다 🎉</h2>
                <p>
                    작은 목소리들이 모여 큰 울림이 되었고, 그 울림이 지금의 다모앙을 만들었습니다.
                </p>
            </div>

            <div class="anniversary-popup__body">
                <img
                    src="https://damoang.net/emoticons/DINKIssTyle-ang-025.webp"
                    alt="다모앙 2주년을 기념하는 앙 캐릭터 이미지"
                    class="anniversary-popup__image"
                />

                <div class="anniversary-popup__copy">
                    <p>다모앙은 함께 참여하고 함께 키워 온 커뮤니티입니다.</p>
                    <p>
                        어느덧 2주년을 맞이하게 되었네요. 함께해 주신 모든 분들께 진심으로
                        감사드립니다.
                    </p>
                </div>
            </div>

            <div class="anniversary-popup__footer">
                <Button href="/2nd-anniversary" variant="outline">자세히 보기</Button>
                <Button onclick={() => (anniversaryOpen = false)}>확인</Button>
            </div>
        </div>
    </div>
{/if}

<!-- 통합 위젯 렌더러로 메인 영역 렌더링 (추천글 SSR 프리페치 포함) -->
<WidgetRenderer
    zone="main"
    prefetchDataMap={{
        recommended: data.recommendedData
            ? { data: data.recommendedData, period: data.recommendedPeriod }
            : undefined,
        explore: data.exploreData ? { data: data.exploreData } : undefined,
        'empathy-explore-row': {
            recommended: data.recommendedData
                ? { data: data.recommendedData, period: data.recommendedPeriod }
                : undefined,
            explore: data.exploreData ? { data: data.exploreData } : undefined
        },
        celebration: (data.celebrationRecent ?? data.celebration)?.length
            ? { data: data.celebrationRecent ?? data.celebration }
            : undefined
    }}
/>

<style>
    .anniversary-popup-backdrop {
        position: fixed;
        inset: 0;
        z-index: 70;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: color-mix(in srgb, var(--foreground) 24%, transparent);
    }

    .anniversary-popup {
        width: min(100%, 36rem);
        border-radius: 1rem;
        border: 1px solid color-mix(in srgb, var(--border) 78%, var(--primary));
        background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--background) 94%, var(--canvas)),
            color-mix(in srgb, var(--background) 86%, var(--color-dusty-100))
        );
        padding: 1.5rem;
        box-shadow: 0 24px 56px color-mix(in srgb, var(--foreground) 12%, transparent);
    }

    .anniversary-popup__header {
        text-align: center;
    }

    .anniversary-popup__header h2 {
        margin: 0;
        font-size: 1.35rem;
        font-weight: 800;
        letter-spacing: -0.02em;
    }

    .anniversary-popup__header p {
        margin: 0.75rem 0 0;
        line-height: 1.75;
        color: var(--muted-foreground);
    }

    .anniversary-popup__body {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        padding: 0.5rem 0 0.25rem;
    }

    .anniversary-popup__image {
        width: min(100%, 180px);
        height: auto;
        object-fit: contain;
        filter: drop-shadow(0 12px 24px color-mix(in srgb, var(--foreground) 16%, transparent));
    }

    .anniversary-popup__copy {
        text-align: center;
        color: color-mix(in srgb, var(--foreground) 84%, var(--muted-foreground));
        line-height: 1.8;
    }

    .anniversary-popup__copy p {
        margin: 0;
    }

    .anniversary-popup__copy p + p {
        margin-top: 0.75rem;
    }

    .anniversary-popup__footer {
        display: flex;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 0.75rem;
    }
</style>
