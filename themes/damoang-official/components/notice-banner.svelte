<script lang="ts">
    let isVisible = $state(true);

    function closeBanner() {
        isVisible = false;
    }
</script>

{#if isVisible}
    <div class="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
        <div class="container mx-auto px-4">
            <div class="flex items-center justify-between gap-4 py-3">
                <div class="flex items-center gap-3">
                    <span class="text-xl">📣</span>
                    <p class="text-sm font-medium">
                        🎉 <strong>다모앙 2026</strong> 새로운 테마 시스템이 출시되었습니다!
                        <a href="/themes" class="underline hover:no-underline">자세히 보기 →</a>
                    </p>
                </div>
                <button
                    onclick={closeBanner}
                    class="flex-shrink-0 rounded-lg p-1 text-xl hover:bg-white/20"
                    aria-label="배너 닫기"
                >
                    ✕
                </button>
            </div>
        </div>
    </div>
{/if}
