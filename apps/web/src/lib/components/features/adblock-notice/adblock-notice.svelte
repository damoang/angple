<script lang="ts">
    /**
     * AdBlock 감지 시 우측 하단 sticky toast — Forbes/WaPo 식 모범사례.
     *
     * 정책:
     * - adblock-notice store 의 shouldShow 가 true 일 때만 노출 (감지 + 미dismiss)
     * - 두 CTA: "잠시 허용 (7일)" (dismiss) / "PC 광고 제거 가입" (→ /ad-free)
     * - role=status + aria-live=polite (스크린리더 자연 안내)
     * - 사용자 영향 최소화: 콘텐츠 가리지 않음, 모달 아님
     */
    import { adblockNotice } from '$lib/stores/adblock-notice.svelte';
    import { Button } from '$lib/components/ui/button';
    import X from '@lucide/svelte/icons/x';
    import Sparkles from '@lucide/svelte/icons/sparkles';

    const show = $derived(adblockNotice.shouldShow);

    function handleDismiss() {
        adblockNotice.dismiss();
    }
</script>

{#if show}
    <div
        class="adblock-notice fixed bottom-4 right-4 z-[100] max-w-sm rounded-xl border border-amber-200 bg-white p-4 shadow-2xl ring-1 ring-black/5 sm:bottom-6 sm:right-6 dark:border-amber-900/40 dark:bg-zinc-900 dark:ring-white/10"
        role="status"
        aria-live="polite"
        aria-label="광고 차단 안내"
    >
        <button
            type="button"
            class="text-muted-foreground hover:text-foreground absolute right-2 top-2 rounded p-1 transition"
            aria-label="닫기 (7일간 안내 끄기)"
            onclick={handleDismiss}
        >
            <X class="h-4 w-4" />
        </button>
        <div class="flex items-start gap-3 pr-6">
            <div class="text-2xl" aria-hidden="true">💡</div>
            <div class="flex-1">
                <p class="text-sm font-semibold">광고가 막혀있어요</p>
                <p class="text-muted-foreground mt-1 text-xs leading-relaxed">
                    다모앙은 광고로 운영되는 공개 커뮤니티입니다. 잠시만 허용해주시거나 <strong
                        class="text-foreground">PC 광고 제거</strong
                    > 멤버십으로 응원해주세요.
                </p>
                <div class="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                        size="sm"
                        href="/ad-free"
                        class="bg-amber-500 text-white hover:bg-amber-600"
                    >
                        <Sparkles class="mr-1 h-3.5 w-3.5" />
                        PC 광고 제거 가입
                    </Button>
                    <Button size="sm" variant="ghost" onclick={handleDismiss}
                        >잠시 허용 (7일)</Button
                    >
                </div>
            </div>
        </div>
    </div>
{/if}
