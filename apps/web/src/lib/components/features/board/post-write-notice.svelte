<script lang="ts">
    /**
     * 게시판별 글쓰기 안내 (bug-write-notice.svelte 일반화).
     * 관리자가 확장설정(write_notice)에 저장한 HTML 안내를 배너 또는 인터스티셜로 표시한다.
     * - mode='banner'  : 폼 상단 배너(글쓰기는 그대로 진행)
     * - mode='blocking': 확인 버튼을 눌러야 폼으로 넘어가는 인터스티셜
     * HTML 은 관리자 입력이라도 렌더 직전 sanitize 한다.
     */
    import { Button } from '$lib/components/ui/button/index.js';
    import { dompurify } from '$lib/utils/dompurify';
    import { setWriteNoticeSkip } from './post-write-notice.js';

    let {
        html,
        boardId,
        mode = 'banner',
        variant = 'info',
        dismissible = false,
        skipHours,
        onContinue
    }: {
        html: string;
        boardId: string;
        mode?: 'banner' | 'blocking';
        variant?: 'info' | 'warning';
        dismissible?: boolean;
        skipHours?: number;
        onContinue?: () => void;
    } = $props();

    // 관리자 입력 HTML 이라도 렌더 직전 정제한다(본문 렌더와 동일 인스턴스).
    const safeHtml = $derived(dompurify.sanitize(html ?? ''));

    let skipToday = $state(false);

    const variantClass = $derived(
        variant === 'warning'
            ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100'
            : 'border-border bg-muted/40 text-foreground'
    );

    function handleContinue(): void {
        if (dismissible && skipToday) setWriteNoticeSkip(boardId);
        onContinue?.();
    }

    function handleBannerDismiss(): void {
        if (dismissible) setWriteNoticeSkip(boardId);
    }
</script>

{#if mode === 'blocking'}
    <div class="mx-auto max-w-xl">
        <div class="border-border bg-background overflow-hidden rounded-xl border shadow-sm">
            <div
                class="prose prose-sm dark:prose-invert max-w-none px-5 py-4 text-sm {variantClass}"
            >
                <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                {@html safeHtml}
            </div>
            <!-- 전역 규칙(모든 게시판 공통) — placeholder에서 이곳 공통 섹션으로 이전 -->
            <div class="border-border/50 text-muted-foreground border-t px-5 py-3 text-xs">
                존댓말(경어체) 사용은 필수이며, 초성으로 우회한 비속어도 이용제한 대상입니다.
            </div>
            <div class="border-border/60 border-t px-5 py-4">
                <Button class="w-full" onclick={handleContinue}>확인하고 계속하기 →</Button>
                {#if dismissible}
                    <label
                        class="text-muted-foreground mt-3 flex select-none items-center justify-center gap-2 text-xs"
                    >
                        <input
                            type="checkbox"
                            bind:checked={skipToday}
                            class="accent-primary h-3.5 w-3.5"
                        />
                        오늘 하루 이 안내 보지 않기
                    </label>
                {/if}
            </div>
        </div>
    </div>
{:else}
    <div class="mb-4 rounded-lg border px-4 py-3 text-sm {variantClass}">
        <div class="prose prose-sm dark:prose-invert max-w-none">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html safeHtml}
        </div>
        <!-- 전역 규칙(모든 게시판 공통) — placeholder에서 이곳 공통 섹션으로 이전 -->
        <p class="text-muted-foreground mt-2 text-xs">
            존댓말(경어체) 사용은 필수이며, 초성으로 우회한 비속어도 이용제한 대상입니다.
        </p>
        {#if dismissible}
            <div class="mt-2 flex justify-end">
                <button
                    type="button"
                    class="text-muted-foreground hover:text-foreground text-xs underline"
                    onclick={handleBannerDismiss}
                >
                    오늘 하루 보지 않기
                </button>
            </div>
        {/if}
    </div>
{/if}
