<script lang="ts">
    import { onMount } from 'svelte';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { xpLevelupDetect } from '$lib/stores/xp-levelup-detect.svelte.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
    import TrendingUp from '@lucide/svelte/icons/trending-up';
    import Sparkles from '@lucide/svelte/icons/sparkles';

    let dialogOpen = $state(false);

    // xpLevelupDetect 상태 변경 감지
    $effect(() => {
        if (xpLevelupDetect.showToast) {
            dialogOpen = true;
        }
    });

    // Dialog 닫힐 때 상태 정리
    $effect(() => {
        if (!dialogOpen && xpLevelupDetect.showToast) {
            xpLevelupDetect.dismissToast();
        }
    });

    function handleClose() {
        dialogOpen = false;
    }

    onMount(() => {
        // localStorage 기반 XP 레벨업 감지
        if (authStore.user?.as_level) {
            xpLevelupDetect.checkXpLevelUp(authStore.user.as_level);
        }
    });
</script>

<Dialog.Root bind:open={dialogOpen}>
    <Dialog.Content
        class="border-blue-400/30 bg-gradient-to-b from-blue-50 to-white sm:max-w-sm dark:from-blue-950/20 dark:to-zinc-950"
    >
        <Dialog.Header class="text-center">
            <div class="mx-auto mb-3 flex items-center justify-center gap-2">
                <Sparkles class="h-6 w-6 animate-pulse text-blue-400" />
                <TrendingUp class="h-7 w-7 text-blue-500" />
                <Sparkles class="h-6 w-6 animate-pulse text-blue-400" />
            </div>
            <Dialog.Title class="text-xl font-bold text-blue-600 dark:text-blue-400">
                레벨업!
            </Dialog.Title>
            <Dialog.Description class="text-muted-foreground mt-2 text-sm">
                경험치가 쌓여 레벨이 올랐어요
            </Dialog.Description>
        </Dialog.Header>

        <div class="flex flex-col items-center gap-4 py-4">
            <div class="flex items-center gap-3">
                {#if xpLevelupDetect.previousLevel > 0}
                    <div class="flex items-center gap-1 opacity-50">
                        <LevelBadge level={xpLevelupDetect.previousLevel} size="md" />
                        <span class="text-muted-foreground text-2xl font-bold">
                            Lv.{xpLevelupDetect.previousLevel}
                        </span>
                    </div>
                    <span class="text-muted-foreground text-xl">→</span>
                {/if}
                <div class="flex items-center gap-1">
                    <LevelBadge level={xpLevelupDetect.newLevel} size="md" />
                    <span class="text-4xl font-black text-blue-500 dark:text-blue-400">
                        Lv.{xpLevelupDetect.newLevel}
                    </span>
                </div>
            </div>
        </div>

        <Dialog.Footer class="sm:justify-center">
            <Button onclick={handleClose} variant="outline" class="min-w-[120px]">확인</Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
