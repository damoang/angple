<script lang="ts">
    import { onDestroy } from 'svelte';
    import { PROGRESSIONS, GENRES, GENRE_LABEL, GENRE_ICON, type Genre } from './_lib/progressions';

    const KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'F', 'B♭', 'E♭', 'A♭', 'D♭'];
    const NOTE_TO_FREQ: Record<string, number> = {
        C: 261.63,
        'C♯': 277.18,
        'D♭': 277.18,
        D: 293.66,
        'D♯': 311.13,
        'E♭': 311.13,
        E: 329.63,
        F: 349.23,
        'F♯': 369.99,
        'G♭': 369.99,
        G: 392.0,
        'G♯': 415.3,
        'A♭': 415.3,
        A: 440.0,
        'A♯': 466.16,
        'B♭': 466.16,
        B: 493.88
    };

    // Roman 도수 → step (반음) + 코드 종류 매핑 (메이저 + 마이너 + chromatic)
    const ROMAN_MAP: Record<string, { step: number; type: 'maj' | 'min' | 'dim' | 'aug' | 'dom7' }> = {
        // 메이저 다이어토닉
        'I': { step: 0, type: 'maj' }, 'ii': { step: 2, type: 'min' }, 'iii': { step: 4, type: 'min' },
        'IV': { step: 5, type: 'maj' }, 'V': { step: 7, type: 'maj' }, 'vi': { step: 9, type: 'min' },
        'vii°': { step: 11, type: 'dim' },
        // 마이너 키 (i 마이너 기준 — 자연 단음계)
        'i': { step: 0, type: 'min' }, 'ii°': { step: 2, type: 'dim' }, 'III': { step: 3, type: 'maj' },
        'iv': { step: 5, type: 'min' }, 'v': { step: 7, type: 'min' }, 'VI': { step: 8, type: 'maj' },
        'VII': { step: 10, type: 'maj' },
        // 비-다이어토닉 / 모달
        '♭III': { step: 3, type: 'maj' }, '♭VI': { step: 8, type: 'maj' }, '♭VII': { step: 10, type: 'maj' },
        // 이차 도미넌트 (메이저 키 기준)
        'V/vi': { step: 4, type: 'maj' }, 'V/ii': { step: 9, type: 'maj' },
        'V/IV': { step: 0, type: 'dom7' }, 'V/V': { step: 2, type: 'maj' },
        'VI7': { step: 9, type: 'dom7' }
    };

    const CHROMATIC = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

    function transpose(note: string, semitones: number): string {
        const idx = CHROMATIC.indexOf(note);
        if (idx < 0) return note;
        return CHROMATIC[(idx + semitones + 12) % 12];
    }

    function buildChord(root: string, type: 'maj' | 'min' | 'dim' | 'aug' | 'dom7'): string[] {
        const intervals =
            type === 'maj' ? [0, 4, 7] :
            type === 'min' ? [0, 3, 7] :
            type === 'dim' ? [0, 3, 6] :
            type === 'aug' ? [0, 4, 8] :
            [0, 4, 7, 10]; // dom7
        return intervals.map((iv) => transpose(root, iv));
    }

    function chordName(root: string, type: 'maj' | 'min' | 'dim' | 'aug' | 'dom7'): string {
        if (type === 'maj') return root;
        if (type === 'min') return root + 'm';
        if (type === 'dim') return root + '°';
        if (type === 'aug') return root + '+';
        return root + '7';
    }

    let key = $state('C');
    let genreFilter = $state<Genre | 'all'>('all');
    let progIdx = $state(0);
    let bpm = $state(80);
    let isPlaying = $state(false);
    let currentBeat = $state(-1);

    const filteredProgressions = $derived(
        genreFilter === 'all' ? PROGRESSIONS : PROGRESSIONS.filter((p) => p.genre === genreFilter)
    );

    $effect(() => {
        if (progIdx >= filteredProgressions.length) progIdx = 0;
    });

    const progression = $derived(filteredProgressions[progIdx] ?? PROGRESSIONS[0]);
    const chords = $derived(
        progression.roman.map((roman) => {
            const m = ROMAN_MAP[roman];
            if (!m) return { roman, name: roman, notes: [] };
            const root = transpose(key, m.step);
            return {
                roman,
                name: chordName(root, m.type),
                notes: buildChord(root, m.type)
            };
        })
    );

    let audioCtx: AudioContext | null = null;
    let stopFlag = false;

    function getCtx(): AudioContext {
        if (!audioCtx) {
            const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
            audioCtx = new Ctx();
        }
        return audioCtx;
    }

    function playChord(notes: string[], startTime: number, duration: number) {
        const ctx = getCtx();
        for (const note of notes) {
            const freq = NOTE_TO_FREQ[note];
            if (!freq) continue;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = freq;
            osc.connect(gain);
            gain.connect(ctx.destination);
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
            gain.gain.linearRampToValueAtTime(0.12, startTime + duration * 0.6);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
            osc.start(startTime);
            osc.stop(startTime + duration);
        }
    }

    async function play() {
        if (isPlaying) return;
        const ctx = getCtx();
        if (ctx.state === 'suspended') await ctx.resume();
        isPlaying = true;
        stopFlag = false;
        const beatDur = 60 / bpm;
        const chordDur = beatDur * 2;
        let t = ctx.currentTime + 0.05;

        for (let i = 0; i < chords.length; i++) {
            if (stopFlag) break;
            playChord(chords[i].notes, t, chordDur);
            const delayMs = (t - ctx.currentTime) * 1000;
            const beatIdx = i;
            setTimeout(() => {
                if (!stopFlag) currentBeat = beatIdx;
            }, Math.max(0, delayMs));
            t += chordDur;
        }
        const totalMs = (t - ctx.currentTime) * 1000;
        setTimeout(() => {
            if (!stopFlag) {
                isPlaying = false;
                currentBeat = -1;
            }
        }, totalMs);
    }

    function stop() {
        stopFlag = true;
        isPlaying = false;
        currentBeat = -1;
    }

    onDestroy(() => {
        stop();
        audioCtx?.close();
    });
</script>

<svelte:head>
    <title>코드 진행 추천기 — 30+ 진행 (팝/K-Pop/CCM/재즈/블루스/EDM/힙합/포크/트로트/록) | 뮤지아</title>
    <meta
        name="description"
        content="12 키 × 30+ 코드 진행 (팝 5 / K-Pop 5 / CCM 4 / 재즈 5 / 블루스 3 / EDM 3 / 힙합 3 / 포크 2 / 트로트 2 / 록 3). 장르 필터 + 브라우저 음원 미리듣기. 작곡 / 편곡 / 즉흥연주."
    />
</svelte:head>

<div class="page">
    <nav class="crumb"><a href="/tools">← 도구 모음</a></nav>

    <header class="head">
        <h1>코드 진행 추천</h1>
        <p>장르 + 키 선택 → 30+ 진행 자동 생성 + 브라우저 음원 재생. 팝 / K-Pop / CCM / 재즈 / 블루스 / EDM / 힙합 / 포크 / 트로트 / 록.</p>
    </header>

    <div class="controls">
        <label>
            키
            <select bind:value={key}>
                {#each KEYS as k}
                    <option value={k}>{k}</option>
                {/each}
            </select>
        </label>

        <label>
            BPM
            <input type="number" bind:value={bpm} min="40" max="200" />
        </label>
    </div>

    <div class="genre-chips">
        <button class="chip" class:on={genreFilter === 'all'} onclick={() => { genreFilter = 'all'; progIdx = 0; }}>
            전체 <span class="chip-count">{PROGRESSIONS.length}</span>
        </button>
        {#each GENRES as g}
            {@const count = PROGRESSIONS.filter((p) => p.genre === g).length}
            <button class="chip" class:on={genreFilter === g} onclick={() => { genreFilter = g; progIdx = 0; }}>
                {GENRE_ICON[g]} {GENRE_LABEL[g]} <span class="chip-count">{count}</span>
            </button>
        {/each}
    </div>

    <div class="progressions">
        {#each filteredProgressions as p, i}
            <button
                class="prog-card"
                class:selected={i === progIdx}
                onclick={() => {
                    stop();
                    progIdx = i;
                }}
            >
                <div class="prog-genre">{GENRE_ICON[p.genre]} {GENRE_LABEL[p.genre]}</div>
                <div class="prog-name">{p.name}</div>
                <div class="prog-roman">{p.roman.join(' - ')}</div>
                <div class="prog-desc">{p.desc}</div>
            </button>
        {/each}
    </div>

    <div class="display">
        <div class="chord-row">
            {#each chords as c, i}
                <div class="chord" class:active={i === currentBeat}>
                    <div class="roman">{c.roman}</div>
                    <div class="name">{c.name}</div>
                    <div class="notes">{c.notes.join(' · ')}</div>
                </div>
            {/each}
        </div>

        <div class="actions">
            <button class="play-btn" onclick={isPlaying ? stop : play}>
                {isPlaying ? '■ 정지' : '▶ 재생'}
            </button>
        </div>
    </div>
</div>

<style>
    .page {
        max-width: 980px;
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
        gap: 18px;
        margin-bottom: 20px;
        flex-wrap: wrap;
    }
    .controls label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
    }
    .controls select,
    .controls input {
        padding: 8px 10px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-family: inherit;
    }
    .controls input[type='number'] {
        width: 80px;
    }
    .progressions {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 10px;
        margin-bottom: 24px;
    }
    .genre-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 14px;
    }
    .chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 999px;
        font-size: 12px;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.12s;
    }
    .chip:hover {
        border-color: #6366f1;
    }
    .chip.on {
        background: #6366f1;
        color: #fff;
        border-color: #6366f1;
    }
    .chip-count {
        font-size: 10px;
        opacity: 0.7;
        font-weight: 700;
        background: rgba(0,0,0,0.08);
        padding: 1px 5px;
        border-radius: 999px;
    }
    .chip.on .chip-count {
        background: rgba(255,255,255,0.25);
    }
    .prog-genre {
        font-size: 10px;
        color: #9ca3af;
        font-weight: 700;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        margin-bottom: 4px;
    }
    .prog-card {
        text-align: left;
        padding: 14px 16px;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.12s;
    }
    .prog-card:hover {
        border-color: #6366f1;
    }
    .prog-card.selected {
        background: #eef2ff;
        border-color: #6366f1;
    }
    .prog-name {
        font-weight: 700;
        font-size: 14px;
        margin-bottom: 4px;
    }
    .prog-roman {
        font-family: monospace;
        font-size: 13px;
        color: #6366f1;
    }
    .prog-desc {
        font-size: 12px;
        color: #6b7280;
        margin-top: 6px;
        line-height: 1.5;
    }
    .display {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        padding: 28px;
    }
    .chord-row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: center;
        margin-bottom: 24px;
    }
    .chord {
        flex: 0 0 auto;
        min-width: 96px;
        padding: 16px 12px;
        text-align: center;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        transition: all 0.15s;
    }
    .chord.active {
        background: #6366f1;
        border-color: #6366f1;
        color: #fff;
        transform: translateY(-2px);
    }
    .roman {
        font-size: 12px;
        color: #6b7280;
        font-family: monospace;
    }
    .chord.active .roman {
        color: #c7d2fe;
    }
    .name {
        font-size: 22px;
        font-weight: 800;
        margin: 4px 0;
    }
    .notes {
        font-size: 11px;
        color: #6b7280;
        font-family: monospace;
    }
    .chord.active .notes {
        color: #c7d2fe;
    }
    .actions {
        text-align: center;
    }
    .play-btn {
        padding: 14px 36px;
        background: #6366f1;
        color: #fff;
        border: none;
        border-radius: 10px;
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
    }
    .play-btn:hover {
        background: #4f46e5;
    }
</style>
