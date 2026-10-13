<script lang="ts">
    /**
     * 먹은 말 줄 — capturer 진영이 잡은 상대 말을 잡은 순서대로 작은 팔각 알로 보여 준다.
     *
     * 같은 종류는 살짝 겹쳐 한 묶음(360px 폭에서도 한 줄), 줄 끝에 점수 합.
     * 색·글자는 보드와 같다(janggi/theme 토큰 · pieceGlyph). 로컬·온라인 공용.
     */
    import { KIND, TEAM, pieceGlyph, type JanggiPiece } from '$lib/games/janggi/rules';
    import { JANGGI_TOKEN_STYLE } from '$lib/games/janggi/theme';
    import { capturedBy, capturedPoints, groupCaptured } from '$lib/games/janggi/captured';

    interface Props {
        pieces: JanggiPiece[];
        /** 잡힌 순서(pieces 인덱스) — nextCaptureOrder 결과 */
        order: readonly number[];
        /** 잡은 진영 */
        capturer: number;
    }

    let { pieces, order, capturer }: Props = $props();

    const uid = $props.id();

    // 알 하나: 반지름 R, 옆면 두께 D, 겹칠 때 다음 알까지 STEP
    const R = 10.5;
    const D = 2;
    const STEP = 8;
    const H = R * 2 + D + 2;

    function octPoints(r: number): string {
        const pts: string[] = [];
        for (let i = 0; i < 8; i++) {
            const a = (Math.PI / 4) * i + Math.PI / 8;
            pts.push(`${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`);
        }
        return pts.join(' ');
    }
    const OCT = octPoints(R);

    const KIND_NAME: Record<number, string> = {
        [KIND.GUNG]: '궁',
        [KIND.CHA]: '차',
        [KIND.SANG]: '상',
        [KIND.MA]: '마',
        [KIND.SA]: '사',
        [KIND.PO]: '포',
        [KIND.JOLE]: '졸'
    };

    const list = $derived(capturedBy(pieces, order, capturer));
    const groups = $derived(groupCaptured(list));
    const points = $derived(capturedPoints(list));
    const teamLabel = $derived(capturer === TEAM.CHO ? '초' : '한');
    const summary = $derived(
        (capturer === TEAM.CHO ? '초(楚)가' : '한(漢)이') +
            ' 잡은 말: ' +
            (groups.length
                ? groups
                      .map((g) => {
                          const name =
                              g.kind === KIND.JOLE && g.team === TEAM.HAN
                                  ? '병'
                                  : KIND_NAME[g.kind];
                          return `${name} ${g.count}`;
                      })
                      .join(', ')
                : '없음') +
            ` · ${points}점`
    );

    function groupWidth(count: number): number {
        return R * 2 + 2 + (count - 1) * STEP;
    }
</script>

<div
    class="jc bg-muted/50 relative flex h-8 w-full max-w-[560px] items-center gap-1.5 overflow-hidden rounded-md px-2"
    style={JANGGI_TOKEN_STYLE}
>
    <span
        class="jc-label shrink-0 text-xs font-bold {capturer === TEAM.CHO ? 'jc-cho' : 'jc-han'}"
        aria-hidden="true">{teamLabel}</span
    >
    <div class="flex min-w-0 flex-nowrap items-center gap-1" aria-hidden="true">
        {#each groups as g (g.kind + '-' + g.team)}
            {@const glyph = pieceGlyph(g.kind, g.team)}
            <svg
                width={groupWidth(g.count)}
                height={H}
                viewBox="0 0 {groupWidth(g.count)} {H}"
                class="shrink-0 {g.team === TEAM.CHO ? 'jc-cho' : 'jc-han'}"
            >
                {#each Array(g.count) as _, k (k)}
                    <g transform="translate({R + 1 + k * STEP} {R + 1})">
                        <polygon points={OCT} transform="translate(0 {D})" class="jc-side" />
                        <polygon points={OCT} fill="url(#{uid}-face)" class="jc-face" />
                        <text
                            y="0.5"
                            class="jc-glyph"
                            text-anchor="middle"
                            dominant-baseline="central">{glyph[0]}</text
                        >
                    </g>
                {/each}
            </svg>
        {/each}
    </div>
    <span class="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums" aria-hidden="true"
        >{points}점</span
    >
    <span class="sr-only">{summary}</span>
    <!-- 알 윗면 그라디언트 — 줄마다 1회(크기 0 svg, 화면에 안 보임) -->
    <svg width="0" height="0" class="absolute" aria-hidden="true">
        <defs>
            <linearGradient id="{uid}-face" x1="0.2" y1="0" x2="0.8" y2="1">
                <stop offset="0" style="stop-color: var(--jb-face-a)" />
                <stop offset="1" style="stop-color: var(--jb-face-b)" />
            </linearGradient>
        </defs>
    </svg>
</div>

<style>
    .jc-cho {
        --jb-team: var(--jb-cho);
        --jb-team-deep: var(--jb-cho-deep);
    }
    .jc-han {
        --jb-team: var(--jb-han);
        --jb-team-deep: var(--jb-han-deep);
    }
    /* 줄 바깥(페이지 바탕)에 놓이는 진영 글자 — 다크 모드에서는 밝은 색 */
    .jc {
        --jc-label-cho: var(--jb-cho);
        --jc-label-han: var(--jb-han);
    }
    :global(.dark) .jc,
    :global(.amoled) .jc {
        --jc-label-cho: #5fc0d3;
        --jc-label-han: #f08a73;
    }
    .jc-label.jc-cho {
        color: var(--jc-label-cho);
    }
    .jc-label.jc-han {
        color: var(--jc-label-han);
    }
    .jc-side {
        fill: var(--jb-side-3);
    }
    .jc-face {
        stroke: var(--jb-rim);
        stroke-width: 0.8;
    }
    .jc-glyph {
        fill: var(--jb-team);
        stroke: var(--jb-team-deep);
        stroke-width: 0.3;
        font-size: 12px;
        font-family: 'Noto Serif KR', 'Nanum Myeongjo', 'Noto Serif CJK KR', serif;
        font-weight: 800;
    }
</style>
