<script lang="ts">
    import { onMount } from 'svelte';
    import { sseStore } from '$lib/stores/sse.svelte.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { levelupDetect } from '$lib/stores/levelup-detect.svelte.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
    import Star from '@lucide/svelte/icons/star';
    import PartyPopper from '@lucide/svelte/icons/party-popper';

    let dialogOpen = $state(false);

    // levelupDetect 상태 변경 감지
    $effect(() => {
        if (levelupDetect.showCelebration) {
            dialogOpen = true;
            launchConfetti();
            playFanfare();
        }
    });

    // Dialog 닫힐 때 상태 정리
    $effect(() => {
        if (!dialogOpen && levelupDetect.showCelebration) {
            levelupDetect.dismissCelebration();
        }
    });

    async function launchConfetti() {
        try {
            const confetti = (await import('canvas-confetti')).default;
            // 첫 번째 발사 — 왼쪽에서
            confetti({
                particleCount: 80,
                spread: 70,
                origin: { x: 0.2, y: 0.6 },
                colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#DDA0DD']
            });
            // 두 번째 발사 — 오른쪽에서
            setTimeout(() => {
                confetti({
                    particleCount: 80,
                    spread: 70,
                    origin: { x: 0.8, y: 0.6 },
                    colors: ['#FFD700', '#FFEAA7', '#96CEB4', '#F7DC6F', '#BB8FCE']
                });
            }, 200);
            // 세 번째 발사 — 위에서 쏟아지기
            setTimeout(() => {
                confetti({
                    particleCount: 100,
                    spread: 160,
                    startVelocity: 30,
                    origin: { x: 0.5, y: 0 },
                    colors: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#DDA0DD', '#98D8C8']
                });
            }, 500);
        } catch {
            // canvas-confetti 로드 실패 시 무시
        }
    }

    function playFanfare() {
        try {
            const audio = new Audio('/sounds/levelup-fanfare.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => {
                // autoplay 차단 시 무시 (모바일 등)
            });
        } catch {
            // 사운드 재생 실패 시 무시
        }
    }

    function handleClose() {
        dialogOpen = false;
    }

    onMount(() => {
        // localStorage 기반 레벨업 감지
        if (authStore.user?.as_level) {
            levelupDetect.checkLevelUp(authStore.user.as_level);
        }

        // SSE 보조 리스너 (관리자 수동 승급 시)
        const unsub = sseStore.onNotification((noti) => {
            if (noti.type === 'levelup') {
                const match = noti.content?.match(/레벨\s*(\d+)/);
                levelupDetect.triggerCelebration(match ? parseInt(match[1]) : 0);
            }
        });
        return unsub;
    });
</script>

<Dialog.Root bind:open={dialogOpen}>
    <Dialog.Content
        class="border-yellow-400/30 bg-gradient-to-b from-yellow-50 to-white sm:max-w-md dark:from-yellow-950/20 dark:to-zinc-950"
    >
        <Dialog.Header class="text-center">
            <div class="mx-auto mb-3 flex items-center justify-center gap-2">
                <Star class="h-7 w-7 animate-pulse text-yellow-400" />
                <PartyPopper class="h-8 w-8 text-yellow-500" />
                <Star class="h-7 w-7 animate-pulse text-yellow-400" />
            </div>
            <Dialog.Title class="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                레벨이 올랐어요!
            </Dialog.Title>
            <Dialog.Description class="text-muted-foreground mt-2 text-sm">
                꾸준히 활동해주셔서 감사합니다
            </Dialog.Description>
        </Dialog.Header>

        <div class="flex flex-col items-center gap-4 py-4">
            <!-- 레벨 표시 -->
            <div class="flex items-center gap-3">
                {#if levelupDetect.previousLevel > 0}
                    <div class="flex items-center gap-1 opacity-50">
                        <LevelBadge level={levelupDetect.previousLevel} size="md" />
                        <span class="text-muted-foreground text-2xl font-bold">
                            Lv.{levelupDetect.previousLevel}
                        </span>
                    </div>
                    <span class="text-muted-foreground text-xl">→</span>
                {/if}
                <div class="flex items-center gap-1">
                    <LevelBadge level={levelupDetect.newLevel} size="md" />
                    <span class="text-4xl font-black text-yellow-500 dark:text-yellow-400">
                        Lv.{levelupDetect.newLevel}
                    </span>
                </div>
            </div>

            <!-- 축하 메시지 -->
            <p class="text-muted-foreground text-center text-sm leading-relaxed">
                축하드려요! 앞으로도 즐거운 활동 부탁드립니다.
            </p>
        </div>

        <Dialog.Footer class="sm:justify-center">
            <Button onclick={handleClose} class="min-w-[120px]">확인</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
