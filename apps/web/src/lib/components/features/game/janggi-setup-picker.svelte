<script lang="ts">
    /**
     * 상차림 고르기 — 4가지 배치를 자기 쪽에서 본 뒷줄 미리보기 버튼으로 보여 준다.
     */
    import {
        KIND,
        SETUPS,
        SETUP_LABEL,
        SETUP_LAYOUT,
        TEAM,
        pieceGlyph,
        type Setup
    } from '$lib/games/janggi/rules';

    interface Props {
        value: Setup;
        team?: number;
        legend?: string;
        disabled?: boolean;
        onSelect: (setup: Setup) => void;
    }

    let { value, team = TEAM.CHO, legend = '상차림', disabled = false, onSelect }: Props = $props();

    // 자기 시점 뒷줄: 차 [1] [2] 사 · 사 [3] [4] 차 (가운데는 궁이 한 줄 위)
    function backRow(setup: Setup): number[] {
        const k = SETUP_LAYOUT[setup];
        return [KIND.CHA, k[0], k[1], KIND.SA, 0, KIND.SA, k[2], k[3], KIND.CHA];
    }

    function octPoints(cx: number, cy: number, r: number): string {
        const pts: string[] = [];
        for (let i = 0; i < 8; i++) {
            const a = (Math.PI / 4) * i + Math.PI / 8;
            pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
        }
        return pts.join(' ');
    }

    const STEP = 20;
    const isCho = $derived(team === TEAM.CHO);
    // 장기판(janggi-board)과 같은 알 색 — 초 청록·남색, 한 주홍
    const inkColor = $derived(isCho ? '#0e5566' : '#c2371d');
    const uid = $props.id();
</script>

<fieldset class="space-y-2" {disabled}>
    <legend class="text-foreground mb-1 text-sm font-medium">{legend}</legend>
    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {#each SETUPS as s, si (s)}
            {@const row = backRow(s)}
            <button
                type="button"
                class="flex flex-col items-center gap-1 rounded-lg border p-2 text-xs transition-colors {value ===
                s
                    ? 'border-primary bg-primary/10 ring-primary ring-1'
                    : 'hover:bg-muted'}"
                aria-pressed={value === s}
                aria-label="{s} ({SETUP_LABEL[s]})"
                onclick={() => onSelect(s)}
            >
                <svg viewBox="0 0 180 34" class="h-auto w-full max-w-[180px]" aria-hidden="true">
                    <defs>
                        <linearGradient id="{uid}-f{si}" x1="0.2" y1="0" x2="0.8" y2="1">
                            <stop offset="0" stop-color="#fcf4e1" />
                            <stop offset="1" stop-color="#e6cc9c" />
                        </linearGradient>
                    </defs>
                    <rect width="180" height="34" rx="4" class="sp-wood" />
                    <line x1="10" y1="17" x2="170" y2="17" class="sp-line" />
                    {#each row as kind, i (i)}
                        {#if kind}
                            {@const big = kind === KIND.MA || kind === KIND.SANG}
                            <!-- 옆면 두께 한 단 + 윗면 그라디언트(장기판 알과 같은 느낌) -->
                            <polygon
                                points={octPoints(10 + i * STEP, 18.2, big ? 9 : 7.5)}
                                class="sp-side"
                            />
                            <polygon
                                points={octPoints(10 + i * STEP, 17, big ? 9 : 7.5)}
                                fill="url(#{uid}-f{si})"
                                class="sp-rim"
                                stroke-width="0.7"
                            />
                            <polygon
                                points={octPoints(10 + i * STEP, 17, big ? 7.3 : 6)}
                                fill="none"
                                stroke={inkColor}
                                stroke-width={big ? 1.2 : 0.7}
                                opacity={big ? 0.9 : 0.6}
                            />
                            <text
                                x={10 + i * STEP}
                                y="17.5"
                                font-size={big ? 10.5 : 8.5}
                                text-anchor="middle"
                                dominant-baseline="central"
                                font-weight="800"
                                fill={inkColor}
                                >{pieceGlyph(kind, team)[0]}</text
                            >
                        {/if}
                    {/each}
                </svg>
                <span class="font-semibold">{s}</span>
                <span class="text-muted-foreground">{SETUP_LABEL[s]}</span>
            </button>
        {/each}
    </div>
</fieldset>

<style>
    .sp-wood {
        fill: #e3bd84;
    }
    :global(.dark) .sp-wood,
    :global(.amoled) .sp-wood {
        fill: #9a7240;
    }
    .sp-line {
        stroke: #5b3a1a;
        stroke-width: 0.8;
        opacity: 0.6;
    }
    .sp-side {
        fill: #8c6534;
    }
    .sp-rim {
        stroke: #8a6538;
    }
</style>
