<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import {
        STEPS,
        PITCHES,
        emptyCells,
        rowToMidi,
        midiToNoteName,
        rowIsBlackKey,
        stepIsBeatStart,
        activeNotesAtStep,
        type Cells
    } from './_lib/grid';
    import { saveLocal, loadLocal, toShareHash, fromShareHash } from './_lib/storage';
    import { ensureAudioReady, getSynth, midiToFreq, previewNote, disposeSynth } from './_lib/playback';

    let cells = $state<Cells>(emptyCells());
    let bpm = $state(120);
    let isPlaying = $state(false);
    let currentStep = $state(-1);
    let copied = $state(false);

    let stepTimer: ReturnType<typeof setTimeout> | null = null;

    onMount(() => {
        const hash = location.hash.replace(/^#/, '');
        if (hash) {
            const fromUrl = fromShareHash(hash);
            if (fromUrl) {
                cells = fromUrl.cells;
                bpm = fromUrl.bpm;
                return;
            }
        }
        const local = loadLocal();
        if (local) {
            cells = local.cells;
            bpm = local.bpm;
        }
    });

    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    $effect(() => {
        // 자동 저장 (debounce 500ms). cells 와 bpm 변경 시 트리거
        const snapshot = { cells: cells.map((r) => r.slice()), bpm };
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => saveLocal(snapshot), 500);
    });

    async function toggleCell(row: number, step: number) {
        const next = cells.map((r) => r.slice());
        next[row][step] = !next[row][step];
        cells = next;
        if (next[row][step]) {
            await previewNote(rowToMidi(row), 0.18);
        }
    }

    async function play() {
        if (isPlaying) return;
        await ensureAudioReady();
        const synth = await getSynth();
        isPlaying = true;
        let step = 0;
        const interval = (60 / bpm / 4) * 1000;

        const tick = () => {
            if (!isPlaying) return;
            const notes = activeNotesAtStep(cells, step);
            currentStep = step;
            if (notes.length > 0) {
                const freqs = notes.map(midiToFreq);
                synth.triggerAttackRelease(freqs, interval / 1000 * 0.9);
            }
            step = (step + 1) % STEPS;
            stepTimer = setTimeout(tick, interval);
        };
        tick();
    }

    function stop() {
        isPlaying = false;
        if (stepTimer) {
            clearTimeout(stepTimer);
            stepTimer = null;
        }
        currentStep = -1;
    }

    function clear() {
        if (!confirm('모든 노트를 지우시겠습니까?')) return;
        cells = emptyCells();
    }

    async function share() {
        const hash = toShareHash({ cells, bpm });
        const url = `${location.origin}${location.pathname}#${hash}`;
        try {
            await navigator.clipboard.writeText(url);
            copied = true;
            setTimeout(() => (copied = false), 2000);
        } catch {
            prompt('이 URL 을 복사하세요:', url);
        }
    }

    function downloadJSON() {
        const data = { bpm, cells, version: 1 };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `piano-roll-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    onDestroy(() => {
        stop();
        disposeSynth();
        if (saveTimer) clearTimeout(saveTimer);
    });
</script>

<svelte:head>
    <title>피아노 롤 — 무료 온라인 작곡 도구 | 뮤지아</title>
    <meta
        name="description"
        content="브라우저에서 바로 만드는 16스텝 × 2옥타브 피아노 롤. 클릭으로 노트 입력, 즉시 재생, 공유 URL, JSON 다운로드. 작곡 / 편곡 / 멜로디 메모용."
    />
    <meta property="og:title" content="뮤지아 피아노 롤" />
</svelte:head>

<div class="page">
    <nav class="crumb"><a href="/tools">← 도구 모음</a></nav>

    <header class="head">
        <h1>피아노 롤</h1>
        <p>16 스텝 × 2 옥타브. 격자 클릭으로 멜로디 입력, 즉시 재생. 자동 저장 + 공유 URL.</p>
    </header>

    <div class="controls">
        <button class="play" class:playing={isPlaying} onclick={isPlaying ? stop : play}>
            {isPlaying ? '■ 정지' : '▶ 재생'}
        </button>
        <label class="bpm">
            BPM
            <input type="range" min="60" max="200" bind:value={bpm} />
            <span class="bpm-num">{bpm}</span>
        </label>
        <button class="ghost" onclick={clear}>전체 지우기</button>
        <button class="ghost" onclick={share}>{copied ? '✓ 복사됨' : '🔗 공유'}</button>
        <button class="ghost" onclick={downloadJSON}>JSON 다운로드</button>
    </div>

    <div class="grid-wrap">
        <div class="step-header">
            <div class="key-spacer"></div>
            {#each Array(STEPS) as _, s}
                <div
                    class="step-num"
                    class:beat={stepIsBeatStart(s)}
                    class:current={s === currentStep}
                >
                    {s + 1}
                </div>
            {/each}
        </div>
        {#each Array(PITCHES) as _, row}
            {@const midi = rowToMidi(row)}
            <div class="row" class:black-row={rowIsBlackKey(row)}>
                <button class="key-label" onclick={() => previewNote(midi, 0.3)}>
                    {midiToNoteName(midi)}
                </button>
                {#each Array(STEPS) as _, step}
                    <button
                        class="cell"
                        class:on={cells[row][step]}
                        class:beat={stepIsBeatStart(step)}
                        class:current={step === currentStep}
                        onclick={() => toggleCell(row, step)}
                        aria-label="{midiToNoteName(midi)} step {step + 1}"
                        aria-pressed={cells[row][step]}
                    ></button>
                {/each}
            </div>
        {/each}
    </div>

    <section class="info">
        <h2>사용법</h2>
        <ul>
            <li><strong>격자 클릭</strong> — 노트 켜기/끄기. 클릭 시 음 미리듣기.</li>
            <li><strong>키 라벨 클릭</strong> — 해당 음을 미리 들어볼 수 있음.</li>
            <li><strong>자동 저장</strong> — 작업 내용은 브라우저에 자동 저장 (localStorage).</li>
            <li><strong>공유 URL</strong> — 현재 패턴을 URL 로 공유. 받은 사람도 즉시 재생/편집 가능.</li>
            <li><strong>JSON 다운로드</strong> — 외부 도구에서 가공할 수 있도록 데이터 저장.</li>
        </ul>

        <h3 style="font-size:15px;margin-top:20px;">🎹 멜로디 만들기 팁</h3>
        <ul>
            <li><strong>스케일 안에서 시작</strong> — 모든 음을 흰 건반 (C 메이저: C-D-E-F-G-A-B) 으로 한정하면 음이 자연스러움</li>
            <li><strong>도약은 적게</strong> — 멜로디는 보통 2도 / 3도 step 위주, 큰 도약 (5도+) 은 강조용</li>
            <li><strong>강박에 화성음</strong> — 1, 5 박 (4/4 의 1, 9 step) 에는 코드 안의 음 (C 메이저 진행이면 C-E-G)</li>
            <li><strong>긴장과 해결</strong> — 후렴 끝에는 "도(C)" 또는 "솔(G)" 로 회귀 → 안정감</li>
            <li><strong>리듬 다양화</strong> — 같은 음 길이만 쓰면 단조로움. 4분 + 8분 + 점음표 섞기</li>
        </ul>

        <h3 style="font-size:15px;margin-top:20px;">🥁 리듬 패턴 예시 (4/4 16스텝)</h3>
        <ul>
            <li><strong>4-on-the-floor (하우스)</strong> — 스텝 1, 5, 9, 13 (모든 다운비트)</li>
            <li><strong>록 비트</strong> — 킥 1, 9 / 스네어 5, 13 / 하이햇 모든 8분음표</li>
            <li><strong>보사노바</strong> — 1, 4, 7, 11, 14 (싱코페이션)</li>
            <li><strong>K-Pop 댄스</strong> — 록 비트 변형 + 16분음표 트리플 강세</li>
            <li><strong>발라드</strong> — 1, 9 (큰 비트만), 빠른 음표 X</li>
            <li><strong>트랩</strong> — 하이햇 16분음표 분할 (특히 32분 stutter)</li>
        </ul>

        <h3 style="font-size:15px;margin-top:20px;">⌨️ 단축키</h3>
        <ul>
            <li>현재 키보드 단축키는 미지원 — Phase 2 에서 스페이스바 (재생/정지), 화살표 (BPM ±) 추가 예정</li>
        </ul>

        <p class="hint">
            iOS Safari 에서는 첫 재생 시 "터치"가 필요합니다 (Web Audio 정책).
            데스크톱 / 안드로이드는 즉시 재생됩니다. 모바일 가로 스크롤 지원.
        </p>
    </section>
</div>

<style>
    .page {
        max-width: 1080px;
        margin: 0 auto;
        padding: 24px 16px 64px;
    }
    .crumb {
        font-size: 13px;
        margin-bottom: 16px;
    }
    .crumb a {
        color: #6366f1;
        text-decoration: none;
    }
    .head h1 {
        font-size: 28px;
        margin: 4px 0 6px;
        font-weight: 800;
    }
    .head p {
        color: #6b7280;
        margin: 0 0 20px;
        font-size: 14px;
    }
    .controls {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: center;
        margin-bottom: 16px;
        padding: 14px 16px;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
    }
    .play {
        padding: 10px 22px;
        background: #6366f1;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
    }
    .play.playing {
        background: #ef4444;
    }
    .ghost {
        padding: 8px 14px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        font-size: 13px;
        cursor: pointer;
        font-family: inherit;
    }
    .ghost:hover {
        background: #f3f4f6;
    }
    .bpm {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #6b7280;
    }
    .bpm input[type='range'] {
        width: 140px;
    }
    .bpm-num {
        font-variant-numeric: tabular-nums;
        font-weight: 700;
        color: #1f2937;
        min-width: 36px;
    }
    .grid-wrap {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 8px;
        overflow-x: auto;
        touch-action: manipulation;
    }
    .step-header,
    .row {
        display: grid;
        grid-template-columns: 60px repeat(16, minmax(28px, 1fr));
        gap: 2px;
    }
    .step-header {
        margin-bottom: 4px;
    }
    .step-num {
        text-align: center;
        font-size: 10px;
        color: #9ca3af;
        font-variant-numeric: tabular-nums;
        padding: 4px 0;
    }
    .step-num.beat {
        color: #4b5563;
        font-weight: 700;
    }
    .step-num.current {
        color: #6366f1;
    }
    .key-spacer {
        width: 60px;
    }
    .row + .row {
        margin-top: 1px;
    }
    .key-label {
        font-size: 11px;
        background: #fff;
        border: 1px solid #e5e7eb;
        color: #4b5563;
        padding: 0 6px;
        height: 20px;
        cursor: pointer;
        font-family: monospace;
        text-align: right;
    }
    .black-row .key-label {
        background: #1f2937;
        color: #d1d5db;
        border-color: #1f2937;
    }
    .cell {
        height: 20px;
        background: #f9fafb;
        border: 1px solid #f3f4f6;
        cursor: pointer;
        padding: 0;
    }
    .black-row .cell {
        background: #f3f4f6;
    }
    .cell.beat {
        border-left: 1px solid #d1d5db;
    }
    .cell.current {
        background: #eef2ff;
    }
    .cell.on {
        background: #6366f1;
        border-color: #4f46e5;
    }
    .cell.on.current {
        background: #ec4899;
        border-color: #db2777;
    }
    .cell:hover:not(.on) {
        background: #e0e7ff;
    }
    .info {
        margin-top: 32px;
        padding: 20px;
        background: #f9fafb;
        border-radius: 10px;
    }
    .info h2 {
        font-size: 16px;
        margin: 0 0 10px;
    }
    .info ul {
        margin: 0;
        padding-left: 18px;
        color: #4b5563;
        line-height: 1.8;
        font-size: 14px;
    }
    .info .hint {
        margin: 14px 0 0;
        font-size: 12px;
        color: #9ca3af;
    }
</style>
