<script lang="ts">
    import { onMount } from 'svelte';
    import type { PageData } from './$types.js';
    import type { AnniversaryDrawResponse } from '$lib/api/types.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import CommemorativePage from '$lib/components/features/content/commemorative-page.svelte';
    import { launchCelebrationConfetti } from '$lib/utils/confetti.js';
    import type { CommemorativePageContent } from '$lib/types/commemorative-page.js';
    import Gift from '@lucide/svelte/icons/gift';
    import PartyPopper from '@lucide/svelte/icons/party-popper';
    import CalendarCheck from '@lucide/svelte/icons/calendar-check';
    import Sparkles from '@lucide/svelte/icons/sparkles';

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
    let isFlipped = $state(initialDrawEntry?.participated ?? false);
    let isRevealing = $state(false);
    let selectedCard = $state<number | null>(initialDrawEntry?.participated ? 0 : null);
    const isLoggedIn = $derived(Boolean(authStore.user?.mb_id));

    const cardImages = [
        'https://damoang.net/emoticons/damoang-emo-028.gif',
        'https://damoang.net/emoticons/damoang-emo-029.gif',
        'https://damoang.net/emoticons/DINKIssTyle-3d-ang-027.webp'
    ];
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
            await launchCelebrationConfetti();
            localStorage.setItem(CONFETTI_DONE_KEY, '1');
        }
    }

    function restoreCachedDrawState() {
        if (drawEntry?.participated || !drawStorageKey) return;

        const cached = localStorage.getItem(drawStorageKey);
        if (!cached) return;

        try {
            const restored = JSON.parse(cached) as AnniversaryDrawResponse;
            drawEntry = restored;
            if (restored.participated) isFlipped = true;
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

            // 카드 뒤집기 연출
            isRevealing = true;
            await new Promise((r) => setTimeout(r, 300));
            isFlipped = true;

            // 뒤집기 완료 후 confetti
            setTimeout(() => {
                launchCelebrationConfetti();
                isRevealing = false;
            }, 800);
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
                    로그인 회원은 1회 참여할 수 있습니다. 카드를 뽑아 결과를 확인하세요!
                </p>

                <!-- 카드 3장 선택 -->
                {#if !isFlipped}
                    <p class="pick-label">카드 한 장을 선택하세요</p>
                {/if}

                <div class="cards-row">
                    {#each cardImages as img, i}
                        <div
                            class="flip-scene"
                            class:selected={selectedCard === i}
                            class:unselected={selectedCard !== null &&
                                selectedCard !== i &&
                                isFlipped}
                        >
                            <div
                                class="flip-card"
                                class:flipped={selectedCard === i && isFlipped}
                                class:revealing={selectedCard === i && isRevealing}
                            >
                                <!-- 카드 뒷면 -->
                                <button
                                    class="flip-face flip-back"
                                    onclick={() => {
                                        if (isFlipped || isSubmitting || selectedCard !== null)
                                            return;
                                        selectedCard = i;
                                        handleDraw();
                                    }}
                                    disabled={isFlipped || isSubmitting}
                                >
                                    <div class="card-back-deco">
                                        <Sparkles class="sparkle s1" />
                                        <Sparkles class="sparkle s2" />
                                    </div>
                                    <div class="card-back-content">
                                        <img src={img} alt="카드 {i + 1}" class="card-back-image" />
                                        <span class="card-back-question">?</span>
                                    </div>
                                    <div class="card-back-label">카드 {i + 1}</div>
                                </button>

                                <!-- 카드 앞면 (결과) -->
                                <div class="flip-face flip-front">
                                    {#if drawEntry?.participated && selectedCard === i}
                                        <div class="card-front-content">
                                            <PartyPopper class="front-icon" />
                                            <p class="front-kicker">뽑기 결과</p>
                                            <div class="front-result">{drawEntry.draw_result}</div>
                                            <div class="front-points">
                                                {drawEntry.point_amount?.toLocaleString()}
                                                <span class="points-unit">P</span>
                                            </div>
                                            <div class="front-schedule">
                                                <CalendarCheck class="h-3.5 w-3.5" />
                                                <span>4/1 이후 지급</span>
                                            </div>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>

                {#if submitError}
                    <p class="error-message">{submitError}</p>
                {/if}

                {#if !isFlipped && !isLoggedIn && isAuthReady}
                    <div class="draw-actions">
                        <Button
                            size="lg"
                            class="draw-button"
                            href="/login?redirect=%2F2nd-anniversary"
                        >
                            로그인 후 참여하기
                        </Button>
                    </div>
                {:else if isFlipped}
                    <p class="draw-done-note">참여해 주셔서 감사합니다!</p>
                {/if}
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
        align-items: center;
        gap: 1.25rem;
    }

    .draw-intro {
        margin: 0;
        color: color-mix(in srgb, var(--foreground) 78%, var(--muted-foreground));
        line-height: 1.85;
        font-size: 1.02rem;
        text-align: center;
    }

    .pick-label {
        margin: 0;
        color: var(--foreground);
        font-size: 1.05rem;
        font-weight: 700;
        text-align: center;
    }

    .cards-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.75rem;
        width: 100%;
        max-width: 540px;
    }

    /* === 카드 뒤집기 === */
    .flip-scene {
        perspective: 1000px;
        width: 100%;
        aspect-ratio: 3 / 4;
        transition:
            opacity 0.5s,
            transform 0.5s;
    }

    .flip-scene.unselected {
        opacity: 0.35;
        transform: scale(0.92);
        pointer-events: none;
    }

    .flip-scene.selected {
        transform: scale(1.04);
    }

    .flip-card {
        position: relative;
        width: 100%;
        height: 100%;
        transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        transform-style: preserve-3d;
    }

    .flip-card.flipped {
        transform: rotateY(180deg);
    }

    .flip-card.revealing {
        animation: card-wobble 0.3s ease-in-out;
    }

    @keyframes card-wobble {
        0%,
        100% {
            transform: rotateZ(0deg);
        }
        25% {
            transform: rotateZ(-3deg) scale(1.02);
        }
        75% {
            transform: rotateZ(3deg) scale(1.02);
        }
    }

    .flip-face {
        position: absolute;
        inset: 0;
        backface-visibility: hidden;
        border-radius: 1.25rem;
        overflow: hidden;
    }

    /* 카드 뒷면 */
    .flip-back {
        background: linear-gradient(145deg, #0f766e, #14b8a6 40%, #0ea5e9);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        box-shadow:
            0 8px 32px rgba(15, 118, 110, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.15);
        border: none;
        cursor: pointer;
        padding: 0;
        color: inherit;
        font: inherit;
        transition: box-shadow 0.2s;
    }

    .flip-back:not(:disabled):hover {
        box-shadow:
            0 12px 40px rgba(15, 118, 110, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }

    .flip-back:disabled {
        cursor: default;
    }

    .card-back-deco {
        position: absolute;
        inset: 0;
        pointer-events: none;
    }

    .sparkle {
        position: absolute;
        color: rgba(255, 255, 255, 0.5);
        animation: sparkle-float 3s ease-in-out infinite;
    }

    .sparkle.s1 {
        top: 12%;
        left: 15%;
        width: 20px;
        height: 20px;
        animation-delay: 0s;
    }
    .sparkle.s2 {
        top: 18%;
        right: 12%;
        width: 16px;
        height: 16px;
        animation-delay: 0.8s;
    }
    .sparkle.s3 {
        bottom: 20%;
        left: 10%;
        width: 14px;
        height: 14px;
        animation-delay: 1.6s;
    }
    .sparkle.s4 {
        bottom: 15%;
        right: 18%;
        width: 18px;
        height: 18px;
        animation-delay: 2.4s;
    }

    @keyframes sparkle-float {
        0%,
        100% {
            opacity: 0.3;
            transform: scale(0.8) rotate(0deg);
        }
        50% {
            opacity: 1;
            transform: scale(1.2) rotate(180deg);
        }
    }

    .card-back-content {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
    }

    .card-back-image {
        width: min(80px, 50%);
        height: auto;
        filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.2));
    }

    .card-back-question {
        font-size: 2.2rem;
        font-weight: 900;
        color: rgba(255, 255, 255, 0.9);
        text-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: question-pulse 2s ease-in-out infinite;
    }

    @keyframes question-pulse {
        0%,
        100% {
            transform: scale(1);
            opacity: 0.85;
        }
        50% {
            transform: scale(1.1);
            opacity: 1;
        }
    }

    .card-back-label {
        color: rgba(255, 255, 255, 0.7);
        font-size: 0.88rem;
        font-weight: 600;
        letter-spacing: 0.05em;
    }

    /* 카드 앞면 */
    .flip-front {
        transform: rotateY(180deg);
        background: linear-gradient(
            145deg,
            color-mix(in srgb, var(--background) 94%, var(--primary)),
            color-mix(in srgb, var(--background) 98%, var(--canvas))
        );
        border: 2px solid color-mix(in srgb, var(--primary) 30%, var(--border));
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow:
            0 8px 32px color-mix(in srgb, var(--primary) 15%, transparent),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }

    .card-front-content {
        text-align: center;
        padding: 1rem;
    }

    :global(.front-icon) {
        width: 2rem;
        height: 2rem;
        color: var(--primary);
        margin: 0 auto 1rem;
        animation: icon-bounce 0.6s ease-out;
    }

    @keyframes icon-bounce {
        0% {
            transform: scale(0);
            opacity: 0;
        }
        60% {
            transform: scale(1.3);
        }
        100% {
            transform: scale(1);
            opacity: 1;
        }
    }

    .front-kicker {
        margin: 0 0 0.5rem;
        color: var(--primary);
        font-size: 0.85rem;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }

    .front-result {
        color: var(--foreground);
        font-size: clamp(1rem, 3vw, 1.4rem);
        font-weight: 800;
        line-height: 1.3;
        letter-spacing: -0.02em;
    }

    .front-points {
        margin-top: 0.5rem;
        color: color-mix(in srgb, var(--primary) 88%, var(--foreground));
        font-size: 1.3rem;
        font-weight: 900;
    }

    .points-unit {
        font-size: 0.9rem;
        font-weight: 600;
        opacity: 0.8;
    }

    .front-schedule {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        margin-top: 1rem;
        padding: 0.4rem 0.85rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--primary) 10%, var(--background));
        color: var(--primary);
        font-size: 0.82rem;
        font-weight: 600;
    }

    /* === 버튼 & 하단 === */
    .draw-actions {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
    }

    :global(.draw-button) {
        width: 100%;
        max-width: 300px;
        height: 3.2rem;
        font-size: 1.05rem;
        font-weight: 700;
        border-radius: 0.85rem;
    }

    .draw-done-note {
        margin: 0;
        text-align: center;
        color: var(--muted-foreground);
        font-size: 0.95rem;
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

        .cards-row {
            gap: 1.25rem;
        }
    }
</style>
