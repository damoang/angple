<script lang="ts">
    import { onDestroy } from 'svelte';
    import { getLang } from '$lib/i18n/store.svelte';
    import { CHORD_TYPES, ROOTS, noteAt, type ChordType } from './_lib/chords';

    const lang = $derived(getLang());

    let rootIdx = $state(0);
    let typeIdx = $state(0);
    let isPlaying = $state(false);

    const root = $derived(ROOTS[rootIdx]);
    const chord = $derived(CHORD_TYPES[typeIdx]);
    const notes = $derived(chord.intervals.map((iv) => noteAt(rootIdx, iv)));
    const chordSymbol = $derived(root + chord.suffix);

    const FAMILY_LABEL: Record<ChordType['family'], { ko: string; en: string }> = {
        triad: { ko: '트라이어드 (3화음)', en: 'Triads' },
        seventh: { ko: '7화음 (Seventh)', en: 'Seventh Chords' },
        extended: { ko: '확장 화음 (9 / 11 / 13)', en: 'Extended (9/11/13)' },
        sus: { ko: 'Sus / 6화음', en: 'Sus / 6th Chords' },
        altered: { ko: '변화 화음 (Altered)', en: 'Altered Chords' }
    };

    const families = ['triad', 'seventh', 'extended', 'sus', 'altered'] as const;

    let audioCtx: AudioContext | null = null;

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
    function playNote(midi: number, startTime: number, dur = 0.6) {
        const ctx = getCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = midiToFreq(midi);
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
        gain.gain.linearRampToValueAtTime(0.1, startTime + dur * 0.6);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
        osc.start(startTime);
        osc.stop(startTime + dur);
    }

    async function playChord() {
        const ctx = getCtx();
        if (ctx.state === 'suspended') await ctx.resume();
        isPlaying = true;
        const rootMidi = 60 + rootIdx;
        const t = ctx.currentTime + 0.05;
        for (const iv of chord.intervals) {
            playNote(rootMidi + iv, t, 1.5);
        }
        setTimeout(() => isPlaying = false, 1600);
    }

    async function playArpeggio() {
        const ctx = getCtx();
        if (ctx.state === 'suspended') await ctx.resume();
        isPlaying = true;
        const rootMidi = 60 + rootIdx;
        const dur = 0.4;
        let t = ctx.currentTime + 0.05;
        for (const iv of chord.intervals) {
            playNote(rootMidi + iv, t, dur);
            t += dur;
        }
        const totalMs = (t - ctx.currentTime) * 1000;
        setTimeout(() => isPlaying = false, totalMs);
    }

    onDestroy(() => audioCtx?.close());

    // 피아노 키보드 시각화
    const KEYBOARD_KEYS = Array.from({ length: 25 }, (_, i) => ({
        midi: 60 + i,
        isBlack: [1, 3, 6, 8, 10].includes((60 + i) % 12)
    }));
    const rootMidi = $derived(60 + rootIdx);
    const chordMidiSet = $derived(new Set(chord.intervals.map((iv) => (rootMidi + iv) % 12)));
</script>

<svelte:head>
    {#if lang === 'en'}
        <title>Chord Dictionary — 30 chord types × 12 roots, voicings & playback | Muzia</title>
        <meta name="description" content="360 chords reference: Major, Minor, Diminished, Augmented, 7th (maj7/dom7/m7/mMaj7/m7♭5), 9/11/13, sus2/sus4/6/m6, altered (♭5/♯5/♭9/♯9, dim7, Lydian maj7♯11, Hendrix). Audio playback + arpeggio." />
    {:else}
        <title>코드 사전 — 30 코드 × 12 루트, 보이싱 + 재생 | 뮤지아</title>
        <meta name="description" content="360 코드 레퍼런스: 트라이어드 (메이저/마이너/감/증), 7화음 (maj7/도미넌트7/m7/mMaj7/반감7), 9/11/13, sus2/sus4/6/m6, 변화 화음 (♭5/♯5/♭9/♯9, dim7, 리디안 maj7♯11, Hendrix). 화음 + 분산화음 재생." />
    {/if}
</svelte:head>

<div class="page">
    <nav class="crumb"><a href="/tools">{lang === 'en' ? '← Tools' : '← 도구 모음'}</a></nav>

    <header class="head">
        <h1>{lang === 'en' ? 'Chord Dictionary' : '코드 사전'}</h1>
        <p>
            {lang === 'en'
                ? '30 chord types × 12 roots = 360 chords. Triads, 7th, 9/11/13, sus, altered (Lydian / Hendrix).'
                : '30 코드 타입 × 12 루트 = 360 코드. 트라이어드 / 7화음 / 9·11·13 / sus / 변화 화음.'}
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
        {@const famChords = CHORD_TYPES.filter((c) => c.family === fam)}
        <div class="family">
            <h3>{lang === 'en' ? FAMILY_LABEL[fam].en : FAMILY_LABEL[fam].ko}</h3>
            <div class="chords-row">
                {#each famChords as c}
                    {@const idx = CHORD_TYPES.indexOf(c)}
                    <button
                        class="chord-btn"
                        class:on={idx === typeIdx}
                        onclick={() => typeIdx = idx}
                    >
                        {root}{c.suffix || ''}<span class="chord-name-aux">{lang === 'en' ? c.nameEn : c.nameKo}</span>
                    </button>
                {/each}
            </div>
        </div>
    {/each}

    <div class="display">
        <div class="display-head">
            <h2>{chordSymbol}</h2>
            <p class="chord-desc"><strong>{lang === 'en' ? chord.nameEn : chord.nameKo}</strong> — {lang === 'en' ? chord.descEn : chord.desc}</p>
        </div>

        <div class="notes-row">
            {#each notes as n, i}
                <div class="note-cell">
                    <div class="note-name">{n}</div>
                    <div class="note-degree">{i === 0 ? 'R' : i + 1}</div>
                    <div class="note-semis">{chord.intervals[i]}st</div>
                </div>
            {/each}
        </div>

        <div class="actions">
            <button class="primary" onclick={playChord}>{lang === 'en' ? '🎹 Play chord' : '🎹 화음 재생'}</button>
            <button class="secondary" onclick={playArpeggio}>{lang === 'en' ? '🎼 Arpeggio' : '🎼 분산화음'}</button>
        </div>

        <div class="keyboard">
            {#each KEYBOARD_KEYS as k}
                {@const inChord = chordMidiSet.has(k.midi % 12)}
                {@const isRootKey = k.midi % 12 === rootMidi % 12}
                <button class="key" class:black={k.isBlack} class:in-chord={inChord} class:root={isRootKey && inChord}></button>
            {/each}
        </div>
    </div>

    <section class="info">
        <h3>{lang === 'en' ? 'Chord theory cheat sheet' : '코드 이론 요약'}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tbody>
                <tr><td style="padding:6px;width:30%;font-weight:600;">{lang === 'en' ? 'Major triad' : '메이저'}</td><td style="padding:6px;">R - M3 - P5</td></tr>
                <tr><td style="padding:6px;font-weight:600;">{lang === 'en' ? 'Minor triad' : '마이너'}</td><td style="padding:6px;">R - m3 - P5</td></tr>
                <tr><td style="padding:6px;font-weight:600;">{lang === 'en' ? 'Diminished' : '감화음'}</td><td style="padding:6px;">R - m3 - d5</td></tr>
                <tr><td style="padding:6px;font-weight:600;">{lang === 'en' ? 'Augmented' : '증화음'}</td><td style="padding:6px;">R - M3 - A5</td></tr>
                <tr><td style="padding:6px;font-weight:600;">Major 7</td><td style="padding:6px;">R - M3 - P5 - M7</td></tr>
                <tr><td style="padding:6px;font-weight:600;">Dominant 7</td><td style="padding:6px;">R - M3 - P5 - m7</td></tr>
                <tr><td style="padding:6px;font-weight:600;">Minor 7</td><td style="padding:6px;">R - m3 - P5 - m7</td></tr>
                <tr><td style="padding:6px;font-weight:600;">Half-dim (m7♭5)</td><td style="padding:6px;">R - m3 - d5 - m7</td></tr>
                <tr><td style="padding:6px;font-weight:600;">Dim 7</td><td style="padding:6px;">R - m3 - d5 - d7 (= 6)</td></tr>
            </tbody>
        </table>

        <h3 style="margin-top:18px;">{lang === 'en' ? 'Practical tips' : '실용 팁'}</h3>
        <ul>
            <li>{lang === 'en' ? 'Maj7 = jazz / bossa color. Dom7 = blues / strong resolution to I.' : 'Maj7 = 재즈 / 보사 색채. Dom7 = 블루스 / V→I 강한 해결.'}</li>
            <li>{lang === 'en' ? 'm7♭5 (half-dim) = ii in minor key. Common in ii-V-i.' : 'm7♭5 (반감) = 마이너 키의 ii. ii-V-i 진행에 흔함.'}</li>
            <li>{lang === 'en' ? 'Hendrix chord (7♯9) = funk / rock signature.' : 'Hendrix 코드 (7♯9) = 펑크 / 록의 시그니처.'}</li>
            <li>{lang === 'en' ? 'sus chords resolve down (4→3) for "amen" feel.' : 'sus 코드는 4→3 으로 해결 (아멘 느낌).'}</li>
        </ul>
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
    .chords-row { display: flex; gap: 6px; flex-wrap: wrap; }
    .chord-btn { padding: 6px 12px; background: #fff; border: 1px solid #e5e7eb; border-radius: 999px; font-size: 13px; cursor: pointer; font-family: inherit; font-weight: 700; }
    .chord-btn:hover { border-color: #6366f1; }
    .chord-btn.on { background: #6366f1; color: #fff; border-color: #6366f1; }
    .chord-name-aux { font-weight: 400; opacity: 0.7; margin-left: 6px; font-size: 11px; }
    .display { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 24px; margin-top: 16px; }
    .display-head h2 { font-size: 32px; margin: 0 0 4px; font-weight: 800; color: #4f46e5; }
    .chord-desc { color: #6b7280; font-size: 13px; margin: 0 0 18px; }
    .notes-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 18px; }
    .note-cell { padding: 14px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; min-width: 70px; text-align: center; }
    .note-name { font-size: 18px; font-weight: 800; }
    .note-degree { font-size: 11px; color: #6366f1; font-weight: 700; margin-top: 2px; }
    .note-semis { font-size: 10px; color: #9ca3af; margin-top: 2px; }
    .actions { text-align: center; margin: 16px 0; display: flex; gap: 8px; justify-content: center; }
    .primary { padding: 12px 26px; background: #6366f1; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; }
    .secondary { padding: 12px 22px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; cursor: pointer; font-family: inherit; }
    .keyboard { display: flex; gap: 0; padding: 8px; background: #1f2937; border-radius: 8px; overflow-x: auto; }
    .key { flex: 0 0 auto; width: 28px; height: 80px; background: #fff; border: 1px solid #e5e7eb; border-radius: 0 0 4px 4px; padding: 0; }
    .key.black { background: #1f2937; height: 50px; width: 18px; margin: 0 -9px; z-index: 2; position: relative; border-color: #374151; }
    .key.in-chord { background: #c7d2fe; }
    .key.black.in-chord { background: #4f46e5; }
    .key.root { background: #ec4899; }
    .key.black.root { background: #be185d; }
    .info { margin-top: 24px; padding: 18px; background: #f9fafb; border-radius: 10px; }
    .info h3 { font-size: 15px; margin: 12px 0 8px; }
    .info h3:first-child { margin-top: 0; }
    .info ul { margin: 0; padding-left: 18px; color: #4b5563; line-height: 1.8; font-size: 13px; }
    .info table td { border-bottom: 1px solid #e5e7eb; }
</style>
