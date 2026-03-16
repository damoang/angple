<script lang="ts">
    import { onMount } from 'svelte';
    import { toast } from 'svelte-sonner';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { xpLevelupDetect } from '$lib/stores/xp-levelup-detect.svelte.js';

    // xpLevelupDetect 상태 변경 감지 → toast 표시
    $effect(() => {
        if (xpLevelupDetect.showToast) {
            const prev = xpLevelupDetect.previousLevel;
            const next = xpLevelupDetect.newLevel;
            const msg = prev > 0 ? `Lv.${prev} → Lv.${next}` : `Lv.${next}`;

            toast.success(`레벨업! ${msg}`, {
                description: '경험치가 쌓여 레벨이 올랐어요!',
                duration: 4000
            });

            xpLevelupDetect.dismissToast();
        }
    });

    onMount(() => {
        // localStorage 기반 XP 레벨업 감지
        if (authStore.user?.as_level) {
            xpLevelupDetect.checkXpLevelUp(authStore.user.as_level);
        }
    });
</script>
