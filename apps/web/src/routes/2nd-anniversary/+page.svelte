<script lang="ts">
    import { onMount } from 'svelte';
    import type { PageData } from './$types.js';
    import type { AnniversaryDrawResponse } from '$lib/api/types.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import CommemorativePage from '$lib/components/features/content/commemorative-page.svelte';
    import { launchSidesConfetti } from '$lib/utils/confetti.js';
    import type { CommemorativePageContent } from '$lib/types/commemorative-page.js';
    import Gift from '@lucide/svelte/icons/gift';
    import PartyPopper from '@lucide/svelte/icons/party-popper';
    import CalendarCheck from '@lucide/svelte/icons/calendar-check';

    const VISIT_COUNT_KEY = 'damoang_2nd_anniversary_visit_count';
    const CONFETTI_DONE_KEY = 'damoang_2nd_anniversary_confetti_done';
    const DRAW_STATE_PREFIX = 'damoang_2nd_anniversary_draw_state';
    const pageContent: CommemorativePageContent = {
        eyebrow: '2nd Anniversary',
        title: '다모앙 2주년입니다 🎉',
        description: '다모앙 2주년을 맞아 감사의 마음을 전하고, 랜덤 포인트 뽑기를 진행합니다.',
        heroParagraphs: [
            '작은 목소리들이 모여 큰 울림이 되었고, 그 울림이 지금의 다모앙을 만들었습니다.',
            '다모앙은 누군가가 완성한 공간이 아니라, 함께 참여하고 함께 키워 온 커뮤니티입니다.',
            '어느덧 2주년을 맞이하게 되었네요 😊 함께해 주신 모든 분들께 진심으로 감사드립니다.'
        ],
        heroImage: {
            url: 'https://damoang.net/emoticons/DINKIssTyle-ang-025.webp',
            alt: '다모앙 2주년을 기념하는 앙 캐릭터 이미지'
        },
        noticeParagraphs: [
            '2주년을 맞아 로그인 회원 대상 랜덤 포인트 뽑기를 준비했습니다.',
            '회원당 1회 참여할 수 있으며, 포인트는 4월 1일 이후 순차 지급됩니다.'
        ],
        closingParagraphs: ['앞으로의 시간도 지금처럼, 함께 만들어 가겠습니다.', '감사합니다.'],
        closingImage: {
            url: 'https://damoang.net/emoticons/DINKIssTyle-3d-ang-025.webp',
            alt: '감사의 마음을 전하는 다모앙 앙 캐릭터 이미지'
        }
    };

    let { data }: { data: PageData } = $props();
    const initialDrawEntry = data.drawEntry ?? null;
    let drawEntry = $state<AnniversaryDrawResponse | null>(initialDrawEntry);
    let isSubmitting = $state(false);
    let submitError = $state<string | null>(null);
    const isLoggedIn = $derived(Boolean(authStore.user?.mb_id));
    const isAuthReady = $derived(!authStore.isLoading);
    const drawStorageKey = $derived(
        authStore.user?.mb_id ? `${DRAW_STATE_PREFIX}:${authStore.user.mb_id}` : null
    );

    onMount(() => {
        handleVisitConfetti();
        restoreCachedDrawState();
    });

    async function handleVisitConfetti() {
        if (localStorage.getItem(CONFETTI_DONE_KEY) === '1') return;

        const currentCount = Number(localStorage.getItem(VISIT_COUNT_KEY) || '0') + 1;
        localStorage.setItem(VISIT_COUNT_KEY, String(currentCount));

        if (currentCount === 2) {
            await launchSidesConfetti();
            localStorage.setItem(CONFETTI_DONE_KEY, '1');
        }
    }

    function restoreCachedDrawState() {
        if (drawEntry?.participated || !drawStorageKey) return;

        const cached = localStorage.getItem(drawStorageKey);
        if (!cached) return;

        try {
            drawEntry = JSON.parse(cached) as AnniversaryDrawResponse;
        } catch {
            localStorage.removeItem(drawStorageKey);
        }
    }

    $effect(() => {
        if (!drawEntry?.participated || !drawStorageKey) return;
        localStorage.setItem(drawStorageKey, JSON.stringify(drawEntry));
    });

    async function handleDraw() {
        submitError = null;

        if (!authStore.user?.mb_id) {
            const redirect = encodeURIComponent('/2nd-anniversary');
            window.location.href = `/login?redirect=${redirect}`;
            return;
        }

        isSubmitting = true;
        try {
            const response = await fetch('/api/events/anniversary-draw', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' }
            });
            const json = await response.json().catch(() => null);
            if (!response.ok || !json?.success) {
                throw new Error(json?.error?.message || '이벤트 참여에 실패했습니다.');
            }

            drawEntry = json.data as AnniversaryDrawResponse;
            await launchSidesConfetti();
        } catch (error) {
            submitError = error instanceof Error ? error.message : '이벤트 참여에 실패했습니다.';
        } finally {
            isSubmitting = false;
        }
    }
</script>

<svelte:head>
    <title>{data.title} | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
    <meta name="description" content={pageContent.description} />
</svelte:head>

<div class="anniversary-wrapper">
    <CommemorativePage content={pageContent} />

    <section class="draw-shell">
        <div class="draw-card">
            <div class="draw-header">
                <Gift class="text-primary h-6 w-6" />
                <h2>2주년 랜덤 포인트 뽑기</h2>
            </div>

            <div class="draw-content">
                <p class="draw-intro">
                    로그인 회원은 1회 참여할 수 있습니다. 결과는 바로 확인할 수 있고, 포인트는 4월
                    1일 이후 순차 지급됩니다.
                </p>

                {#if drawEntry?.participated}
                    <div class="result-panel success">
                        <div class="result-icon">
                            <PartyPopper class="h-8 w-8" />
                        </div>
                        <p class="result-kicker">당신의 2주년 뽑기 결과</p>
                        <div class="result-main">{drawEntry.draw_result}</div>
                        <div class="result-points">
                            {drawEntry.point_amount?.toLocaleString()} 포인트
                        </div>
                        <div class="result-schedule">
                            <CalendarCheck class="h-4 w-4" />
                            <span>4월 1일 이후 순차 지급 예정</span>
                        </div>
                    </div>
                {:else}
                    <div class="result-panel pending">
                        <div class="result-icon pending-icon">
                            <Gift class="h-8 w-8" />
                        </div>
                        <p class="result-kicker">참여 안내</p>
                        <div class="result-main">가볍게 한 번 뽑아 보세요</div>
                        <p class="result-note">
                            회원당 1회 참여 가능하며, 포인트는 4월 1일 이후 순차 지급됩니다.
                        </p>
                    </div>
                {/if}

                {#if submitError}
                    <p class="error-message">{submitError}</p>
                {/if}

                <div class="draw-actions">
                    <Button
                        size="lg"
                        class="draw-button"
                        onclick={handleDraw}
                        disabled={isSubmitting || drawEntry?.participated || !isAuthReady}
                    >
                        {#if isSubmitting}
                            참여 처리 중...
                        {:else if drawEntry?.participated}
                            이미 참여했습니다
                        {:else if !isAuthReady}
                            로딩 중...
                        {:else if isLoggedIn}
                            뽑기 참여하기
                        {:else}
                            로그인 후 참여하기
                        {/if}
                    </Button>
                </div>
            </div>
        </div>
    </section>
</div>

<style>
    .anniversary-wrapper {
        background: radial-gradient(
                circle at top,
                color-mix(in srgb, var(--color-dusty-500) 14%, transparent),
                transparent 34%
            ),
            linear-gradient(
                180deg,
                color-mix(in srgb, var(--canvas) 94%, var(--background)) 0%,
                color-mix(in srgb, var(--background) 82%, var(--color-dusty-100)) 54%,
                var(--background) 100%
            );
        padding-bottom: 4rem;
    }

    .draw-shell {
        margin: 0 auto;
        max-width: 880px;
        padding: 0 1rem;
    }

    .draw-card {
        border-radius: 1.5rem;
        border: 1px solid color-mix(in srgb, var(--border) 78%, var(--primary));
        background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--background) 96%, var(--canvas)),
            color-mix(in srgb, var(--background) 88%, var(--color-dusty-100))
        );
        box-shadow: 0 18px 42px color-mix(in srgb, var(--foreground) 8%, transparent);
        padding: 2rem;
    }

    .draw-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
    }

    .draw-header h2 {
        margin: 0;
        font-size: 1.35rem;
        font-weight: 800;
        letter-spacing: -0.02em;
    }

    .draw-content {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
    }

    .draw-intro {
        margin: 0;
        color: color-mix(in srgb, var(--foreground) 78%, var(--muted-foreground));
        line-height: 1.85;
        font-size: 1.02rem;
    }

    .result-panel {
        border-radius: 1.25rem;
        padding: 1.75rem;
        text-align: center;
    }

    .result-panel.success {
        border: 1px solid color-mix(in srgb, var(--primary) 40%, var(--border));
        background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--primary) 6%, var(--background)),
            color-mix(in srgb, var(--primary) 3%, var(--canvas))
        );
    }

    .result-panel.pending {
        border: 1px solid color-mix(in srgb, var(--border) 78%, var(--primary));
        background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--background) 94%, var(--color-dusty-100)),
            color-mix(in srgb, var(--canvas) 86%, var(--color-dusty-200))
        );
    }

    .result-icon {
        display: flex;
        justify-content: center;
        margin-bottom: 1rem;
        color: var(--primary);
    }

    .pending-icon {
        color: var(--muted-foreground);
    }

    .result-kicker {
        margin: 0 0 0.5rem;
        color: var(--primary);
        font-size: 0.85rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    .result-main {
        color: var(--foreground);
        font-size: clamp(1.5rem, 3.2vw, 2.2rem);
        font-weight: 800;
        line-height: 1.2;
        letter-spacing: -0.02em;
    }

    .result-points {
        margin-top: 0.75rem;
        color: color-mix(in srgb, var(--primary) 88%, var(--foreground));
        font-size: 1.2rem;
        font-weight: 800;
    }

    .result-schedule {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        margin-top: 1rem;
        padding: 0.4rem 0.85rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--primary) 10%, var(--background));
        color: var(--primary);
        font-size: 0.88rem;
        font-weight: 600;
    }

    .result-note {
        margin: 0.85rem 0 0;
        color: color-mix(in srgb, var(--foreground) 68%, var(--muted-foreground));
        line-height: 1.7;
        font-size: 0.95rem;
    }

    .draw-actions {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
    }

    :global(.draw-button) {
        width: 100%;
        max-width: 320px;
        height: 3.2rem;
        font-size: 1.05rem;
        font-weight: 700;
        border-radius: 0.85rem;
    }

    .error-message {
        margin: 0;
        text-align: center;
        color: var(--destructive);
        font-size: 0.95rem;
        font-weight: 600;
    }

    @media (min-width: 768px) {
        .draw-shell {
            padding: 0 1.5rem;
        }

        .draw-card {
            padding: 2.5rem;
        }
    }
</style>
