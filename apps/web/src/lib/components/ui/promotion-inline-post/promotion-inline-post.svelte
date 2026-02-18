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

    let { post }: { post: PromotionPost } = $props();
</script>

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
