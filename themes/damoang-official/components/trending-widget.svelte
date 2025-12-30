<script lang="ts">
    const trendingNow = [
        { emoji: '🔥', text: 'AI가 선정한 오늘의 HOT 토픽', color: 'from-orange-500 to-red-500' },
        { emoji: '⚡', text: '실시간 급상승 게시글', color: 'from-yellow-500 to-orange-500' },
        { emoji: '💎', text: '이 주의 베스트', color: 'from-purple-500 to-pink-500' }
    ];
</script>

<div
    class="mb-6 overflow-hidden rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 p-6 text-white shadow-lg"
>
    <div class="mb-4 flex items-center gap-2">
        <span class="text-2xl">✨</span>
        <h2 class="text-xl font-bold">지금 다모앙에서 뜨는 중</h2>
    </div>

    <div class="grid gap-3 md:grid-cols-3">
        {#each trendingNow as item}
            <a
                href="/trending"
                class="flex items-center gap-3 rounded-lg bg-white/10 p-4 backdrop-blur-sm transition-all hover:scale-105 hover:bg-white/20"
            >
                <span class="text-3xl">{item.emoji}</span>
                <div>
                    <p class="text-sm font-medium">{item.text}</p>
                    <p class="mt-1 text-xs opacity-80">지금 확인하기 →</p>
                </div>
            </a>
        {/each}
    </div>
</div>
