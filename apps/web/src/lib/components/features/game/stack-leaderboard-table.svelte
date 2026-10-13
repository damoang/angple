<script lang="ts">
    /**
     * 점수판 표 — 앙쌓기 순위 탭·혼자하기 아래 TOP 10, 뱀 게임 랭킹 카드가 같이 쓴다.
     * 점수 줄(혼자하기·뱀): 순위 · 닉네임 · 점수 · 기록 시각(KST) / 대전: 순위 · 닉네임 · 전적 · 레이팅.
     * 폭이 고정된 표라 좁은 화면(360px)에서도 넘치지 않고 긴 닉네임은 말줄임한다.
     */
    import {
        formatAchievedAt,
        type ScoreRow,
        type VersusRow
    } from '$lib/games/stack/leaderboard.js';

    let {
        rows,
        versus = false,
        now
    }: {
        rows: Array<ScoreRow | VersusRow>;
        versus?: boolean;
        /** 「오늘」 판단 기준 시각(ms) — 불러온 시각을 넘긴다 */
        now: number;
    } = $props();

    function medal(rank: number): string {
        return rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank);
    }
</script>

<table class="w-full table-fixed text-sm">
    <thead>
        <tr class="text-muted-foreground border-b text-left text-xs">
            <th class="w-9 py-1.5 pr-1">순위</th>
            <th class="py-1.5 pr-2">앙님</th>
            {#if versus}
                <th class="w-28 py-1.5 pr-2 text-right">전적</th>
                <th class="w-14 py-1.5 text-right">레이팅</th>
            {:else}
                <th class="w-20 py-1.5 pr-2 text-right">점수</th>
                <th class="w-[6.5rem] py-1.5 text-right">기록 시각</th>
            {/if}
        </tr>
    </thead>
    <tbody>
        {#each rows as row, i (i)}
            {@const rank = row.rank || i + 1}
            <tr class="border-b border-dashed last:border-0 {rank <= 3 ? 'font-medium' : ''}">
                <td class="py-1.5 pr-1">{medal(rank)}</td>
                <td class="truncate py-1.5 pr-2" title={row.nickname}>{row.nickname}</td>
                {#if 'rating' in row}
                    <td class="truncate whitespace-nowrap py-1.5 pr-2 text-right tabular-nums">
                        {row.wins}승 {row.losses}패{row.draws ? ` ${row.draws}무` : ''}
                    </td>
                    <td class="py-1.5 text-right font-medium tabular-nums">{row.rating}</td>
                {:else}
                    <td class="whitespace-nowrap py-1.5 pr-2 text-right font-medium tabular-nums"
                        >{row.score.toLocaleString()}</td
                    >
                    <td
                        class="text-muted-foreground whitespace-nowrap py-1.5 text-right text-xs tabular-nums"
                        >{formatAchievedAt(row.achievedAt, now)}</td
                    >
                {/if}
            </tr>
        {/each}
    </tbody>
</table>
