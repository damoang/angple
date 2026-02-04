<script lang="ts">
    /**
     * 19금 콘텐츠 블러 처리 컴포넌트
     *
     * ang-gnu의 blur.js 로직을 Svelte 5 컴포넌트로 포팅.
     * 로그인한 성인 인증 사용자만 콘텐츠를 볼 수 있습니다.
     */

    import { authStore } from '$lib/stores/auth.svelte.js';
    import EyeOff from '@lucide/svelte/icons/eye-off';
    import Eye from '@lucide/svelte/icons/eye';

    interface Props {
        /** 19금 콘텐츠 여부 */
        isAdult: boolean;
        /** 블러 강도 (px) */
        blurAmount?: number;
        /** 클릭으로 일시적으로 해제 허용 */
        allowReveal?: boolean;
        /** 자식 요소 */
        children: import('svelte').Snippet;
    }

    let { isAdult, blurAmount = 20, allowReveal = true, children }: Props = $props();

    let revealed = $state(false);

    // 성인 인증 여부 (레벨 2 이상 + 로그인)
    const isAdultVerified = $derived(
        authStore.isAuthenticated && (authStore.user?.mb_level ?? 0) >= 2
    );

    // 블러 적용 여부
    const shouldBlur = $derived(isAdult && !isAdultVerified && !revealed);

    function handleReveal(): void {
        if (allowReveal) revealed = true;
    }

    function handleHide(): void {
        revealed = false;
    }
</script>

{#if shouldBlur}
    <div class="relative overflow-hidden">
        <!-- 블러 처리된 콘텐츠 -->
        <div
            class="pointer-events-none select-none"
            style="filter: blur({blurAmount}px)"
            aria-hidden="true"
        >
            {@render children()}
        </div>

        <!-- 오버레이 -->
        <div
            class="bg-background/80 absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm"
        >
            <EyeOff class="text-muted-foreground mb-2 h-8 w-8" />
            <p class="text-foreground mb-1 text-sm font-semibold">19세 미만 열람 불가</p>
            <p class="text-muted-foreground mb-3 text-xs">성인 인증이 필요한 콘텐츠입니다.</p>

            {#if allowReveal && authStore.isAuthenticated}
                <button
                    type="button"
                    class="border-border hover:bg-accent rounded-md border px-3 py-1.5 text-xs transition-colors"
                    onclick={handleReveal}
                >
                    <Eye class="mr-1 inline h-3 w-3" />
                    확인 후 보기
                </button>
            {:else if !authStore.isAuthenticated}
                <p class="text-muted-foreground text-xs">로그인 후 이용해 주세요.</p>
            {/if}
        </div>
    </div>
{:else if isAdult && revealed}
    <div class="relative">
        {@render children()}
        <button
            type="button"
            class="text-muted-foreground hover:text-foreground absolute right-2 top-2 text-xs"
            onclick={handleHide}
        >
            <EyeOff class="inline h-3 w-3" /> 숨기기
        </button>
    </div>
{:else}
    {@render children()}
{/if}
