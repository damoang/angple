<script lang="ts">
    /**
     * 이용제한 기록 목록 페이지
     */
    import { goto } from '$app/navigation';
    import * as Card from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import ChevronLeft from '@lucide/svelte/icons/chevron-left';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import Shield from '@lucide/svelte/icons/shield';
    import Search from '@lucide/svelte/icons/search';
    import X from '@lucide/svelte/icons/x';
    import { getPenaltyDisplay, type DisciplineLogListItem } from '$lib/api/discipline-log.js';
    import { penaltySeverity, SEVERITY_DOT, SEVERITY_TEXT } from '$lib/utils/penalty-severity.js';
    import BoardFavoriteButton from '$lib/components/features/board/board-favorite-button.svelte';
    import BoardSubscribeButton from '$lib/components/features/board/board-subscribe-button.svelte';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    const logs = $derived(data.logs || []);
    const total = $derived(data.total || 0);
    const currentPage = $derived(data.page || 1);
    const memberIdFilter = $derived(data.memberId || '');
    const pageSize = 20;
    const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

    // 필터 입력값 (URL query 와 동기화)
    let searchInput = $state('');
    $effect(() => {
        searchInput = memberIdFilter;
    });

    function goToPage(page: number) {
        if (page < 1 || page > totalPages) return;
        const url = new URL(window.location.href);
        url.searchParams.set('page', String(page));
        goto(url.pathname + url.search);
    }

    function applyFilter() {
        const value = searchInput.trim();
        const params = new URLSearchParams();
        if (value) params.set('member_id', value);
        const qs = params.toString();
        goto(`/disciplinelog${qs ? `?${qs}` : ''}`);
    }

    function clearFilter() {
        searchInput = '';
        goto('/disciplinelog');
    }

    function handleSearchKeydown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            applyFilter();
        }
    }

    function isToday(dateStr: string): boolean {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        return dateStr === `${yyyy}-${mm}-${dd}`;
    }

    /**
     * 같은 날짜끼리 묶는다.
     * 한 사람이 여러 계정을 쓰면 같은 날 같은 사유가 줄줄이 쌓여(2026-08-11 에 12건)
     * 행이 반복되기만 하고 읽히지 않는다. 날짜를 머리글로 올려 한 덩어리로 보이게 한다.
     * ⛔ $derived 안에서 Map 을 만들지 않는다(svelte/prefer-svelte-reactivity) — 배열로 접는다.
     * ⛔ logs.reduce<T>(...) 처럼 제네릭 인자도 주면 안 된다. logs 는 $derived 값이라
     *    svelte-check 가 "Untyped function calls may not accept type arguments" 로 막는다.
     *    누산기 변수에 타입을 붙여 우회한다.
     */
    const grouped = $derived.by(() => {
        const acc: { date: string; items: DisciplineLogListItem[] }[] = [];
        for (const log of logs) {
            // ⛔ 연속 병합만 하면 penalty_date_from 이 비연속으로 같은 날짜가 나올 때
            //    (날짜 없는 기록이 사이에 끼는 등) 같은 date 그룹이 둘 생겨
            //    {#each grouped (group.date)} 키가 중복 → svelte each_key_duplicate 로
            //    페이지 전체가 크래시(빈 화면)한다. 날짜 전체 기준으로 묶어 각 날짜가
            //    정확히 한 그룹이 되게 한다(Map 금지 규칙 → find 로 접는다).
            const g = acc.find((x) => x.date === log.penalty_date_from);
            if (g) g.items.push(log);
            else acc.push({ date: log.penalty_date_from, items: [log] });
        }
        return acc;
    });

    /** 제재 강도를 점 하나로. 영구=빨강, 기간제=주황, 주의=회색, 해제=흐리게 */
    function formatGroupDate(dateStr: string): string {
        if (isToday(dateStr)) return `${dateStr} · 오늘`;
        return dateStr;
    }
</script>

<svelte:head>
    <title>이용제한 기록</title>
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-6">
    <Card.Root>
        <Card.Header>
            <div class="flex items-center gap-2">
                <Card.Title class="flex items-center gap-2">
                    <Shield class="text-muted-foreground h-5 w-5" />
                    이용제한 기록
                </Card.Title>
                <BoardFavoriteButton boardId="disciplinelog" boardTitle="이용제한 기록" />
                <BoardSubscribeButton boardId="disciplinelog" boardTitle="이용제한 기록" />
            </div>
            <Card.Description>규정을 위반한 회원에 대한 제재 기록입니다.</Card.Description>
        </Card.Header>
        <Card.Content>
            <!-- 회원 필터 (아이디/닉네임은 백엔드 검색 키 동일 — member_id 기준) -->
            <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div class="relative flex-1">
                    <Search
                        class="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    />
                    <Input
                        type="text"
                        placeholder="회원 아이디로 검색"
                        class="pl-9"
                        bind:value={searchInput}
                        onkeydown={handleSearchKeydown}
                    />
                </div>
                <div class="flex gap-2">
                    <Button onclick={applyFilter} class="gap-1">
                        <Search class="h-4 w-4" />
                        검색
                    </Button>
                    {#if memberIdFilter}
                        <Button variant="outline" onclick={clearFilter} class="gap-1">
                            <X class="h-4 w-4" />
                            전체
                        </Button>
                    {/if}
                </div>
            </div>
            {#if memberIdFilter}
                <div class="text-muted-foreground mb-4 text-sm">
                    <span class="font-medium">{memberIdFilter}</span> 회원의 이용제한 기록만 표시 중
                    (총 {total}건)
                </div>
            {/if}
            {#if logs.length === 0}
                <div class="text-muted-foreground flex flex-col items-center justify-center py-12">
                    <p>이용제한 기록이 없습니다.</p>
                </div>
            {:else}
                <!--
                  날짜 그룹 목록 (데스크톱·모바일 공용)
                  같은 날짜를 머리글로 묶어, 같은 사유가 반복돼도 한 덩어리로 읽히게 한다.
                -->
                <div class="divide-y">
                    {#each grouped as group (group.date)}
                        <div class="py-1">
                            <div
                                class="bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-10 flex items-baseline gap-2 py-2 backdrop-blur"
                            >
                                <span
                                    class="text-sm font-semibold {isToday(group.date)
                                        ? 'text-primary'
                                        : 'text-foreground/80'}"
                                >
                                    {formatGroupDate(group.date)}
                                </span>
                                <span class="text-muted-foreground text-xs tabular-nums"
                                    >{group.items.length}건</span
                                >
                            </div>

                            <ul>
                                {#each group.items as log (log.id)}
                                    {@const penalty = getPenaltyDisplay(
                                        log.penalty_period,
                                        log.penalty_date_to
                                    )}
                                    {@const severity = penaltySeverity(
                                        log.penalty_period,
                                        penalty.released,
                                        log.revoked
                                    )}
                                    <li>
                                        <a
                                            href="/disciplinelog/{log.id}"
                                            class="hover:bg-muted/60 focus-visible:ring-ring flex items-center gap-3 rounded-md px-2 py-1.5 leading-tight transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2"
                                        >
                                            <!-- 강도 점: 영구=빨강 / 기간제=주황 / 주의·해제=회색 -->
                                            <span
                                                class="h-2 w-2 shrink-0 rounded-full {SEVERITY_DOT[
                                                    severity
                                                ]}"
                                                aria-hidden="true"
                                            ></span>

                                            <span class="min-w-0 flex-1">
                                                <span class="flex flex-wrap items-center gap-1.5">
                                                    <span class="truncate font-medium"
                                                        >{log.member_nickname}</span
                                                    >
                                                    <span
                                                        class="text-muted-foreground/70 shrink-0 text-xs"
                                                        >{log.member_id}</span
                                                    >
                                                    <span
                                                        class="text-xs font-medium {SEVERITY_TEXT[
                                                            severity
                                                        ]}"
                                                    >
                                                        {penalty.text}
                                                    </span>
                                                    {#if log.revoked}
                                                        <Badge
                                                            variant="secondary"
                                                            class="border-emerald-300 bg-emerald-100 text-[10px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                                            >소명해제</Badge
                                                        >
                                                    {:else if penalty.released}
                                                        <span
                                                            class="text-muted-foreground text-[10px]"
                                                            >해제됨</span
                                                        >
                                                    {/if}
                                                </span>
                                            </span>

                                            <span
                                                class="hidden max-w-[45%] flex-wrap justify-end gap-1 sm:flex"
                                            >
                                                <!--
                                                  ⛔ violation_titles 는 글별 사유의 **합집합**이다.
                                                     글마다 다르면 나열하지 않는다 — 한 글에만
                                                     적용한 사유가 전건에 붙은 것처럼 읽힌다.
                                                -->
                                                {#if log.reasons_differ_by_item}
                                                    <Badge variant="outline" class="text-[10px]"
                                                        >사유 여러 건</Badge
                                                    >
                                                {:else}
                                                    {#each log.violation_titles.slice(0, 2) as title}
                                                        <Badge variant="outline" class="text-[10px]"
                                                            >{title}</Badge
                                                        >
                                                    {/each}
                                                    {#if log.violation_titles.length > 2}
                                                        <Badge variant="outline" class="text-[10px]"
                                                            >+{log.violation_titles.length -
                                                                2}</Badge
                                                        >
                                                    {/if}
                                                {/if}
                                            </span>
                                        </a>
                                    </li>
                                {/each}
                            </ul>
                        </div>
                    {/each}
                </div>

                <!-- Pagination -->
                {#if totalPages > 1}
                    <div class="mt-6 flex items-center justify-center gap-1">
                        <Button
                            variant="outline"
                            size="icon"
                            onclick={() => goToPage(currentPage - 1)}
                            disabled={currentPage <= 1}
                        >
                            <ChevronLeft class="h-4 w-4" />
                        </Button>
                        {#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                            return start + i;
                        }).filter((p) => p <= totalPages) as page}
                            <Button
                                variant={page === currentPage ? 'default' : 'outline'}
                                size="icon"
                                onclick={() => goToPage(page)}
                            >
                                {page}
                            </Button>
                        {/each}
                        <Button
                            variant="outline"
                            size="icon"
                            onclick={() => goToPage(currentPage + 1)}
                            disabled={currentPage >= totalPages}
                        >
                            <ChevronRight class="h-4 w-4" />
                        </Button>
                    </div>
                {/if}
            {/if}
        </Card.Content>
    </Card.Root>
</div>
