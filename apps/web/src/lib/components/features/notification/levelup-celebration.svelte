<script lang="ts">
    import { onMount } from 'svelte';
    import { sseStore } from '$lib/stores/sse.svelte.js';
    import Star from '@lucide/svelte/icons/star';

    let show = $state(false);
    let level = $state(0);
    let particles = $state<{ id: number; x: number; y: number; color: string; delay: number }[]>(
        []
    );

    const colors = [
        '#FFD700',
        '#FF6B6B',
        '#4ECDC4',
        '#45B7D1',
        '#96CEB4',
        '#FFEAA7',
        '#DDA0DD',
        '#98D8C8',
        '#F7DC6F',
        '#BB8FCE'
    ];

    function triggerCelebration(newLevel: number) {
        level = newLevel;
        // 파티클 생성
        particles = Array.from({ length: 60 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            color: colors[Math.floor(Math.random() * colors.length)],
            delay: Math.random() * 0.5
        }));
        show = true;
        setTimeout(() => {
            show = false;
            particles = [];
        }, 4000);
    }

    onMount(() => {
        const unsub = sseStore.onNotification((noti) => {
            if (noti.type === 'levelup') {
                const match = noti.content?.match(/레벨\s*(\d+)/);
                triggerCelebration(match ? parseInt(match[1]) : 0);
            }
        });
        return unsub;
    });
</script>

{#if show}
    <div class="pointer-events-none fixed inset-0 z-[9999]" aria-hidden="true">
        <!-- 꽃가루/confetti 파티클 -->
        {#each particles as p (p.id)}
            <div
                class="confetti-particle absolute"
                style="left:{p.x}%;top:-5%;background:{p.color};animation-delay:{p.delay}s"
            ></div>
        {/each}

        <!-- 중앙 배너 -->
        <div class="flex h-full items-center justify-center">
            <div class="levelup-banner rounded-2xl bg-black/80 px-8 py-6 text-center shadow-2xl">
                <div class="mb-2 flex items-center justify-center gap-2">
                    <Star class="h-8 w-8 text-yellow-400" />
                    <Star class="h-6 w-6 text-yellow-300" />
                    <Star class="h-8 w-8 text-yellow-400" />
                </div>
                <p class="text-lg font-bold text-white">레벨 업!</p>
                {#if level > 0}
                    <p class="mt-1 text-3xl font-black text-yellow-400">Lv. {level}</p>
                {/if}
            </div>
        </div>
    </div>
{/if}

<style>
    .confetti-particle {
        width: 8px;
        height: 8px;
        border-radius: 2px;
        animation: confetti-fall 2.5s ease-in forwards;
    }

    @keyframes confetti-fall {
        0% {
            transform: translateY(0) rotate(0deg) scale(1);
            opacity: 1;
        }
        100% {
            transform: translateY(110vh) rotate(720deg) scale(0.3);
            opacity: 0;
        }
    }

    .levelup-banner {
        animation: levelup-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }

    @keyframes levelup-pop {
        0% {
            transform: scale(0);
            opacity: 0;
        }
        100% {
            transform: scale(1);
            opacity: 1;
        }
    }
</style>
