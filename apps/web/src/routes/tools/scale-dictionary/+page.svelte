<script lang="ts">
    import { onDestroy } from 'svelte';
    import { getLang } from '$lib/i18n/store.svelte';
    import { SCALES, ROOTS, noteAt, midiAt, type Scale } from './_lib/scales';

    const lang = $derived(getLang());

    let rootIdx = $state(0);
    let scaleIdx = $state(0);
    let isPlaying = $state(false);

    const root = $derived(ROOTS[rootIdx]);
    const scale = $derived(SCALES[scaleIdx]);
    const notes = $derived(scale.intervals.map((iv) => noteAt(rootIdx, iv)));
    const semitones = $derived(scale.intervals);

    const FAMILY_LABEL: Record<Scale['family'], { ko: string; en: string }> = {
        major: { ko: '메이저', en: 'Major' },
        minor: { ko: '마이너', en: 'Minor' },
        mode: { ko: '모드 (Modes)', en: 'Modes' },
        pentatonic: { ko: '펜타토닉 (5음)', en: 'Pentatonic' },
        blues: { ko: '블루스', en: 'Blues' },
        korean: { ko: '한국 전통', en: 'Korean Traditional' },
        world: { ko: '월드 / 민속', en: 'World / Folk' }
    };

    const families = ['major', 'minor', 'mode', 'pentatonic', 'blues', 'korean', 'world'] as const;

    let audioCtx: AudioContext | null = null;
    let stopFlag = false;

    function midiToFreq(midi: number): number {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    function getCtx(): AudioContext {
        if (!audioCtx) {
            const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
            audioCtx = new Ctx();
        }
        return audioCtx;
    }

    function playNote(midi: number, startTime: number, dur = 0.4) {
        const ctx = getCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = midiToFreq(midi);
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
        osc.start(startTime);
        osc.stop(startTime + dur);
    }

    async function playScale() {
        if (isPlaying) return;
        const ctx = getCtx();
        if (ctx.state === 'suspended') await ctx.resume();
        isPlaying = true;
        stopFlag = false;
        const rootMidi = 60 + rootIdx; // C4 = 60
        const dur = 0.4;
        let t = ctx.currentTime + 0.05;

        // 상행
        for (const iv of scale.intervals) {
            if (stopFlag) break;
            playNote(rootMidi + iv, t, dur);
            t += dur;
        }
        // 옥타브 위 root
        if (!stopFlag) {
            playNote(rootMidi + 12, t, dur);
            t += dur;
        }
        // 하행
        for (let i = scale.intervals.length - 1; i >= 0; i--) {
            if (stopFlag) break;
            playNote(rootMidi + scale.intervals[i], t, dur);
            t += dur;
        }
        const totalMs = (t - ctx.currentTime) * 1000;
        setTimeout(() => { if (!stopFlag) isPlaying = false; }, totalMs);
    }

    function stop() {
        stopFlag = true;
        isPlaying = false;
    }

    function playSingleNote(midi: number) {
        const ctx = getCtx();
        if (ctx.state === 'suspended') ctx.resume();
        playNote(midi, ctx.currentTime + 0.01, 0.3);
    }

    onDestroy(() => { stop(); audioCtx?.close(); });

    // 피아노 키보드 시각화 (2 옥타브 = 24 키)
    const KEYBOARD_KEYS = Array.from({ length: 25 }, (_, i) => ({
        midi: 60 + i, // C4 ~ C6
        isBlack: [1, 3, 6, 8, 10].includes((60 + i) % 12),
        offset: i % 12
    }));

    const rootMidi = $derived(60 + rootIdx);
    const scaleMidiSet = $derived(new Set(scale.intervals.map((iv) => (rootMidi + iv) % 12)));
</script>

<svelte:head>
    {#if lang === 'en'}
        <title>Scale Dictionary — 16 scales × 12 keys, Modes, Pentatonic, Korean traditional | Muzia</title>
        <meta name="description" content="192 scales reference: Major, Natural/Harmonic/Melodic Minor, 7 Modes (Ionian-Locrian), Pentatonic, Blues, Korean Pyeongjo & Gyemyeonjo, Japanese Hirajoshi, Gypsy. Piano visualization + audio playback + intervals." />
    {:else}
        <title>스케일 사전 — 16 스케일 × 12 키, 모드 / 펜타토닉 / 평조·계면조 | 뮤지아</title>
        <meta name="description" content="192 스케일 레퍼런스: 메이저 / 자연·화성·선율 단음계 / 모드 7종 (이오니안~로크리안) / 펜타토닉 / 블루스 / 평조·계면조 / 일본 히로조시 / 집시. 피아노 시각화 + 음원 재생 + 도수 표시." />
    {/if}
</svelte:head>

<div class="page">
    <nav class="crumb"><a href="/tools">{lang === 'en' ? '← Tools' : '← 도구 모음'}</a></nav>

    <header class="head">
        <h1>{lang === 'en' ? 'Scale Dictionary' : '스케일 사전'}</h1>
        <p>
            {lang === 'en'
                ? '16 scales × 12 keys = 192 scales. Major, Minor, 7 Modes, Pentatonic, Blues, Korean Pyeongjo/Gyemyeonjo, Japanese Hirajoshi, Gypsy.'
                : '16 스케일 × 12 키 = 192 스케일. 메이저 / 마이너 / 모드 7종 / 펜타토닉 / 블루스 / 평조·계면조 / 일본 히로조시 / 집시.'}
        </p>
    </header>

    <div class="controls">
        <div class="ctl-group">
            <span class="label">{lang === 'en' ? 'Root' : '루트'}</span>
            <div class="root-row">
                {#each ROOTS as r, i}
                    <button class="root-btn" class:on={i === rootIdx} onclick={() => rootIdx = i}>{r}</button>
                {/each}
            </div>
        </div>
    </div>

    {#each families as fam}
        {@const famScales = SCALES.filter((s) => s.family === fam)}
        <div class="family">
            <h3>{lang === 'en' ? FAMILY_LABEL[fam].en : FAMILY_LABEL[fam].ko}</h3>
            <div class="scales-row">
                {#each famScales as s}
                    {@const idx = SCALES.indexOf(s)}
                    <button
                        class="scale-btn"
                        class:on={idx === scaleIdx}
                        onclick={() => { stop(); scaleIdx = idx; }}
                    >
                        {lang === 'en' ? s.nameEn : s.name}
                    </button>
                {/each}
            </div>
        </div>
    {/each}

    <div class="display">
        <div class="display-head">
            <h2>{root} {lang === 'en' ? scale.nameEn : scale.name}</h2>
            <p class="scale-desc">{lang === 'en' ? scale.descEn : scale.desc}</p>
        </div>

        <div class="notes-row">
            {#each notes as n, i}
                <button
                    class="note-cell"
                    onclick={() => playSingleNote(rootMidi + scale.intervals[i])}
                    title="{lang === 'en' ? 'Click to play' : '클릭하여 재생'}"
                >
                    <div class="note-name">{n}</div>
                    <div class="note-degree">{i + 1}</div>
                    <div class="note-semis">{semitones[i]}st</div>
                </button>
            {/each}
            <div class="note-cell oct">
                <div class="note-name">{root}</div>
                <div class="note-degree">8</div>
                <div class="note-semis">12st</div>
            </div>
        </div>

        <div class="actions">
            <button class="primary" onclick={isPlaying ? stop : playScale}>
                {isPlaying ? (lang === 'en' ? '■ Stop' : '■ 정지') : (lang === 'en' ? '▶ Play scale (asc/desc)' : '▶ 스케일 재생 (상행/하행)')}
            </button>
        </div>

        <div class="keyboard">
            {#each KEYBOARD_KEYS as k}
                {@const inScale = scaleMidiSet.has(k.midi % 12)}
                {@const isRootKey = k.midi % 12 === rootMidi % 12}
                <button
                    class="key"
                    class:black={k.isBlack}
                    class:in-scale={inScale}
                    class:root={isRootKey && inScale}
                    onclick={() => playSingleNote(k.midi)}
                    aria-label="MIDI {k.midi}"
                ></button>
            {/each}
        </div>
        <div class="keyboard-legend">
            <span class="legend-item"><span class="dot legend-root"></span> {lang === 'en' ? 'Root' : '루트'}</span>
            <span class="legend-item"><span class="dot legend-scale"></span> {lang === 'en' ? 'Scale notes' : '스케일 음'}</span>
        </div>
    </div>

    <section class="info">
        <h3>{lang === 'en' ? 'How to use' : '사용법'}</h3>
        <ul>
            <li>{lang === 'en' ? 'Pick a root + scale → instant audio + visualization on the keyboard.' : '루트 + 스케일 선택 → 즉시 음원 + 피아노 시각화.'}</li>
            <li>{lang === 'en' ? 'Click any note (in the row or on the keyboard) to play single notes.' : '음 셀 또는 피아노 키 클릭 → 단음 재생.'}</li>
            <li>{lang === 'en' ? '"Play scale" plays ascending + descending across one octave.' : '"스케일 재생" = 한 옥타브 상행 + 하행.'}</li>
            <li>{lang === 'en' ? 'Numbers below each note show degree (1=root) and semitone distance from root.' : '각 음 아래 숫자 = 도수 (1=루트) + 루트로부터 반음 거리.'}</li>
        </ul>

        {#if !lang || lang === 'ko'}
            <h3>한국 음계 — 평조와 계면조</h3>
            <ul>
                <li><strong>평조</strong> — 황종(C) - 태주(D) - 중려(E) - 임종(G) - 남려(A) — 메이저 펜타토닉과 동일 음정 구조이지만 한국 전통의 호흡과 농음이 달라 느낌이 다름.</li>
                <li><strong>계면조</strong> — 황종(C) - 협종(E♭) - 중려(F) - 임종(G) - 무역(B♭) — 마이너 펜타토닉과 동일 음정. 한과 슬픔의 정서.</li>
                <li>학자별로 음 구성에 약간의 차이가 있음 (음역대 / 청아성 등). 본 페이지는 일반화된 표기.</li>
            </ul>
        {/if}
    </section>
</div>

<style>
    .page { max-width: 1100px; margin: 0 auto; padding: 24px 16px 64px; }
    .crumb { font-size: 13px; margin-bottom: 16px; }
    .crumb a { color: #6366f1; text-decoration: none; }
    .head h1 { font-size: 28px; margin: 4px 0 6px; font-weight: 800; }
    .head p { color: #6b7280; margin: 0 0 24px; font-size: 14px; line-height: 1.6; }
    .controls { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; margin-bottom: 20px; }
    .ctl-group { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .label { font-size: 13px; font-weight: 700; color: #4b5563; }
    .root-row { display: flex; gap: 4px; flex-wrap: wrap; }
    .root-btn { padding: 6px 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; min-width: 36px; }
    .root-btn:hover { background: #eef2ff; }
    .root-btn.on { background: #6366f1; color: #fff; border-color: #6366f1; }
    .family { margin-bottom: 14px; }
    .family h3 { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 6px; }
    .scales-row { display: flex; gap: 6px; flex-wrap: wrap; }
    .scale-btn { padding: 6px 12px; background: #fff; border: 1px solid #e5e7eb; border-radius: 999px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .scale-btn:hover { border-color: #6366f1; }
    .scale-btn.on { background: #6366f1; color: #fff; border-color: #6366f1; }
    .display { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 24px; margin-top: 16px; }
    .display-head h2 { font-size: 24px; margin: 0 0 4px; font-weight: 800; }
    .scale-desc { color: #6b7280; font-size: 13px; margin: 0 0 18px; }
    .notes-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
    .note-cell { padding: 14px 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; cursor: pointer; font-family: inherit; min-width: 70px; text-align: center; }
    .note-cell:hover { background: #eef2ff; }
    .note-cell.oct { background: #fef3c7; border-color: #fbbf24; cursor: default; }
    .note-name { font-size: 18px; font-weight: 800; }
    .note-degree { font-size: 11px; color: #6366f1; font-weight: 700; margin-top: 2px; }
    .note-semis { font-size: 10px; color: #9ca3af; margin-top: 2px; }
    .actions { text-align: center; margin: 16px 0; }
    .primary { padding: 12px 26px; background: #6366f1; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; }
    .keyboard { display: flex; gap: 0; padding: 8px; background: #1f2937; border-radius: 8px; overflow-x: auto; }
    .key { flex: 0 0 auto; width: 28px; height: 80px; background: #fff; border: 1px solid #e5e7eb; border-radius: 0 0 4px 4px; cursor: pointer; padding: 0; }
    .key.black { background: #1f2937; height: 50px; width: 18px; margin: 0 -9px; z-index: 2; position: relative; border-color: #374151; }
    .key.in-scale { background: #c7d2fe; }
    .key.black.in-scale { background: #4f46e5; }
    .key.root { background: #ec4899; }
    .key.black.root { background: #be185d; }
    .keyboard-legend { display: flex; gap: 12px; margin-top: 10px; font-size: 12px; color: #6b7280; }
    .legend-item { display: inline-flex; align-items: center; gap: 6px; }
    .dot { width: 12px; height: 12px; border-radius: 3px; }
    .dot.legend-root { background: #ec4899; }
    .dot.legend-scale { background: #c7d2fe; }
    .info { margin-top: 24px; padding: 18px; background: #f9fafb; border-radius: 10px; }
    .info h3 { font-size: 15px; margin: 12px 0 8px; }
    .info h3:first-child { margin-top: 0; }
    .info ul { margin: 0; padding-left: 18px; color: #4b5563; line-height: 1.8; font-size: 13px; }
    .info strong { color: #4f46e5; }
</style>
