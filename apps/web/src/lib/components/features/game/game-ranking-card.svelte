<script lang="ts">
    /**
     * 온라인 대전 랭킹 카드 (장기·오목 공용) — 게임 페이지 탭 위에 둔다.
     *
     * 공개 API `GET /{game}-ws/ranking` (인증 불요, 점수 상위 20, 닉네임·승·패·무·점수만) 재사용.
     * 평소엔 TOP 10, 「전체 보기」로 TOP 20. 로그인했으면 내 순위·전적 한 줄.
     *
     * - 불러오는 동안은 같은 높이의 자리표시를 그린다(SSR 포함) — 탭·게임판이 밀리지 않게.
     * - 실패하거나 비어 있으면 카드를 통째로 숨긴다 — 페이지의 다른 동작에는 영향 없음.
     * - 내 줄은 응답이 온 뒤(브라우저에서만) 그린다 — 서버·브라우저 로그인 상태 차이로 화면이 어긋나지 않게.
     */
    import { authStore } from '$lib/stores/auth.svelte.js';

    let {
        game,
        title
    }: {
        /** API 경로 접두어 — /janggi-ws/ranking, /omok-ws/ranking */
        game: 'janggi' | 'omok';
        /** 표시 이름 (장기·오목) */
        title: string;
    } = $props();

    interface RankingRow {
        nickname: string;
        wins: number;
        losses: number;
        draws: number;
        rating: number;
    }

    const TOP = 10;
    /** 응답이 이보다 늦으면 카드를 접는다 */
    const TIMEOUT_MS = 8000;

    let status = $state<'loading' | 'ok' | 'hidden'>('loading');
    let rows = $state<RankingRow[]>([]);
    let expanded = $state(false);

    function toRows(data: unknown): RankingRow[] {
        const list = (data as { ranking?: unknown } | null)?.ranking;
        if (!Array.isArray(list)) return [];
        return list
            .map((r: Record<string, unknown>) => ({
                nickname: String(r?.nickname ?? '').trim(),
                wins: Number(r?.wins) || 0,
                losses: Number(r?.losses) || 0,
                draws: Number(r?.draws) || 0,
                rating: Number(r?.rating) || 0
            }))
            .filter((r) => r.nickname !== '');
    }

    $effect(() => {
        const url = `/${game}-ws/ranking`;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
        fetch(url, { signal: ctrl.signal })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
                const list = toRows(data);
                rows = list;
                status = list.length > 0 ? 'ok' : 'hidden';
            })
            .catch(() => {
                // 표시용 정보 — 실패는 조용히 숨긴다
                status = 'hidden';
            })
            .finally(() => clearTimeout(timer));
        return () => {
            clearTimeout(timer);
            ctrl.abort();
        };
    });

    const myNick = $derived(authStore.isAuthenticated ? (authStore.user?.mb_name ?? '') : '');
    const myIndex = $derived(myNick ? rows.findIndex((r) => r.nickname === myNick) : -1);
    const shown = $derived(expanded ? rows : rows.slice(0, TOP));
    /** 내 순위 한 줄 — 분기 대신 문자열로 만든다(맞붙은 분기 블록 금지 규칙) */
    const myLine = $derived.by(() => {
        if (status !== 'ok') return '';
        if (!myNick) return '로그인하고 온라인 대전에서 순위에 도전해 보세요';
        if (myIndex >= 0) {
            const r = rows[myIndex];
            return `내 순위 ${myIndex + 1}위 · ${r.wins}승 ${r.losses}패 ${r.draws}무 · ${r.rating}점`;
        }
        // 공개 API 는 상위 20명만 준다 — 그 밖이면 정확한 순위를 알 수 없다
        return rows.length >= 20
            ? `내 순위: TOP ${rows.length} 밖 — 온라인 대전에서 점수를 올려 보세요`
            : '아직 순위에 없어요 — 온라인 대전 첫 판으로 이름을 올려 보세요';
    });

    function medal(i: number): string {
        return i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);
    }
</script>

{#if status !== 'hidden'}
    <section
        class="bg-card text-card-foreground mb-4 rounded-lg border p-3"
        aria-label="{title} 온라인 대전 랭킹"
        aria-busy={status === 'loading'}
    >
        <div class="mb-1 flex items-center justify-between gap-2">
            <h2 class="text-foreground min-w-0 truncate text-sm font-semibold">
                🏆 {title} 랭킹 TOP {expanded ? rows.length : TOP}
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
                        <span class="text-muted-foreground shrink-0 tabular-nums">{row.rating}</span
                        >
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
{/if}
