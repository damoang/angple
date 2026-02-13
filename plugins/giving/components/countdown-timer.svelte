<script lang="ts">
    import { onMount } from 'svelte';

    let { endTime, class: className = '' }: { endTime: string; class?: string } = $props();

    let remaining = $state('');
    let isUrgent = $state(false);
    let isEnded = $state(false);

    function update() {
        const end = new Date(endTime).getTime();
        const now = Date.now();
        const diff = end - now;

        if (diff <= 0) {
            remaining = '종료';
            isEnded = true;
            isUrgent = false;
            return;
        }

        isUrgent = diff <= 24 * 60 * 60 * 1000;
        isEnded = false;

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        if (days > 0) {
            remaining = `${days}일 ${hours}시간`;
        } else if (hours > 0) {
            remaining = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        } else {
            remaining = `${minutes}:${String(seconds).padStart(2, '0')}`;
        }
    }

    onMount(() => {
        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    });
</script>

<span
    class="inline-flex items-center gap-1 text-xs font-medium tabular-nums {isEnded
        ? 'text-muted-foreground'
        : isUrgent
          ? 'text-red-500'
          : 'text-foreground'} {className}"
>
    {#if !isEnded && isUrgent}
        <span class="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"></span>
    {/if}
    {remaining}
</span>
