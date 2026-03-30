<script lang="ts">
    /**
     * 키워드 블러 처리 컴포넌트
     *
     * PHP customui.full.js의 set_content_blur() 에 대응.
     * 후방/스포일러 등 키워드 블러 전용 — 성인 인증 불필요, 클릭으로 해제.
     */

    interface Props {
        /** 블러 적용 여부 */
        shouldBlur: boolean;
        /** 자식 요소 */
        children: import('svelte').Snippet;
    }

    let { shouldBlur, children }: Props = $props();

    let revealed = $state(false);

    const BOOKKUANG_IMAGE =
        'https://s3.damoang.net/data/editor/b7767-664966b303898-9eea4d0b7513e8395986b5aa7c42d1854c10bc21.webp';

    const isBlurred = $derived(shouldBlur && !revealed);

    function handleReveal(): void {
        revealed = true;
    }

    function handleHide(): void {
        revealed = false;
    }
</script>

{#if isBlurred}
    <div class="relative overflow-hidden">
        <!-- 블러 처리된 콘텐츠 -->
        <div
            class="pointer-events-none select-none"
            style="filter: blur(20px); opacity: 0.3; max-height: 700px; overflow: hidden"
            aria-hidden="true"
        >
            {@render children()}
        </div>

        <!-- 오버레이 -->
        <button
            type="button"
            class="absolute inset-0 flex cursor-pointer flex-col items-center justify-center"
            onclick={handleReveal}
        >
            <img
                src={BOOKKUANG_IMAGE}
                alt="후방/스포일러 주의"
                class="mb-3 h-24 w-24 object-contain"
                onerror={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
            />
            <p class="text-muted-foreground text-sm font-medium">클릭하여 내용 확인</p>
        </button>
    </div>
{:else if shouldBlur && revealed}
    <div>
        {@render children()}
        <div class="mt-4 flex justify-end">
            <button
                type="button"
                class="text-muted-foreground hover:text-foreground rounded bg-black/5 px-2 py-1 text-xs shadow-sm backdrop-blur-sm dark:bg-white/10"
                onclick={handleHide}
            >
                숨기기
            </button>
        </div>
    </div>
{:else}
    {@render children()}
{/if}
