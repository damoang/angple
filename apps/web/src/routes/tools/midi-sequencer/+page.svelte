<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import {
        STEPS,
        PITCHES,
        rowToMidi,
        midiToNoteName,
        newTrack,
        type Track
    } from './_lib/track';
    import { createInstrument, INSTRUMENT_LABEL, type ToneInstrument } from './_lib/instruments';
    import { exportMidi, importMidi, downloadBlob } from './_lib/midi-io';

    const STORAGE_KEY = 'muzia.tool.midi-sequencer.v1';

    const initialTrack = newTrack('Piano', 'piano');
    let tracks = $state<Track[]>([initialTrack]);
    let bpm = $state(120);
    let activeTrackId = $state(initialTrack.id);
    let isPlaying = $state(false);
    let currentStep = $state(-1);
    let stepTimer: ReturnType<typeof setTimeout> | null = null;
    let instruments = new Map<string, ToneInstrument>();

    const activeTrack = $derived(tracks.find((t) => t.id === activeTrackId) ?? tracks[0]);

    onMount(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const data = JSON.parse(saved);
                if (Array.isArray(data.tracks)) {
                    tracks = data.tracks;
                    bpm = data.bpm ?? 120;
                    activeTrackId = tracks[0]?.id ?? '';
                }
            }
        } catch {}
    });

    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    $effect(() => {
        const snapshot = JSON.stringify({ tracks, bpm });
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            try { localStorage.setItem(STORAGE_KEY, snapshot); } catch {}
        }, 600);
    });

    function addTrack() {
        if (tracks.length >= 4) return;
        const presets: Track['instrument'][] = ['piano', 'bass', 'strings', 'drums'];
        const used = new Set(tracks.map((t) => t.instrument));
        const next = presets.find((p) => !used.has(p)) ?? 'piano';
        const tr = newTrack(INSTRUMENT_LABEL[next].split(' ')[1], next);
        tracks = [...tracks, tr];
        activeTrackId = tr.id;
    }

    function removeTrack(id: string) {
        if (tracks.length <= 1) return;
        const inst = instruments.get(id);
        if (inst) {
            inst.dispose();
            instruments.delete(id);
        }
        tracks = tracks.filter((t) => t.id !== id);
        if (activeTrackId === id) activeTrackId = tracks[0].id;
    }

    function toggleCell(row: number, step: number) {
        const next = tracks.map((t) =>
            t.id === activeTrackId
                ? { ...t, cells: t.cells.map((r, ri) => (ri === row ? r.map((c, ci) => (ci === step ? !c : c)) : r)) }
                : t
        );
        tracks = next;
    }

    async function ensureInstrument(tr: Track): Promise<ToneInstrument> {
        let inst = instruments.get(tr.id);
        if (!inst) {
            inst = await createInstrument(tr.instrument);
            instruments.set(tr.id, inst);
        }
        inst.volume.value = tr.mute ? -Infinity : tr.volume;
        return inst;
    }

    async function play() {
        if (isPlaying) return;
        const Tone = await import('tone');
        if (Tone.getContext().state !== 'running') await Tone.start();

        for (const tr of tracks) await ensureInstrument(tr);

        const interval = (60 / bpm / 4) * 1000;
        const hasSolo = tracks.some((t) => t.solo);
        let step = 0;
        isPlaying = true;
        currentStep = 0;

        const tick = async () => {
            if (!isPlaying) return;
            currentStep = step;
            for (const tr of tracks) {
                if (tr.mute) continue;
                if (hasSolo && !tr.solo) continue;
                const inst = await ensureInstrument(tr);
                for (let row = 0; row < PITCHES; row++) {
                    if (!tr.cells[row][step]) continue;
                    const midi = rowToMidi(row);
                    const noteName = midiToNoteName(midi);
                    try {
                        inst.triggerAttackRelease(noteName, (interval / 1000) * 0.9);
                    } catch (e) {
                        console.warn('trigger failed', tr.instrument, noteName, e);
                    }
                }
            }
            step = (step + 1) % STEPS;
            stepTimer = setTimeout(tick, interval);
        };
        tick();
    }

    function stop() {
        isPlaying = false;
        if (stepTimer) clearTimeout(stepTimer);
        stepTimer = null;
        currentStep = -1;
    }

    function clearActive() {
        if (!confirm('현재 트랙의 모든 노트를 지우시겠습니까?')) return;
        tracks = tracks.map((t) =>
            t.id === activeTrackId
                ? { ...t, cells: Array.from({ length: PITCHES }, () => Array<boolean>(STEPS).fill(false)) }
                : t
        );
    }

    async function downloadMidi() {
        const blob = await exportMidi(tracks, bpm);
        downloadBlob(blob, `muzia-sequencer-${Date.now()}.mid`);
    }

    async function uploadMidi(e: Event) {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (!f) return;
        try {
            const result = await importMidi(f);
            for (const inst of instruments.values()) inst.dispose();
            instruments.clear();
            tracks = result.tracks;
            bpm = result.bpm;
            activeTrackId = tracks[0].id;
        } catch (err) {
            alert(`MIDI 로드 실패: ${err}`);
        }
    }

    function setInstrument(tr: Track, inst: Track['instrument']) {
        const old = instruments.get(tr.id);
        if (old) {
            old.dispose();
            instruments.delete(tr.id);
        }
        tracks = tracks.map((t) => (t.id === tr.id ? { ...t, instrument: inst } : t));
    }

    onDestroy(() => {
        stop();
        for (const inst of instruments.values()) inst.dispose();
        instruments.clear();
        if (saveTimer) clearTimeout(saveTimer);
    });
</script>

<svelte:head>
    <title>MIDI 시퀀서 — 4 트랙 작·편곡 무료 도구 | 뮤지아</title>
    <meta
        name="description"
        content="브라우저에서 작·편곡: 4 트랙 (Piano / Bass / Strings / Drums) 32 스텝 시퀀서. 트랙별 mute / solo / 볼륨, 마스터 BPM, .mid 파일 입출력. DAW 없이 바로."
    />
    <meta property="og:title" content="뮤지아 MIDI 시퀀서" />
</svelte:head>

<div class="page">
    <nav class="crumb"><a href="/tools">← 도구 모음</a></nav>

    <header class="head">
        <h1>MIDI 시퀀서</h1>
        <p>4 트랙 × 32 스텝 × 2 옥타브. 작·편곡 / 데모 / 비트 메이킹. <code>.mid</code> 파일 입출력.</p>
    </header>

    <div class="toolbar">
        <button class="primary" onclick={isPlaying ? stop : play}>
            {isPlaying ? '■ 정지' : '▶ 재생'}
        </button>
        <label class="bpm">
            BPM
            <input type="range" min="60" max="200" bind:value={bpm} />
            <span class="bpm-num">{bpm}</span>
        </label>
        <button class="ghost" onclick={addTrack} disabled={tracks.length >= 4}>+ 트랙 추가</button>
        <button class="ghost" onclick={clearActive}>현재 트랙 비우기</button>
        <button class="ghost" onclick={downloadMidi}>.mid 다운로드</button>
        <label class="ghost upload">
            .mid 업로드
            <input type="file" accept=".mid,.midi" onchange={uploadMidi} hidden />
        </label>
    </div>

    <div class="track-list">
        {#each tracks as tr (tr.id)}
            <div class="track-row" class:active={tr.id === activeTrackId}>
                <button class="track-name" onclick={() => (activeTrackId = tr.id)}>
                    {INSTRUMENT_LABEL[tr.instrument]}
                </button>
                <select onchange={(e) => setInstrument(tr, (e.currentTarget as HTMLSelectElement).value as Track['instrument'])} value={tr.instrument}>
                    {#each Object.entries(INSTRUMENT_LABEL) as [k, label]}
                        <option value={k}>{label}</option>
                    {/each}
                </select>
                <button class="mini" class:on={tr.mute} onclick={() => (tracks = tracks.map((t) => (t.id === tr.id ? { ...t, mute: !t.mute } : t)))}>M</button>
                <button class="mini" class:on={tr.solo} onclick={() => (tracks = tracks.map((t) => (t.id === tr.id ? { ...t, solo: !t.solo } : t)))}>S</button>
                <input
                    type="range"
                    min="-30"
                    max="0"
                    bind:value={tr.volume}
                    onchange={(e) => {
                        const v = parseFloat((e.currentTarget as HTMLInputElement).value);
                        tracks = tracks.map((t) => (t.id === tr.id ? { ...t, volume: v } : t));
                    }}
                />
                {#if tracks.length > 1}
                    <button class="x" onclick={() => removeTrack(tr.id)} aria-label="remove track">✕</button>
                {/if}
            </div>
        {/each}
    </div>

    <div class="grid-wrap">
        <div class="step-row">
            <div class="key-spacer"></div>
            {#each Array(STEPS) as _, s}
                <div class="step-num" class:beat={s % 4 === 0} class:current={s === currentStep}>
                    {s + 1}
                </div>
            {/each}
        </div>
        {#each Array(PITCHES) as _, row}
            {@const midi = rowToMidi(row)}
            {@const isBlack = [1, 3, 6, 8, 10].includes(midi % 12)}
            <div class="row" class:black={isBlack}>
                <div class="key-label">{midiToNoteName(midi)}</div>
                {#each Array(STEPS) as _, step}
                    <button
                        class="cell"
                        class:on={activeTrack.cells[row][step]}
                        class:beat={step % 4 === 0}
                        class:current={step === currentStep}
                        onclick={() => toggleCell(row, step)}
                        aria-label="{midiToNoteName(midi)} step {step + 1}"
                    ></button>
                {/each}
            </div>
        {/each}
    </div>

    <section class="info">
        <h2>사용법</h2>
        <ul>
            <li><strong>트랙</strong> — 최대 4개 (Piano · Bass · Strings · Drums). 각 트랙 인스트루먼트 선택 가능.</li>
            <li><strong>편집 트랙 선택</strong> — 트랙 이름 클릭. 격자가 해당 트랙의 노트 표시.</li>
            <li><strong>M / S</strong> — Mute / Solo. Solo 트랙이 하나라도 있으면 Solo 트랙만 재생.</li>
            <li><strong>.mid 다운로드</strong> — DAW (Logic / Cubase / Ableton / FL Studio) 에서 불러올 수 있는 표준 MIDI.</li>
            <li><strong>.mid 업로드</strong> — 다른 MIDI 파일을 32 스텝 격자로 가져오기 (32 스텝 초과분은 잘림).</li>
            <li><strong>자동 저장</strong> — 작업 내용은 브라우저에 자동 저장. 새로고침 시 복원.</li>
        </ul>

        <h3 style="font-size:15px;margin-top:20px;">🎼 4 트랙 편곡 가이드</h3>
        <ul>
            <li><strong>Piano (멜로디 / 화성)</strong> — 코드 진행을 백킹으로. 또는 멜로디 라인 메인. 음역대 C3-C5 권장.</li>
            <li><strong>Bass (베이스 라인)</strong> — 각 코드의 루트음 위주. 음역대 E1-G2. 1, 9 스텝에 강하게.</li>
            <li><strong>Strings (스트링)</strong> — 긴 노트 (4박 이상) 로 화성을 받쳐줌. 코드의 위쪽 음 (3음 / 5음).</li>
            <li><strong>Drums (드럼)</strong> — 킥 1, 9 / 스네어 5, 13 / 하이햇 모든 8분 (8 step 마다).</li>
        </ul>

        <h3 style="font-size:15px;margin-top:20px;">🎚️ DAW 임포트 워크플로</h3>
        <ul>
            <li><strong>Logic Pro</strong> — File → Import → MIDI File. 트랙별로 자동 분할.</li>
            <li><strong>Cubase</strong> — File → Import → MIDI File. Track 폴더 자동 생성.</li>
            <li><strong>Ableton Live</strong> — Drag &amp; Drop .mid 파일 → MIDI 트랙으로 자동 변환.</li>
            <li><strong>FL Studio</strong> — File → Import → MIDI. Channel Rack 에 트랙별 추가.</li>
            <li><strong>Studio One</strong> — Drag &amp; Drop 또는 Song → Import File.</li>
        </ul>

        <h3 style="font-size:15px;margin-top:20px;">🎹 MIDI 표준 정보</h3>
        <ul>
            <li>이 도구는 <strong>SMF (Standard MIDI File) Type 1</strong> 형식으로 저장. 모든 DAW 에서 호환.</li>
            <li>벨로시티는 0.85 고정 (Phase 2 에서 가변 지원 예정).</li>
            <li>한 트랙 = 한 채널 (CH 1~4) 매핑. GM (General MIDI) 표준 인스트루먼트 사용 안 함 — DAW 임포트 후 수동 인스트 지정 권장.</li>
            <li>업로드 시 32 스텝 초과분 자동 잘림. Phase 2 에서 64 / 128 스텝 확장 예정.</li>
        </ul>
    </section>
</div>

<style>
    .page {
        max-width: 1200px;
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
        margin: 0 0 18px;
        font-size: 14px;
    }
    .head code {
        background: #eef2ff;
        color: #4f46e5;
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 12px;
    }
    .toolbar {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        align-items: center;
        padding: 14px;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        margin-bottom: 12px;
    }
    .primary {
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
    .ghost {
        padding: 8px 14px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        font-size: 13px;
        cursor: pointer;
        font-family: inherit;
    }
    .upload {
        display: inline-flex;
        align-items: center;
    }
    .bpm {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #6b7280;
    }
    .bpm input[type='range'] {
        width: 120px;
    }
    .bpm-num {
        font-weight: 700;
        color: #1f2937;
        min-width: 32px;
    }
    .track-list {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 8px;
        margin-bottom: 12px;
    }
    .track-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 6px;
    }
    .track-row.active {
        background: #eef2ff;
    }
    .track-row + .track-row {
        margin-top: 2px;
    }
    .track-name {
        flex: 0 0 110px;
        text-align: left;
        background: transparent;
        border: none;
        font-weight: 700;
        cursor: pointer;
        font-size: 13px;
        padding: 4px 8px;
        border-radius: 6px;
        font-family: inherit;
    }
    .track-row.active .track-name {
        color: #4f46e5;
    }
    .track-row select {
        padding: 4px 8px;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        font-size: 12px;
        font-family: inherit;
    }
    .mini {
        width: 28px;
        height: 28px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
    }
    .mini.on {
        background: #6366f1;
        color: #fff;
        border-color: #4f46e5;
    }
    .x {
        margin-left: auto;
        background: transparent;
        border: none;
        color: #9ca3af;
        font-size: 14px;
        cursor: pointer;
    }
    .x:hover {
        color: #ef4444;
    }
    .grid-wrap {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 8px;
        overflow-x: auto;
    }
    .step-row,
    .row {
        display: grid;
        grid-template-columns: 50px repeat(32, minmax(20px, 1fr));
        gap: 1px;
    }
    .step-row {
        margin-bottom: 4px;
    }
    .step-num {
        text-align: center;
        font-size: 9px;
        color: #9ca3af;
        font-variant-numeric: tabular-nums;
        padding: 2px 0;
    }
    .step-num.beat {
        color: #4b5563;
        font-weight: 700;
    }
    .step-num.current {
        color: #6366f1;
    }
    .key-spacer {
        width: 50px;
    }
    .row + .row {
        margin-top: 1px;
    }
    .key-label {
        font-size: 10px;
        font-family: monospace;
        background: #fff;
        border: 1px solid #e5e7eb;
        color: #4b5563;
        padding: 0 4px;
        height: 18px;
        text-align: right;
        line-height: 18px;
    }
    .black .key-label {
        background: #1f2937;
        color: #d1d5db;
        border-color: #1f2937;
    }
    .cell {
        height: 18px;
        background: #f9fafb;
        border: 1px solid #f3f4f6;
        cursor: pointer;
        padding: 0;
    }
    .black .cell {
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
</style>
