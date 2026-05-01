<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { getLang } from '$lib/i18n/store.svelte';

    interface Interval {
        semitones: number;
        nameKo: string;
        nameEn: string;
    }

    const ALL_INTERVALS: Interval[] = [
        { semitones: 1, nameKo: '단2도', nameEn: 'Minor 2nd' },
        { semitones: 2, nameKo: '장2도', nameEn: 'Major 2nd' },
        { semitones: 3, nameKo: '단3도', nameEn: 'Minor 3rd' },
        { semitones: 4, nameKo: '장3도', nameEn: 'Major 3rd' },
        { semitones: 5, nameKo: '완전4도', nameEn: 'Perfect 4th' },
        { semitones: 6, nameKo: '증4도/감5도 (트라이톤)', nameEn: 'Tritone' },
        { semitones: 7, nameKo: '완전5도', nameEn: 'Perfect 5th' },
        { semitones: 8, nameKo: '단6도', nameEn: 'Minor 6th' },
        { semitones: 9, nameKo: '장6도', nameEn: 'Major 6th' },
        { semitones: 10, nameKo: '단7도', nameEn: 'Minor 7th' },
        { semitones: 11, nameKo: '장7도', nameEn: 'Major 7th' },
        { semitones: 12, nameKo: '완전8도 (옥타브)', nameEn: 'Perfect Octave' }
    ];

    type Difficulty = 'easy' | 'medium' | 'hard';
    type Mode = 'melodic-up' | 'melodic-down' | 'harmonic';

    const lang = $derived(getLang());

    let difficulty = $state<Difficulty>('easy');
    let mode = $state<Mode>('melodic-up');

    // 난이도별 음정 풀
    const POOL: Record<Difficulty, number[]> = {
        easy: [4, 5, 7, 12], // 장3, 완4, 완5, 옥타브
        medium: [2, 3, 4, 5, 7, 9, 12], // + 장2, 단3, 장6
        hard: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] // 전체
    };

    let current = $state<Interval | null>(null);
    let choices = $state<Interval[]>([]);
    let answered = $state<number | null>(null);
    let score = $state(0);
    let total = $state(0);

    const STORAGE_KEY = 'muzia.tool.interval-trainer.v1';

    function loadStats() {
        if (typeof localStorage === 'undefined') return;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                score = data.score ?? 0;
                total = data.total ?? 0;
            }
        } catch {}
    }

    function saveStats() {
        if (typeof localStorage === 'undefined') return;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ score, total })); } catch {}
    }

    let audioCtx: AudioContext | null = null;
    function getCtx(): AudioContext {
        if (!audioCtx) {
            const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
            audioCtx = new Ctx();
        }
        return audioCtx;
    }
    function midiToFreq(midi: number): number {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }
    function playNote(midi: number, startTime: number, dur = 0.7) {
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

    async function playInterval(iv: Interval) {
        const ctx = getCtx();
        if (ctx.state === 'suspended') await ctx.resume();
        const rootMidi = 60 + Math.floor(Math.random() * 5); // C4~F4 범덤 root
        const t = ctx.currentTime + 0.05;
        if (mode === 'harmonic') {
            playNote(rootMidi, t, 1.5);
            playNote(rootMidi + iv.semitones, t, 1.5);
        } else if (mode === 'melodic-up') {
            playNote(rootMidi, t, 0.7);
            playNote(rootMidi + iv.semitones, t + 0.7, 0.7);
        } else {
            playNote(rootMidi + iv.semitones, t, 0.7);
            playNote(rootMidi, t + 0.7, 0.7);
        }
    }

    function newQuestion() {
        const pool = POOL[difficulty].map((s) => ALL_INTERVALS.find((iv) => iv.semitones === s)!);
        const correct = pool[Math.floor(Math.random() * pool.length)];
        // 보기: 정답 + 같은 풀에서 3개 무작위
        const wrong = pool.filter((p) => p.semitones !== correct.semitones);
        const shuffledWrong = wrong.sort(() => Math.random() - 0.5).slice(0, 3);
        const all = [correct, ...shuffledWrong].sort(() => Math.random() - 0.5);
        current = correct;
        choices = all;
        answered = null;
        playInterval(correct);
    }

    function pick(idx: number) {
        if (answered !== null || !current) return;
        answered = idx;
        total++;
        if (choices[idx].semitones === current.semitones) score++;
        saveStats();
    }

    function replay() {
        if (current) playInterval(current);
    }

    function resetStats() {
        if (!confirm(lang === 'en' ? 'Reset statistics?' : '통계를 초기화할까요?')) return;
        score = 0; total = 0; saveStats();
    }

    onMount(() => { loadStats(); newQuestion(); });
    onDestroy(() => audioCtx?.close());

    const accuracy = $derived(total > 0 ? Math.round((score / total) * 100) : 0);
</script>

<svelte:head>
    {#if lang === 'en'}
        <title>Interval Trainer — Ear Training (Melodic / Harmonic) | Muzia</title>
        <meta name="description" content="Free interval ear-training tool. Listen and identify intervals (m2 ~ P8 octave). 3 modes (ascending / descending / harmonic) × 3 difficulties (easy / medium / hard). Progress saved." />
    {:else}
        <title>인터벌 트레이너 — 청음 훈련 (선율 / 화성) | 뮤지아</title>
        <meta name="description" content="무료 음정 청음 훈련. 두 음 듣고 음정 (단2도 ~ 완전8도) 맞히기. 상행 / 하행 / 화성 3 모드 × 3 난이도 (쉬움 / 보통 / 어려움). 정답률 자동 저장." />
    {/if}
</svelte:head>

<div class="page">
    <nav class="crumb"><a href="/tools">{lang === 'en' ? '← Tools' : '← 도구 모음'}</a></nav>

    <header class="head">
        <h1>{lang === 'en' ? 'Interval Trainer' : '인터벌 트레이너'}</h1>
        <p>
            {lang === 'en'
                ? 'Listen and identify intervals. Train your ear with melodic (asc/desc) and harmonic modes. 3 difficulty levels.'
                : '두 음 듣고 음정 맞히기. 선율 (상행/하행) + 화성 모드. 난이도 3 단계.'}
        </p>
    </header>

    <div class="settings">
        <div class="set-group">
            <span class="label">{lang === 'en' ? 'Difficulty' : '난이도'}</span>
            <button class="opt" class:on={difficulty === 'easy'} onclick={() => { difficulty = 'easy'; newQuestion(); }}>
                {lang === 'en' ? 'Easy (4)' : '쉬움 (4 음정)'}
            </button>
            <button class="opt" class:on={difficulty === 'medium'} onclick={() => { difficulty = 'medium'; newQuestion(); }}>
                {lang === 'en' ? 'Medium (7)' : '보통 (7 음정)'}
            </button>
            <button class="opt" class:on={difficulty === 'hard'} onclick={() => { difficulty = 'hard'; newQuestion(); }}>
                {lang === 'en' ? 'Hard (12)' : '어려움 (12 음정)'}
            </button>
        </div>
        <div class="set-group">
            <span class="label">{lang === 'en' ? 'Mode' : '모드'}</span>
            <button class="opt" class:on={mode === 'melodic-up'} onclick={() => { mode = 'melodic-up'; newQuestion(); }}>
                {lang === 'en' ? '↑ Asc' : '↑ 상행'}
            </button>
            <button class="opt" class:on={mode === 'melodic-down'} onclick={() => { mode = 'melodic-down'; newQuestion(); }}>
                {lang === 'en' ? '↓ Desc' : '↓ 하행'}
            </button>
            <button class="opt" class:on={mode === 'harmonic'} onclick={() => { mode = 'harmonic'; newQuestion(); }}>
                {lang === 'en' ? '🎵 Harm' : '🎵 화성'}
            </button>
        </div>
    </div>

    <div class="stats">
        <div class="stat-item">
            <div class="stat-num">{score}/{total}</div>
            <div class="stat-label">{lang === 'en' ? 'Score' : '점수'}</div>
        </div>
        <div class="stat-item">
            <div class="stat-num">{accuracy}%</div>
            <div class="stat-label">{lang === 'en' ? 'Accuracy' : '정답률'}</div>
        </div>
        <button class="reset" onclick={resetStats}>{lang === 'en' ? '↺ Reset' : '↺ 초기화'}</button>
    </div>

    <div class="quiz">
        <div class="play-row">
            <button class="play-btn" onclick={replay}>
                🔊 {lang === 'en' ? 'Replay' : '다시 듣기'}
            </button>
        </div>

        <div class="choices">
            {#each choices as c, i}
                <button
                    class="choice"
                    class:correct={answered !== null && c.semitones === current?.semitones}
                    class:wrong={answered === i && c.semitones !== current?.semitones}
                    disabled={answered !== null}
                    onclick={() => pick(i)}
                >
                    {lang === 'en' ? c.nameEn : c.nameKo}
                </button>
            {/each}
        </div>

        {#if answered !== null && current}
            <div class="explain">
                {choices[answered].semitones === current.semitones
                    ? `✓ ${lang === 'en' ? 'Correct!' : '정답!'}`
                    : `✗ ${lang === 'en' ? 'Wrong — answer:' : '오답 — 정답:'} ${lang === 'en' ? current.nameEn : current.nameKo} (${current.semitones} ${lang === 'en' ? 'semitones' : '반음'})`}
            </div>
            <button class="primary" onclick={newQuestion}>
                {lang === 'en' ? 'Next →' : '다음 →'}
            </button>
        {/if}
    </div>

    <section class="info">
        <h3>{lang === 'en' ? 'Tips for ear training' : '청음 훈련 팁'}</h3>
        <ul>
            <li>{lang === 'en' ? 'Each interval has signature songs. Examples: P5 = Twinkle Twinkle, M3 = Oh When the Saints, m3 = Greensleeves.' : '각 음정마다 시그니처 곡이 있음. 예: 완전5도 = 반짝반짝 작은별, 장3도 = 학교종, 단3도 = Greensleeves 시작 음정.'}</li>
            <li>{lang === 'en' ? 'Major intervals = bright, Minor = dark, Perfect = stable, Tritone = tense.' : '장음정 = 밝음, 단음정 = 어두움, 완전음정 = 안정, 트라이톤 = 긴장.'}</li>
            <li>{lang === 'en' ? 'Train daily 5-10 minutes — consistency beats long sessions.' : '하루 5~10분 매일 — 길게 한 번보다 짧게 매일이 효과.'}</li>
            <li>{lang === 'en' ? 'Start with Easy (P4/P5/M3/Octave) until 90%+ accuracy, then move to Medium.' : '쉬움 (완4/완5/장3/옥타브) 90%+ 정답률 도달 후 보통으로 진행.'}</li>
        </ul>

        <h3 style="margin-top:18px;">{lang === 'en' ? 'Common interval references (Korean songs / hymns)' : '음정 시그니처 (한국 곡 / 찬송가)'}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tbody>
                <tr><td style="padding:6px;width:30%;font-weight:600;">{lang === 'en' ? 'Minor 2nd' : '단2도'}</td><td style="padding:6px;">Jaws 테마 / 슬픈 영화 음악</td></tr>
                <tr><td style="padding:6px;font-weight:600;">{lang === 'en' ? 'Major 2nd' : '장2도'}</td><td style="padding:6px;">Happy Birthday 시작</td></tr>
                <tr><td style="padding:6px;font-weight:600;">{lang === 'en' ? 'Minor 3rd' : '단3도'}</td><td style="padding:6px;">Greensleeves / 동요 "곰 세 마리"</td></tr>
                <tr><td style="padding:6px;font-weight:600;">{lang === 'en' ? 'Major 3rd' : '장3도'}</td><td style="padding:6px;">학교종 / Oh When the Saints</td></tr>
                <tr><td style="padding:6px;font-weight:600;">{lang === 'en' ? 'Perfect 4th' : '완전4도'}</td><td style="padding:6px;">결혼 행진곡 / Amazing Grace</td></tr>
                <tr><td style="padding:6px;font-weight:600;">{lang === 'en' ? 'Tritone' : '트라이톤'}</td><td style="padding:6px;">Maria (West Side Story)</td></tr>
                <tr><td style="padding:6px;font-weight:600;">{lang === 'en' ? 'Perfect 5th' : '완전5도'}</td><td style="padding:6px;">반짝반짝 작은별 / Star Wars 테마</td></tr>
                <tr><td style="padding:6px;font-weight:600;">{lang === 'en' ? 'Major 6th' : '장6도'}</td><td style="padding:6px;">My Bonnie / NBC 차임</td></tr>
                <tr><td style="padding:6px;font-weight:600;">{lang === 'en' ? 'Octave' : '옥타브'}</td><td style="padding:6px;">Somewhere Over the Rainbow / 도깨비 OST 도입</td></tr>
            </tbody>
        </table>
    </section>
</div>

<style>
    .page { max-width: 720px; margin: 0 auto; padding: 24px 16px 64px; }
    .crumb { font-size: 13px; margin-bottom: 16px; }
    .crumb a { color: #6366f1; text-decoration: none; }
    .head h1 { font-size: 28px; margin: 4px 0 6px; font-weight: 800; }
    .head p { color: #6b7280; margin: 0 0 24px; font-size: 14px; line-height: 1.6; }
    .settings { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 14px; }
    .set-group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .label { font-size: 12px; font-weight: 700; color: #4b5563; min-width: 60px; }
    .opt { padding: 6px 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 999px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .opt:hover { border-color: #6366f1; }
    .opt.on { background: #6366f1; color: #fff; border-color: #6366f1; }
    .stats { display: flex; gap: 14px; align-items: center; padding: 12px 16px; background: #eef2ff; border-radius: 10px; margin-bottom: 16px; }
    .stat-item { flex: 0 0 auto; }
    .stat-num { font-size: 20px; font-weight: 800; color: #4f46e5; line-height: 1; }
    .stat-label { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .reset { margin-left: auto; background: transparent; border: 1px solid #c7d2fe; color: #4f46e5; padding: 6px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; font-family: inherit; }
    .quiz { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 28px; }
    .play-row { text-align: center; margin-bottom: 24px; }
    .play-btn { padding: 16px 32px; background: #6366f1; color: #fff; border: none; border-radius: 12px; font-size: 16px; font-weight: 800; cursor: pointer; font-family: inherit; }
    .choices { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    @media (max-width: 500px) { .choices { grid-template-columns: 1fr; } }
    .choice { padding: 14px 18px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 14px; cursor: pointer; font-family: inherit; font-weight: 600; }
    .choice:not(:disabled):hover { background: #eef2ff; border-color: #6366f1; }
    .choice.correct { background: #ecfdf5; border-color: #10b981; color: #047857; }
    .choice.wrong { background: #fef2f2; border-color: #ef4444; color: #b91c1c; }
    .choice:disabled { cursor: default; }
    .explain { margin-top: 18px; padding: 14px 16px; background: #f5f3ff; border-radius: 10px; font-size: 14px; color: #4c1d95; font-weight: 700; }
    .primary { margin-top: 12px; width: 100%; padding: 14px; background: #6366f1; color: #fff; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; }
    .info { margin-top: 24px; padding: 18px; background: #f9fafb; border-radius: 10px; }
    .info h3 { font-size: 15px; margin: 12px 0 8px; }
    .info h3:first-child { margin-top: 0; }
    .info ul { margin: 0; padding-left: 18px; color: #4b5563; line-height: 1.8; font-size: 13px; }
    .info table td { border-bottom: 1px solid #e5e7eb; }
</style>
