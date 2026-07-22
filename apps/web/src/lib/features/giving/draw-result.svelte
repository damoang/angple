<script lang="ts">
    import type { GivingDrawResult } from './api.js';
    import { methodLabel } from './methods.js';
    import { simulateLadder } from './pure/ladder.js';

    let { draw }: { draw: GivingDrawResult } = $props();

    const result = $derived(draw.result);
    const winners: string[] = $derived(
        result?.winners ?? (draw.winner_mb_id ? [draw.winner_mb_id] : [])
    );

    // Commit-reveal 검증: SeedHash(seed) === seed_hash 인지 브라우저에서 재계산.
    let seedVerified = $state<null | boolean>(null);
    $effect(() => {
        const seed = draw.seed;
        const hash = draw.seed_hash;
        if (!seed || !hash || !globalThis.crypto?.subtle) {
            seedVerified = null;
            return;
        }
        (async () => {
            try {
                const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
                const hex = [...new Uint8Array(buf)]
                    .map((b) => b.toString(16).padStart(2, '0'))
                    .join('');
                seedVerified = hex === hash;
            } catch {
                seedVerified = null;
            }
        })();
    });

    const ladder = $derived(result?.ladder ?? null);
    const ladderEnd = $derived(ladder ? (ladder.end_col ?? simulateLadder(ladder)) : []);
</script>

<div class="border-border bg-muted/30 rounded-lg border p-4">
    <div class="mb-2 flex items-center gap-2">
        <span class="text-lg">🎉</span>
        <h3 class="text-foreground font-semibold">
            나눔 결과 · {methodLabel(draw.method)}
        </h3>
    </div>

    {#if result?.no_winner}
        <p class="text-muted-foreground text-sm">
            모든 번호가 중복되어 <strong>당첨자가 없습니다.</strong>
        </p>
    {:else if winners.length > 0}
        {#if draw.method === 'lowest_unique' && draw.winning_number != null}
            <p class="text-foreground text-sm">
                당첨 번호 <strong class="text-primary">{draw.winning_number}</strong> —
                <strong>{winners[0]}</strong>
            </p>
        {:else}
            <p class="text-foreground mb-1 text-sm">당첨자</p>
            <ul class="flex flex-wrap gap-2">
                {#each winners as w (w)}
                    <li
                        class="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                    >
                        {w}
                    </li>
                {/each}
            </ul>
        {/if}

        {#if result?.designated && result?.reason}
            <div class="border-border mt-3 rounded-md border bg-white/60 p-3 dark:bg-black/20">
                <p class="text-muted-foreground text-xs font-medium">선정 사유</p>
                <p class="text-foreground mt-1 whitespace-pre-wrap text-sm">{result.reason}</p>
            </div>
        {:else if result?.designated}
            <p class="text-muted-foreground mt-2 text-xs">주최자가 직접 지명했습니다.</p>
        {/if}
    {/if}

    <!-- 사다리 시각화 -->
    {#if ladder && ladder.columns > 0}
        <div class="mt-4 overflow-x-auto">
            <svg
                width={ladder.columns * 44}
                height={ladder.levels * 22 + 40}
                class="min-w-full"
                role="img"
                aria-label="사다리 결과"
            >
                {#each Array(ladder.columns) as _, c (c)}
                    <line
                        x1={c * 44 + 22}
                        y1="16"
                        x2={c * 44 + 22}
                        y2={ladder.levels * 22 + 16}
                        stroke="currentColor"
                        stroke-width="2"
                        class="text-border"
                    />
                    <text
                        x={c * 44 + 22}
                        y="12"
                        text-anchor="middle"
                        class="fill-muted-foreground text-[10px]">{c + 1}</text
                    >
                    <text
                        x={c * 44 + 22}
                        y={ladder.levels * 22 + 32}
                        text-anchor="middle"
                        class="text-[10px] {c < ladder.win_slots
                            ? 'fill-emerald-600 font-bold'
                            : 'fill-muted-foreground'}">{c < ladder.win_slots ? '당첨' : '—'}</text
                    >
                {/each}
                {#each ladder.rungs as row, l (l)}
                    {#each row as on, gap (gap)}
                        {#if on}
                            <line
                                x1={gap * 44 + 22}
                                y1={l * 22 + 27}
                                x2={gap * 44 + 66}
                                y2={l * 22 + 27}
                                stroke="currentColor"
                                stroke-width="2"
                                class="text-primary"
                            />
                        {/if}
                    {/each}
                {/each}
            </svg>
            <p class="text-muted-foreground mt-1 text-xs">
                각 열 → 도착 열: {ladderEnd.map((e, i) => `${i + 1}→${e + 1}`).join(', ')}
            </p>
        </div>
    {/if}

    <!-- Commit-Reveal 재현 데이터 -->
    {#if draw.seed_hash}
        <details class="mt-3">
            <summary class="text-muted-foreground cursor-pointer text-xs"
                >공정성 검증 데이터</summary
            >
            <div class="text-muted-foreground mt-2 space-y-1 break-all text-xs">
                <p>seed_hash: <code>{draw.seed_hash}</code></p>
                {#if draw.seed}
                    <p>seed(공개): <code>{draw.seed}</code></p>
                {/if}
                {#if result?.input_hash}
                    <p>input_hash: <code>{result.input_hash}</code></p>
                {/if}
                {#if seedVerified === true}
                    <p class="font-medium text-emerald-600">✓ SHA-256(seed) = seed_hash 검증됨</p>
                {:else if seedVerified === false}
                    <p class="text-red-600">✗ 시드 해시 불일치</p>
                {/if}
            </div>
        </details>
    {/if}
</div>
