<script lang="ts">
    import { onDestroy } from 'svelte';

    const NOTE_NAMES = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];

    let listening = $state(false);
    let pitch = $state<number | null>(null);
    let note = $state<string>('-');
    let octave = $state<number | null>(null);
    let cents = $state<number>(0);
    let permError = $state<string | null>(null);

    let audioCtx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;
    let buf: Float32Array | null = null;

    let calibration = $state<432 | 440 | 442>(440);

    function freqToNote(freq: number): { name: string; oct: number; cents: number } {
        const A4 = calibration;
        const semis = 12 * Math.log2(freq / A4);
        const rounded = Math.round(semis);
        const noteIdx = ((rounded + 9) % 12 + 12) % 12;
        const oct = Math.floor((rounded + 9) / 12) + 4;
        const cents = (semis - rounded) * 100;
        return { name: NOTE_NAMES[noteIdx], oct, cents };
    }

    function autoCorrelate(buffer: Float32Array, sampleRate: number): number {
        const SIZE = buffer.length;
        let rms = 0;
        for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i];
        rms = Math.sqrt(rms / SIZE);
        if (rms < 0.01) return -1;

        let r1 = 0;
        let r2 = SIZE - 1;
        const thres = 0.2;
        for (let i = 0; i < SIZE / 2; i++) {
            if (Math.abs(buffer[i]) < thres) {
                r1 = i;
                break;
            }
        }
        for (let i = 1; i < SIZE / 2; i++) {
            if (Math.abs(buffer[SIZE - i]) < thres) {
                r2 = SIZE - i;
                break;
            }
        }

        const buf2 = buffer.slice(r1, r2);
        const n = buf2.length;
        const c = new Array(n).fill(0);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n - i; j++) {
                c[i] += buf2[j] * buf2[j + i];
            }
        }
        let d = 0;
        while (c[d] > c[d + 1]) d++;
        let maxv = -1;
        let maxp = -1;
        for (let i = d; i < n; i++) {
            if (c[i] > maxv) {
                maxv = c[i];
                maxp = i;
            }
        }
        let T0 = maxp;
        if (T0 < 1) return -1;
        const x1 = c[T0 - 1];
        const x2 = c[T0];
        const x3 = c[T0 + 1] ?? 0;
        const a = (x1 + x3 - 2 * x2) / 2;
        const b = (x3 - x1) / 2;
        if (a) T0 = T0 - b / (2 * a);
        return sampleRate / T0;
    }

    function update() {
        if (!analyser || !buf) return;
        analyser.getFloatTimeDomainData(buf as unknown as Float32Array<ArrayBuffer>);
        const ac = autoCorrelate(buf, audioCtx!.sampleRate);
        if (ac > 0 && ac < 2000) {
            pitch = Math.round(ac * 10) / 10;
            const n = freqToNote(ac);
            note = n.name;
            octave = n.oct;
            cents = Math.round(n.cents);
        }
        rafId = requestAnimationFrame(update);
    }

    async function start() {
        permError = null;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
            audioCtx = new Ctx();
            const src = audioCtx.createMediaStreamSource(stream);
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 2048;
            buf = new Float32Array(analyser.fftSize);
            src.connect(analyser);
            listening = true;
            update();
        } catch (e: any) {
            permError = '마이크 권한이 필요합니다. 브라우저 주소창의 마이크 아이콘에서 허용해주세요.';
            console.error(e);
        }
    }

    function stop() {
        listening = false;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        stream?.getTracks().forEach((t) => t.stop());
        audioCtx?.close();
        audioCtx = null;
        analyser = null;
        stream = null;
        buf = null;
        pitch = null;
        note = '-';
        octave = null;
        cents = 0;
    }

    onDestroy(stop);
</script>

<svelte:head>
    <title>크로매틱 튜너 — 마이크 입력 무료 튜너 | 뮤지아</title>
    <meta
        name="description"
        content="브라우저 마이크 입력으로 음정 자동 분석. 기타 / 바이올린 / 우쿨렐레 / 보컬 / 관악기 튜닝 — ±2 cents 정밀도. 설치 / 가입 불필요."
    />
</svelte:head>

<div class="page">
    <nav class="crumb"><a href="/tools">← 도구 모음</a></nav>

    <header class="head">
        <h1>크로매틱 튜너</h1>
        <p>마이크에 소리를 들려주면 자동으로 음정 분석. 기타 · 바이올린 · 우쿨렐레 · 보컬 모두 지원.</p>
    </header>

    <div class="tuner">
        {#if !listening}
            <div class="start-zone">
                <div class="big-note">🎤</div>
                <p>마이크 권한이 필요합니다.</p>
                <button class="primary" onclick={start}>튜닝 시작</button>
                {#if permError}
                    <div class="err">{permError}</div>
                {/if}
            </div>
        {:else}
            <div class="calibration">
                <span class="cal-label">A4 보정:</span>
                <button class="cal-btn" class:on={calibration === 432} onclick={() => calibration = 432}>432 Hz</button>
                <button class="cal-btn" class:on={calibration === 440} onclick={() => calibration = 440}>440 Hz</button>
                <button class="cal-btn" class:on={calibration === 442} onclick={() => calibration = 442}>442 Hz</button>
            </div>
            <div class="display">
                <div class="note-big">{note}{#if octave !== null}<sub>{octave}</sub>{/if}</div>
                <div class="freq">{pitch ?? '-'} Hz</div>
                <div class="cents-bar">
                    <div class="needle" style="transform: translateX({Math.max(-50, Math.min(50, cents))}px)"></div>
                    <div class="zero"></div>
                    <div class="cents-label">
                        {cents > 0 ? '+' : ''}{cents} cents
                        {#if Math.abs(cents) < 5 && pitch}
                            <span class="ok">✓ 정확</span>
                        {:else if cents > 0 && pitch}
                            <span class="high">↓ 살짝 높음</span>
                        {:else if cents < 0 && pitch}
                            <span class="low">↑ 살짝 낮음</span>
                        {/if}
                    </div>
                </div>
            </div>
            <button class="secondary" onclick={stop}>정지</button>
        {/if}
    </div>

    <section class="info">
        <h2>표준 튜닝 참조</h2>
        <table>
            <thead>
                <tr><th>악기</th><th>현 / 음정</th></tr>
            </thead>
            <tbody>
                <tr><td>기타 (6현)</td><td>E2 - A2 - D3 - G3 - B3 - E4</td></tr>
                <tr><td>기타 (7현)</td><td>B1 - E2 - A2 - D3 - G3 - B3 - E4</td></tr>
                <tr><td>기타 (12현)</td><td>표준 6현 + 옥타브 페어 (저음 4현)</td></tr>
                <tr><td>베이스 (4현)</td><td>E1 - A1 - D2 - G2</td></tr>
                <tr><td>베이스 (5현)</td><td>B0 - E1 - A1 - D2 - G2</td></tr>
                <tr><td>바이올린</td><td>G3 - D4 - A4 - E5</td></tr>
                <tr><td>비올라</td><td>C3 - G3 - D4 - A4</td></tr>
                <tr><td>첼로</td><td>C2 - G2 - D3 - A3</td></tr>
                <tr><td>콘트라베이스</td><td>E1 - A1 - D2 - G2</td></tr>
                <tr><td>우쿨렐레 (소프라노)</td><td>G4 - C4 - E4 - A4 (재진입)</td></tr>
                <tr><td>밴조 (5현)</td><td>G4 - D3 - G3 - B3 - D4</td></tr>
                <tr><td>만돌린</td><td>G3 - D4 - A4 - E5 (페어)</td></tr>
                <tr><td>피아노 A4 (라)</td><td>440 Hz (현대 표준)</td></tr>
            </tbody>
        </table>

        <h3>대체 튜닝 (Alt Tunings) — 기타</h3>
        <table>
            <thead>
                <tr><th>이름</th><th>튜닝</th><th>특징 / 사용</th></tr>
            </thead>
            <tbody>
                <tr><td>Drop D</td><td>D2 - A2 - D3 - G3 - B3 - E4</td><td>저음 1 음 ↓ — 메탈 / 록</td></tr>
                <tr><td>DADGAD</td><td>D2 - A2 - D3 - G3 - A3 - D4</td><td>켈틱 / 핑거스타일</td></tr>
                <tr><td>Open D</td><td>D2 - A2 - D3 - F♯3 - A3 - D4</td><td>슬라이드 기타 / 블루스</td></tr>
                <tr><td>Open G</td><td>D2 - G2 - D3 - G3 - B3 - D4</td><td>키스 리처즈 / 슬라이드</td></tr>
                <tr><td>Drop C</td><td>C2 - G2 - C3 - F3 - A3 - D4</td><td>모던 메탈 / 헤비</td></tr>
                <tr><td>Half-step Down</td><td>E♭2 - A♭2 - D♭3 - G♭3 - B♭3 - E♭4</td><td>지미 헨드릭스 / 거니스</td></tr>
            </tbody>
        </table>

        <h3>A4 보정 표준</h3>
        <ul style="margin:0;padding-left:18px;color:#4b5563;font-size:13px;line-height:1.8;">
            <li><strong>440 Hz</strong> — 1939년 ISO 16 표준. 현대 음악의 디폴트.</li>
            <li><strong>442 Hz</strong> — 일부 오케스트라 (특히 유럽 / 일본). 약간 밝은 음색.</li>
            <li><strong>432 Hz</strong> — 베르디 / 뉴에이지 음악. "자연 주파수" 신봉자들이 선호.</li>
            <li><strong>415 Hz</strong> — 바로크 음악 (역사적 연주, 본 페이지 미지원)</li>
        </ul>

        <h3>평균율 vs 순정율</h3>
        <ul style="margin:0;padding-left:18px;color:#4b5563;font-size:13px;line-height:1.8;">
            <li><strong>평균율 (Equal Temperament)</strong> — 1 옥타브를 12 등분. 모든 조성에서 균일. <em>이 튜너의 기본.</em></li>
            <li><strong>순정율 (Just Intonation)</strong> — 단순 정수비 기반 (3:2 = 완전5도, 5:4 = 장3도). 한 조성에서 가장 깨끗하지만 다른 조성은 어긋남.</li>
            <li>현대 키보드 / 기타 = 평균율. 합창 / 현악 4중주는 순정율 ↔ 평균율 사이 미세 조정.</li>
        </ul>

        <p class="note">정밀도: ±2 cents. 마이크 입력 품질에 따라 달라질 수 있습니다.</p>
    </section>
</div>

<style>
    .page {
        max-width: 560px;
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
        margin: 0 0 24px;
        font-size: 14px;
    }
    .tuner {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        padding: 36px 28px;
        text-align: center;
    }
    .start-zone .big-note {
        font-size: 64px;
        margin-bottom: 8px;
    }
    .start-zone p {
        color: #6b7280;
        margin: 0 0 18px;
    }
    .primary {
        padding: 14px 30px;
        background: #6366f1;
        color: #fff;
        border: none;
        border-radius: 10px;
        font-size: 16px;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
    }
    .secondary {
        margin-top: 24px;
        padding: 8px 18px;
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        font-size: 13px;
        cursor: pointer;
        font-family: inherit;
    }
    .err {
        margin-top: 14px;
        font-size: 13px;
        color: #dc2626;
    }
    .calibration {
        display: flex;
        gap: 6px;
        align-items: center;
        margin-bottom: 18px;
        font-size: 12px;
        color: #6b7280;
    }
    .cal-label { font-weight: 700; }
    .cal-btn {
        padding: 4px 10px;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 999px;
        font-size: 11px;
        cursor: pointer;
        font-family: inherit;
    }
    .cal-btn.on { background: #6366f1; color: #fff; border-color: #6366f1; }
    .info h3 {
        font-size: 14px;
        margin: 16px 0 10px;
        color: #1f2937;
    }
    .display .note-big {
        font-size: 96px;
        font-weight: 800;
        color: #6366f1;
        line-height: 1;
    }
    .display .note-big sub {
        font-size: 36px;
        font-weight: 600;
        color: #9ca3af;
    }
    .freq {
        font-size: 18px;
        color: #6b7280;
        margin: 8px 0 24px;
        font-variant-numeric: tabular-nums;
    }
    .cents-bar {
        position: relative;
        height: 60px;
        background: linear-gradient(
            to right,
            #fef2f2 0%,
            #fef2f2 30%,
            #fffbeb 30%,
            #fffbeb 45%,
            #ecfdf5 45%,
            #ecfdf5 55%,
            #fffbeb 55%,
            #fffbeb 70%,
            #fef2f2 70%
        );
        border-radius: 8px;
        overflow: hidden;
    }
    .zero {
        position: absolute;
        top: 0;
        left: 50%;
        width: 1px;
        height: 100%;
        background: #16a34a;
    }
    .needle {
        position: absolute;
        top: 0;
        left: 50%;
        margin-left: -2px;
        width: 4px;
        height: 100%;
        background: #1f2937;
        transition: transform 0.06s;
    }
    .cents-label {
        position: absolute;
        bottom: 4px;
        left: 0;
        right: 0;
        text-align: center;
        font-size: 13px;
        color: #4b5563;
        font-variant-numeric: tabular-nums;
    }
    .ok {
        margin-left: 8px;
        color: #16a34a;
        font-weight: 700;
    }
    .high {
        margin-left: 8px;
        color: #d97706;
    }
    .low {
        margin-left: 8px;
        color: #d97706;
    }
    .info {
        margin-top: 36px;
        padding: 20px;
        background: #f9fafb;
        border-radius: 10px;
    }
    .info h2 {
        font-size: 16px;
        margin: 0 0 12px;
    }
    .info table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
    }
    .info th,
    .info td {
        padding: 6px 10px;
        text-align: left;
        border-bottom: 1px solid #f3f4f6;
    }
    .info th {
        font-weight: 600;
        color: #6b7280;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    .info .note {
        margin: 14px 0 0;
        font-size: 12px;
        color: #9ca3af;
    }
</style>
