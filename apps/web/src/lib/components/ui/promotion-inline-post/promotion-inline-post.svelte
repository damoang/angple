<script lang="ts">
    import { formatDate } from '$lib/utils/format-date.js';

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

    // classic 레이아웃과 동일한 높이 맞춤
    const isClassic = $derived(variant === 'classic');

    // linkUrl에서 경로만 추출하여 현재 origin 사용 (dev/web/prod 환경 대응)
    const href = $derived.by(() => {
        try {
            const url = new URL(post.linkUrl);
            // 다모앙 도메인인 경우 상대 경로로 변환
            if (url.hostname.endsWith('damoang.net')) {
                return url.pathname + url.search + url.hash;
            }
            // 외부 URL은 그대로 사용
            return post.linkUrl;
        } catch {
            return post.linkUrl;
        }
    });
</script>

{#if isClassic}
    <!-- Classic variant: 동일 그리드 + 앰버 accent -->
    <a
        {href}
        class="block border-l-[3px] border-l-amber-500/30 bg-amber-50/[0.04] px-4 py-1.5 no-underline transition-colors hover:bg-amber-100/10 dark:border-l-amber-400/25 dark:bg-amber-950/[0.04] dark:hover:bg-amber-950/15"
    >
        <div
            class="flex items-center gap-2 md:grid md:grid-cols-[40px_1fr_auto_auto_auto] md:items-center md:gap-0"
        >
            <!-- 홍보 박스 (col 1, 데스크톱만) -->
            <div class="hidden md:flex md:items-center md:justify-center">
                <div
                    class="flex h-7 w-10 items-center justify-center rounded-md bg-amber-500/15 text-[10px] font-semibold text-amber-500 dark:bg-amber-400/15 dark:text-amber-400"
                >
                    홍보
                </div>
            </div>

            <!-- 제목 (col 2) -->
            <div class="min-w-0 flex-1 md:flex-none">
                <div class="flex min-w-0 items-center gap-1">
                    <span
                        class="inline-flex shrink-0 items-center rounded bg-amber-500/15 px-1.5 py-0 text-[10px] font-semibold text-amber-500 md:hidden dark:bg-amber-400/15 dark:text-amber-400"
                        >홍보</span
                    >
                    <span class="text-foreground truncate text-base font-semibold">
                        {post.subject}
                    </span>
                </div>
            </div>

            <!-- 광고주 (col 3, 데스크톱만) -->
            <span class="text-foreground/70 hidden w-[130px] truncate pl-1 text-sm md:inline-flex">
                {post.advertiserName}
            </span>

            <!-- 날짜 (col 4, 데스크톱만) -->
            <span class="text-muted-foreground hidden w-[70px] pl-1 text-center text-sm md:inline">
                {formatDate(post.createdAt)}
            </span>

            <!-- 조회 (col 5, 빈칸) -->
            <span class="hidden w-[50px] pl-1 md:inline"></span>
        </div>
    </a>
{:else}
    <!-- Default variant: 썸네일 포함 -->
    <a
        {href}
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

        <!-- 제목 + 홍보 뱃지 -->
        <div class="min-w-0 flex-1">
            <h3 class="text-foreground mb-1 flex items-center gap-1.5 truncate font-medium">
                <span
                    class="inline-flex shrink-0 items-center rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-500 dark:bg-amber-400/15 dark:text-amber-400"
                    >홍보</span
                >
                {post.subject}
            </h3>
            <div class="text-muted-foreground text-xs">
                {post.advertiserName}
            </div>
        </div>
    </a>
{/if}
