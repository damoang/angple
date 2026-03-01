<script lang="ts">
    interface PromotionPost {
        wrId: number;
        subject: string;
        imageUrl: string;
        linkUrl: string;
        advertiserName: string;
        memberId: string;
        pinToTop: boolean;
        createdAt: string;
    }

    let { post, variant = 'default' }: { post: PromotionPost; variant?: 'default' | 'classic' } =
        $props();

    // classic 레이아웃과 동일한 높이 맞춤 (py-2.5, 더 작은 요소)
    const isClassic = $derived(variant === 'classic');
</script>

{#if isClassic}
    <!-- Classic variant: 게시글 목록과 동일한 높이 -->
    <a
        href={post.linkUrl}
        class="block bg-blue-50/50 px-4 py-2.5 no-underline transition-colors hover:bg-blue-100/60 dark:bg-blue-950/20 dark:hover:bg-blue-950/40"
    >
        <div class="flex items-center gap-2 md:gap-3">
            <!-- AD 박스 (데스크톱만) -->
            <div class="hidden shrink-0 md:block">
                <div
                    class="flex h-7 w-10 items-center justify-center rounded-md bg-blue-500/80 text-[10px] font-bold text-white dark:bg-blue-400/80"
                >
                    AD
                </div>
            </div>

            <!-- 제목 영역 -->
            <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1">
                    <span
                        class="inline-flex shrink-0 items-center rounded bg-blue-500/80 px-1.5 py-0 text-[10px] font-bold text-white md:hidden dark:bg-blue-400/80"
                        >AD</span
                    >
                    <span class="text-foreground truncate text-base font-semibold">
                        {post.subject}
                    </span>
                </div>
            </div>

            <!-- 광고주 (데스크톱만) -->
            <span class="text-muted-foreground hidden shrink-0 text-[15px] md:inline">
                {post.advertiserName}
            </span>
        </div>
    </a>
{:else}
    <!-- Default variant: 썸네일 포함 -->
    <a
        href={post.linkUrl}
        class="border-border flex items-center gap-3 rounded-lg border bg-blue-50/50 px-4 py-3 transition-all hover:bg-blue-100/60 hover:shadow-sm dark:bg-blue-950/20 dark:hover:bg-blue-950/40"
    >
        <!-- 썸네일 -->
        {#if post.imageUrl}
            <div class="bg-muted relative h-14 w-14 shrink-0 overflow-hidden rounded-md">
                <img
                    src={post.imageUrl}
                    alt=""
                    class="h-full w-full object-cover"
                    onerror={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                    }}
                />
            </div>
        {/if}

        <!-- 제목 + AD 뱃지 -->
        <div class="min-w-0 flex-1">
            <h3 class="text-foreground mb-1 flex items-center gap-1.5 truncate font-medium">
                <span
                    class="inline-flex shrink-0 items-center rounded bg-blue-500/80 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white dark:bg-blue-400/80"
                    >AD</span
                >
                {post.subject}
            </h3>
            <div class="text-muted-foreground text-xs">
                {post.advertiserName}
            </div>
        </div>
    </a>
{/if}
