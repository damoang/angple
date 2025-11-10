<script lang="ts">
    let { headlines }: { headlines: string[] } = $props();

    let currentIndex = $state(0);

    // Svelte 5 Runes: $effect로 라이프사이클 자동 관리
    $effect(() => {
        if (headlines.length <= 1) return;

        currentIndex = 0;

        const intervalId = setInterval(() => {
            currentIndex = (currentIndex + 1) % headlines.length;
        }, 4000);

        // cleanup 함수: 컴포넌트 언마운트 또는 headlines 변경 시 자동 실행
        return () => clearInterval(intervalId);
    });
</script>

<div class="relative h-5 overflow-hidden">
    {#each headlines as headline, i}
        <p
            class="absolute inset-0 truncate text-sm font-medium text-blue-800 transition-all duration-500 dark:text-blue-200
                {i === currentIndex
                ? 'translate-y-0 opacity-100'
                : i < currentIndex
                  ? '-translate-y-full opacity-0'
                  : 'translate-y-full opacity-0'}"
        >
            {headline}
        </p>
    {/each}
</div>
