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
    <!-- Classic variant: legacy step-pai amber bg + left accent -->
    <a
        {href}
        class="promo-classic-row block px-4 no-underline transition-colors hover:bg-amber-100/10 dark:hover:bg-amber-950/15"
        style="background: rgba(255, 179, 39, 0.06); border-left: 3px solid rgba(255, 179, 39, 0.4); border-bottom: 1px solid color-mix(in oklch, var(--foreground) 8%, transparent);"
    >
        <div
            class="flex items-center gap-2 md:grid md:grid-cols-[60px_1fr_auto_auto_auto] md:items-center md:gap-0"
        >
            <!-- 홍보 박스 (col 1, 데스크톱만) — legacy step-pai: rgb(255,179,39) bg -->
            <div class="hidden md:flex md:items-center md:justify-center">
                <div
                    class="flex h-5 w-10 items-center justify-center rounded-lg text-xs font-semibold leading-5"
                    style="background: rgb(255, 179, 39); color: rgb(78, 78, 78);"
                >
                    홍보
                </div>
            </div>

            <!-- 제목 (col 2) -->
            <div class="min-w-0 flex-1 md:flex-none">
                <div class="flex min-w-0 items-center gap-1">
                    <span
                        class="inline-flex shrink-0 items-center rounded px-1.5 py-0 text-[10px] font-semibold md:hidden"
                        style="background: rgb(255, 179, 39); color: rgb(78, 78, 78);">홍보</span
                    >
                    <span
                        class="text-foreground truncate font-medium"
                        style="font-size: 0.9375rem;"
                    >
                        {post.subject}
                    </span>
                </div>
            </div>

            <!-- 광고주 (col 3, 데스크톱만) -->
            <span
                class="text-muted-foreground hidden w-[120px] truncate pl-1 md:inline-flex"
                style="font-size: 15px;"
            >
                {post.advertiserName}
            </span>

            <!-- 날짜 (col 4, 데스크톱만) -->
            <span
                class="text-muted-foreground hidden w-[70px] pl-1 text-center md:inline"
                style="font-size: 15px;"
            >
                {formatDate(post.createdAt)}
            </span>

            <!-- 조회 (col 5, 빈칸) -->
            <span class="hidden w-[50px] pl-1 md:inline"></span>
        </div>
    </a>
{:else}
    <!-- Default variant: 일반 행과 동일 높이 -->
    <a
        {href}
        class="border-border flex items-center gap-2 rounded-lg border bg-blue-50/50 px-4 py-1.5 transition-all hover:bg-blue-100/60 hover:shadow-sm dark:bg-blue-950/20 dark:hover:bg-blue-950/40"
    >
        <!-- 제목 + 홍보 뱃지 -->
        <div class="min-w-0 flex-1">
            <h3 class="text-foreground flex items-center gap-1.5 truncate font-medium">
                <span
                    class="inline-flex shrink-0 items-center rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-amber-500 dark:bg-amber-400/15 dark:text-amber-400"
                    >홍보</span
                >
                {post.subject}
            </h3>
        </div>
        <span class="text-muted-foreground shrink-0 text-xs">{post.advertiserName}</span>
    </a>
{/if}

<style>
    /* 홍보 classic 행: regular post-row와 동일한 density-aware 패딩 */
    .promo-classic-row {
        padding-top: calc(10px + var(--row-pad-extra, 3px));
        padding-bottom: calc(10px + var(--row-pad-extra, 3px));
    }

    @media (min-width: 768px) {
        .promo-classic-row {
            padding-top: calc(6px + var(--row-pad-extra, 3px));
            padding-bottom: calc(6px + var(--row-pad-extra, 3px));
        }
    }
</style>
