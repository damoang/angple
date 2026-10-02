<script lang="ts">
    /**
     * 앙티티 목록(/angtt) 상단 「작품」 선반.
     *
     * 데이터는 서버 load(+page.server.ts)가 angtt 첫 페이지에서만 채운다 — 여기서 조회하지 않는다.
     * ⛔ $effect·onMount 로 데이터를 받지 말 것: SSR 에서 실행되지 않아 하이드레이션 뒤에
     *    선반이 끼어들며 목록을 민다(CLS). 높이는 카드·행 모두 고정값이다.
     *
     * 실제 회원 활동(별점·연결 글)이 있는 작품만 온다. 0개면 부모가 렌더하지 않는다.
     */
    import { trackEvent } from '$lib/services/ga4';
    import { shouldShowAverage } from '$lib/components/features/board/rating-display.js';

    /** 서버 AngttShelfEntity(plugins/angtt-review/lib/entities.server.ts)와 구조 동일 — 서버 모듈은 클라 import 불가라 별도 선언 */
    interface ShelfEntity {
        slug: string;
        title: string;
        posterUrl: string | null;
        ratingAvg: number;
        ratingCount: number;
        postCount: number;
    }

    let { entities }: { entities: ShelfEntity[] } = $props();

    function ratingText(e: ShelfEntity): string {
        // ⛔ toLocaleString 금지 — 서버(Node)와 브라우저 로캘이 달라 SSR·하이드레이션 문구가 갈린다.
        if (e.ratingCount <= 0) return e.postCount > 0 ? `글 ${e.postCount}개` : '';
        if (!shouldShowAverage(e.ratingCount)) return `${e.ratingCount}명 평가`;
        return `★${e.ratingAvg.toFixed(1)} · ${e.ratingCount}명`;
    }

    function onShelfClick(slug: string, position: number): void {
        trackEvent('angtt_shelf_click', { work_id: slug, position });
    }
</script>

<section class="mb-3 h-[214px] overflow-hidden" aria-label="앙티티 작품">
    <div class="mb-1.5 flex h-6 items-center justify-between">
        <h2 class="text-sm font-semibold">작품</h2>
        <span class="text-muted-foreground text-xs">앙님들의 별점과 후기</span>
    </div>
    <ul class="flex h-[184px] w-full gap-3 overflow-x-auto overflow-y-hidden pb-2">
        {#each entities as entity, i (entity.slug)}
            <li class="h-[176px] w-[88px] shrink-0">
                <a
                    href="/angtt/{encodeURIComponent(entity.slug)}"
                    class="group block h-full w-full"
                    onclick={() => onShelfClick(entity.slug, i + 1)}
                >
                    {#if entity.posterUrl}
                        <img
                            src={entity.posterUrl}
                            alt="{entity.title} 포스터"
                            width="88"
                            height="132"
                            loading="lazy"
                            decoding="async"
                            class="bg-muted h-[132px] w-[88px] rounded-md border object-cover"
                        />
                    {:else}
                        <div
                            class="flex h-[132px] w-[88px] items-center justify-center rounded-md border border-black/30 bg-gradient-to-br from-[#2a2118] to-[#0c0a07] text-3xl font-extrabold text-[#f6ecd6]"
                            aria-hidden="true"
                        >
                            {Array.from(entity.title.trim())[0] ?? '?'}
                        </div>
                    {/if}
                    <p class="mt-1 h-5 truncate text-xs font-medium group-hover:underline">
                        {entity.title}
                    </p>
                    <p class="text-muted-foreground h-4 truncate text-[11px] leading-4">
                        {ratingText(entity)}
                    </p>
                </a>
            </li>
        {/each}
    </ul>
</section>
