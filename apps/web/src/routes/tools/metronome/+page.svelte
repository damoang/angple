<script lang="ts">
    import { onDestroy } from 'svelte';

    let bpm = $state(120);
    let beatsPerMeasure = $state(4);
    let isPlaying = $state(false);
    let currentBeat = $state(0);
    let volume = $state(0.6);
    let accent = $state(true);

    let audioCtx: AudioContext | null = null;
    let nextNoteTime = 0;
    let scheduleAheadTime = 0.1;
    let lookahead = 25;
    let timerId: ReturnType<typeof setInterval> | null = null;
    let beatCounter = 0;

    function getCtx(): AudioContext {
        if (!audioCtx) {
            const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
            audioCtx = new Ctx();
        }
        return audioCtx;
    }

    function scheduleNote(beat: number, time: number) {
        const ctx = getCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        const isAccent = accent && beat === 0;
        osc.frequency.value = isAccent ? 1500 : 900;
        gain.gain.setValueAtTime(volume * (isAccent ? 1.0 : 0.7), time);
        gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

        osc.start(time);
        osc.stop(time + 0.05);
    }

    function scheduler() {
        const ctx = getCtx();
        while (nextNoteTime < ctx.currentTime + scheduleAheadTime) {
            scheduleNote(beatCounter, nextNoteTime);

            const beatToShow = beatCounter;
            const delayMs = (nextNoteTime - ctx.currentTime) * 1000;
            setTimeout(() => {
                currentBeat = beatToShow;
            }, Math.max(0, delayMs));

            nextNoteTime += 60.0 / bpm;
            beatCounter = (beatCounter + 1) % beatsPerMeasure;
        }
    }

    function start() {
        if (isPlaying) return;
        const ctx = getCtx();
        if (ctx.state === 'suspended') ctx.resume();
        isPlaying = true;
        beatCounter = 0;
        currentBeat = -1;
        nextNoteTime = ctx.currentTime + 0.05;
        timerId = setInterval(scheduler, lookahead);
    }

    function stop() {
        isPlaying = false;
        if (timerId) {
            clearInterval(timerId);
            timerId = null;
        }
        currentBeat = -1;
    }

    function toggle() {
        isPlaying ? stop() : start();
    }

    function adjustBpm(delta: number) {
        bpm = Math.max(30, Math.min(300, bpm + delta));
    }

    onDestroy(() => {
        stop();
        audioCtx?.close();
    });

    function handleKey(e: KeyboardEvent) {
        if (e.key === ' ') {
            e.preventDefault();
            toggle();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            adjustBpm(1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            adjustBpm(-1);
        }
    }
</script>

<svelte:head>
    <title>메트로놈 (BPM 30~300) — 무료 온라인 메트로놈 | 뮤지아</title>
    <meta
        name="description"
        content="브라우저에서 바로 쓰는 무료 메트로놈. BPM 30~300, 박자 (2/4, 3/4, 4/4, 6/8 등), 강세 비주얼, 키보드 단축키 (스페이스). 정밀도 ±1ms."
    />
    <meta property="og:title" content="뮤지아 메트로놈" />
</svelte:head>

<svelte:window onkeydown={handleKey} />

<div class="page">
    <nav class="crumb"><a href="/tools">← 도구 모음</a></nav>

    <header class="head">
        <h1>메트로놈</h1>
        <p>BPM 30~300, 박자 / 강세 / 시각 비주얼. 스페이스바로 시작·정지.</p>
    </header>

    <div class="metronome">
        <div class="bpm-display" class:playing={isPlaying}>
            <div class="bpm-value">{bpm}</div>
            <div class="bpm-label">BPM</div>
        </div>

        <div class="beats">
            {#each Array(beatsPerMeasure) as _, i}
                <div class="beat" class:active={i === currentBeat} class:accent={i === 0 && accent}></div>
            {/each}
        </div>

        <div class="controls">
            <button class="btn-bpm" onclick={() => adjustBpm(-10)}>-10</button>
            <button class="btn-bpm" onclick={() => adjustBpm(-1)}>-1</button>
            <button class="btn-play" onclick={toggle} class:playing={isPlaying}>
                {isPlaying ? '■ 정지' : '▶ 시작'}
            </button>
            <button class="btn-bpm" onclick={() => adjustBpm(1)}>+1</button>
            <button class="btn-bpm" onclick={() => adjustBpm(10)}>+10</button>
        </div>

        <div class="slider">
            <input type="range" min="30" max="300" bind:value={bpm} />
        </div>

        <div class="settings">
            <label>
                박자
                <select bind:value={beatsPerMeasure}>
                    <option value={2}>2/4</option>
                    <option value={3}>3/4</option>
                    <option value={4}>4/4 (기본)</option>
                    <option value={5}>5/4</option>
                    <option value={6}>6/8</option>
                    <option value={7}>7/8</option>
                    <option value={8}>8/8</option>
                    <option value={9}>9/8</option>
                    <option value={10}>10/8</option>
                    <option value={11}>11/8</option>
                    <option value={12}>12/8</option>
                </select>
            </label>
            <label class="check">
                <input type="checkbox" bind:checked={accent} /> 첫 박 강세
            </label>
            <label>
                볼륨
                <input type="range" min="0" max="1" step="0.05" bind:value={volume} />
            </label>
        </div>
    </div>

    <section class="tempo-guide">
        <h2>템포 용어 가이드 (전체 25)</h2>
        <table>
            <tbody>
                <tr><td>Larghissimo</td><td>~24</td><td>가장 느리게</td></tr>
                <tr><td>Grave</td><td>25~45</td><td>장중하고 느리게</td></tr>
                <tr><td>Largo</td><td>40~60</td><td>매우 느리게</td></tr>
                <tr><td>Lento</td><td>52~68</td><td>느리게</td></tr>
                <tr><td>Larghetto</td><td>60~66</td><td>약간 느리게</td></tr>
                <tr><td>Adagio</td><td>66~76</td><td>편안하게 느리게</td></tr>
                <tr><td>Adagietto</td><td>72~76</td><td>다소 느리게</td></tr>
                <tr><td>Andante</td><td>76~108</td><td>걷는 속도</td></tr>
                <tr><td>Andantino</td><td>80~108</td><td>안단테보다 약간 빠르게</td></tr>
                <tr><td>Moderato</td><td>108~120</td><td>보통 빠르기</td></tr>
                <tr><td>Allegretto</td><td>112~120</td><td>약간 빠르게</td></tr>
                <tr><td>Allegro</td><td>120~168</td><td>빠르게</td></tr>
                <tr><td>Vivace</td><td>140~160</td><td>활발하게</td></tr>
                <tr><td>Vivacissimo</td><td>160~180</td><td>매우 활발하게</td></tr>
                <tr><td>Allegrissimo</td><td>168~190</td><td>매우 빠르게</td></tr>
                <tr><td>Presto</td><td>168~200</td><td>아주 빠르게</td></tr>
                <tr><td>Prestissimo</td><td>200+</td><td>가장 빠르게</td></tr>
                <tr><td colspan="3" style="background:#f5f3ff;color:#4f46e5;font-weight:700;">— 한국어 표현 (참고) —</td></tr>
                <tr><td>매우 느리게</td><td>40~60</td><td>Largo / 장송곡 / 깊은 발라드</td></tr>
                <tr><td>느리게</td><td>60~80</td><td>Adagio / 발라드 / 전통 가요</td></tr>
                <tr><td>보통</td><td>80~110</td><td>Andante / Moderato / 대중가요</td></tr>
                <tr><td>약간 빠르게</td><td>110~130</td><td>Allegretto / 댄스 팝</td></tr>
                <tr><td>빠르게</td><td>130~160</td><td>Allegro / EDM / 댄스</td></tr>
                <tr><td>매우 빠르게</td><td>160~200</td><td>Presto / 드럼앤베이스</td></tr>
                <tr><td>극도로 빠르게</td><td>200+</td><td>Prestissimo / 그라인드코어</td></tr>
            </tbody>
        </table>
    </section>

    <section class="tempo-guide">
        <h2>장르별 권장 BPM</h2>
        <table>
            <tbody>
                <tr><td>발라드 (한국)</td><td>60~80</td><td>김광석 / 발라드 / R&B</td></tr>
                <tr><td>트로트</td><td>100~130</td><td>4분의 4 단조 진행</td></tr>
                <tr><td>K-Pop 댄스</td><td>120~130</td><td>BTS / 트와이스 / NCT</td></tr>
                <tr><td>힙합</td><td>85~105</td><td>붐뱁 / 트랩 (140 half-time)</td></tr>
                <tr><td>EDM (하우스)</td><td>120~128</td><td>4 on the floor</td></tr>
                <tr><td>EDM (트랜스)</td><td>132~140</td><td>오프닝 / 빌드업</td></tr>
                <tr><td>EDM (드럼앤베이스)</td><td>160~180</td><td>고속 비트</td></tr>
                <tr><td>록</td><td>100~140</td><td>록 / 펑크 / 메탈</td></tr>
                <tr><td>재즈 / 보사노바</td><td>72~120</td><td>스윙 / 보사 / 라틴</td></tr>
                <tr><td>CCM 찬양</td><td>70~100</td><td>예배 발라드</td></tr>
                <tr><td>국악 정악</td><td>40~70</td><td>영산회상 / 가곡</td></tr>
                <tr><td>국악 민요</td><td>80~120</td><td>아리랑 / 진도아리랑</td></tr>
            </tbody>
        </table>
    </section>
</div>

<style>
    .page {
        max-width: 720px;
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
        margin: 0 0 28px;
        font-size: 14px;
    }
    .metronome {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        padding: 32px;
    }
    .bpm-display {
        text-align: center;
        margin-bottom: 24px;
    }
    .bpm-value {
        font-size: 80px;
        font-weight: 800;
        color: #1f2937;
        line-height: 1;
        font-variant-numeric: tabular-nums;
    }
    .bpm-display.playing .bpm-value {
        color: #6366f1;
    }
    .bpm-label {
        font-size: 14px;
        color: #6b7280;
        letter-spacing: 4px;
        margin-top: 4px;
    }
    .beats {
        display: flex;
        gap: 8px;
        justify-content: center;
        margin-bottom: 24px;
    }
    .beat {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #e5e7eb;
        transition: all 0.08s;
    }
    .beat.accent {
        border: 2px solid #c7d2fe;
    }
    .beat.active {
        background: #6366f1;
        transform: scale(1.15);
    }
    .beat.active.accent {
        background: #ec4899;
    }
    .controls {
        display: flex;
        gap: 8px;
        justify-content: center;
        margin-bottom: 16px;
        flex-wrap: wrap;
    }
    .btn-bpm,
    .btn-play {
        padding: 12px 18px;
        border: 1px solid #e5e7eb;
        background: #f9fafb;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
    }
    .btn-play {
        padding: 12px 28px;
        background: #6366f1;
        color: #fff;
        border-color: #6366f1;
        font-size: 16px;
    }
    .btn-play.playing {
        background: #ef4444;
        border-color: #ef4444;
    }
    .btn-bpm:hover {
        background: #f3f4f6;
    }
    .slider {
        margin-bottom: 24px;
    }
    .slider input[type='range'] {
        width: 100%;
    }
    .settings {
        display: flex;
        gap: 24px;
        flex-wrap: wrap;
        font-size: 14px;
        color: #4b5563;
    }
    .settings label {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .settings select {
        padding: 6px 10px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-family: inherit;
    }
    .tempo-guide {
        margin-top: 36px;
    }
    .tempo-guide h2 {
        font-size: 18px;
        margin: 0 0 12px;
    }
    .tempo-guide table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
    }
    .tempo-guide td {
        padding: 8px 12px;
        border-bottom: 1px solid #f3f4f6;
    }
    .tempo-guide td:first-child {
        font-weight: 600;
        color: #4f46e5;
        width: 100px;
    }
    .tempo-guide td:nth-child(2) {
        color: #6b7280;
        width: 80px;
        font-variant-numeric: tabular-nums;
    }
</style>
