<script lang="ts">
    /**
     * 온라인 대전 랭킹 카드 (장기·오목 공용) — 게임 페이지 탭 위에 둔다.
     *
     * 공개 API `GET /{game}-ws/ranking` (인증 불요, 점수 상위 20, 닉네임·승·패·무·점수만) 재사용.
     * 평소엔 TOP 10, 「전체 보기」로 TOP 20. 로그인했으면 내 순위·전적 한 줄.
     *
     * - 불러오는 동안은 같은 높이의 자리표시를 그린다(SSR 포함) — 탭·게임판이 밀리지 않게.
     * - 실패하거나 비어 있으면 같은 높이로 안내 문구만 보인다 — 카드를 빼면 아래 게임판이 위로 튄다.
     *   실패해도 페이지의 다른 동작에는 영향 없음.
     * - 내 줄은 응답이 온 뒤(브라우저에서만) 그린다 — 서버·브라우저 로그인 상태 차이로 화면이 어긋나지 않게.
     */
    import { authStore } from '$lib/stores/auth.svelte.js';
    import {
        RANKING_TOP,
        findMyIndex,
        myRankLine,
        rankingTitleCount,
        toRankingRows,
        type RankingRow
    } from '$lib/games/ranking';

    let {
        game,
        title
    }: {
        /** API 경로 접두어 — /janggi-ws/ranking, /omok-ws/ranking */
        game: 'janggi' | 'omok';
        /** 표시 이름 (장기·오목) */
        title: string;
    } = $props();

    const TOP = RANKING_TOP;
    /** 응답이 이보다 늦으면 실패로 본다 */
    const TIMEOUT_MS = 8000;

    let status = $state<'loading' | 'ok' | 'empty' | 'error'>('loading');
    let rows = $state<RankingRow[]>([]);
    let expanded = $state(false);

    $effect(() => {
        const url = `/${game}-ws/ranking`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
        fetch(url, { signal: ctrl.signal })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                const list = toRankingRows(data);
                rows = list;
                status = data === null ? 'error' : list.length > 0 ? 'ok' : 'empty';
            })
            .catch(() => {
                // 표시용 정보 — 실패는 안내 문구로만 (자리는 그대로)
                status = 'error';
            })
            .finally(() => clearTimeout(timer));
        return () => {
            clearTimeout(timer);
            ctrl.abort();
        };
    });

    const myNick = $derived(authStore.isAuthenticated ? (authStore.user?.mb_name ?? '') : '');
    const myIndex = $derived(findMyIndex(rows, myNick));
    const shown = $derived(expanded ? rows : rows.slice(0, TOP));
    /** 내 순위 한 줄 — 분기 대신 문자열로 만든다(맞붙은 분기 블록 금지 규칙) */
    const myLine = $derived(status === 'ok' ? myRankLine(rows, myNick) : '');
    const titleCount = $derived(status === 'ok' ? rankingTitleCount(rows, expanded) : TOP);
    const emptyText = $derived(
        status === 'error'
            ? '랭킹을 불러오지 못했습니다. 잠시 뒤 다시 들어와 주세요.'
            : '아직 랭킹이 없습니다. 온라인 대전 첫 판의 주인공이 되어 보세요!'
    );

    function medal(i: number): string {
        return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);
    }
</script>

<section
    class="bg-card text-card-foreground mb-4 rounded-lg border p-3"
    aria-label="{title} 온라인 대전 랭킹"
    aria-busy={status === 'loading'}
>
    <div class="mb-1 flex items-center justify-between gap-2">
        <h2 class="text-foreground min-w-0 truncate text-sm font-semibold">
            🏆 {title} 랭킹 TOP {titleCount}
            <span class="text-muted-foreground ml-1 text-xs font-normal">온라인 대전 점수</span>
        </h2>
        {#if status === 'ok' && rows.length > TOP}
            <button
                type="button"
                class="text-primary shrink-0 text-xs font-medium hover:underline"
                aria-expanded={expanded}
                onclick={() => (expanded = !expanded)}
            >
                {expanded ? '접기' : '전체 보기'}
            </button>
        {/if}
    </div>

    <!-- 내 순위 한 줄 — 높이 고정(비어 있어도 자리 유지) -->
    <p class="text-muted-foreground mb-2 h-4 truncate text-xs leading-4">{myLine}</p>

    {#if status === 'loading'}
        <ol
            class="grid min-h-[140px] grid-flow-col grid-cols-2 grid-rows-5 gap-x-4"
            aria-hidden="true"
        >
            {#each Array(TOP) as _, i (i)}
                <li class="flex h-7 items-center gap-2">
                    <span class="bg-muted h-3 w-4 shrink-0 animate-pulse rounded"></span>
                    <span class="bg-muted h-3 flex-1 animate-pulse rounded"></span>
                </li>
            {/each}
        </ol>
    {:else if status !== 'ok'}
        <!-- 실패·빈 응답 — 자리표시와 같은 높이를 지켜 아래가 밀려 올라가지 않게 -->
        <div
            class="text-muted-foreground flex min-h-[140px] items-center justify-center px-2 text-center text-xs"
        >
            {emptyText}
        </div>
    {:else if !expanded}
        <!-- TOP 10 — 두 칸(1~5 · 6~10), 높이 고정 -->
        <ol
            class="grid min-h-[140px] grid-flow-col grid-cols-2 grid-rows-5 gap-x-4 text-xs sm:text-sm"
        >
            {#each shown as row, i (row.nickname + i)}
                <li
                    class="flex h-7 min-w-0 items-center gap-1.5 rounded px-1 {i === myIndex
                        ? 'bg-primary/10 font-semibold'
                        : ''}"
                >
                    <span class="w-5 shrink-0 text-center tabular-nums">{medal(i)}</span>
                    <span class="text-foreground min-w-0 flex-1 truncate">{row.nickname}</span>
                    <span class="text-muted-foreground shrink-0 tabular-nums">{row.rating}</span>
                </li>
            {/each}
        </ol>
    {:else}
        <!-- 전체 보기 — TOP 20 표 -->
        <div class="overflow-x-auto">
            <table class="w-full text-xs sm:text-sm">
                <thead>
                    <tr class="text-muted-foreground border-b text-left">
                        <th class="py-1.5 pr-2 font-medium">순위</th>
                        <th class="py-1.5 pr-2 font-medium">앙님</th>
                        <th class="py-1.5 pr-2 text-right font-medium">전적</th>
                        <th class="py-1.5 text-right font-medium">점수</th>
                    </tr>
                </thead>
                <tbody>
                    {#each shown as row, i (row.nickname + i)}
                        <tr
                            class="border-b border-dashed last:border-0 {i === myIndex
                                ? 'bg-primary/10 font-semibold'
                                : ''}"
                        >
                            <td class="py-1.5 pr-2 tabular-nums">{medal(i)}</td>
                            <td class="text-foreground max-w-[9rem] truncate py-1.5 pr-2">
                                {row.nickname}
                            </td>
                            <td class="whitespace-nowrap py-1.5 pr-2 text-right tabular-nums">
                                {row.wins}승 {row.losses}패 {row.draws}무
                            </td>
                            <td class="py-1.5 text-right tabular-nums">{row.rating}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</section>
