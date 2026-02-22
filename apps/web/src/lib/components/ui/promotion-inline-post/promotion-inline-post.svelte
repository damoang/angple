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
</script>

{#if variant === 'classic'}
    <!-- Classic 변형: divide-y 행 스타일에 맞춤 -->
    <a
        href={post.linkUrl}
        target="_blank"
        rel="noopener noreferrer"
        class="bg-background hover:bg-accent flex items-center gap-2 px-4 py-2.5 transition-colors md:gap-3"
    >
        <!-- 썸네일 (데스크톱: 추천박스 위치) -->
        {#if post.imageUrl}
            <div
                class="bg-muted relative hidden h-7 w-10 shrink-0 overflow-hidden rounded-md md:block"
            >
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
        {:else}
            <div class="hidden h-7 w-10 shrink-0 md:block"></div>
        {/if}

        <!-- 제목 + AD 뱃지 -->
        <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1">
                <span
                    class="inline-flex shrink-0 items-center rounded bg-blue-500/80 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white dark:bg-blue-400/80"
                    >AD</span
                >
                <span class="truncate text-base font-medium">{post.subject}</span>
            </div>
        </div>

        <!-- 메타 (데스크톱) -->
        <div class="hidden shrink-0 items-center gap-2 md:flex">
            <span class="text-muted-foreground w-[100px] truncate text-sm">
                {post.advertiserName}
            </span>
        </div>
    </a>
{:else}
    <!-- Default 변형: 카드형 -->
    <a
        href={post.linkUrl}
        target="_blank"
        rel="noopener noreferrer"
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
