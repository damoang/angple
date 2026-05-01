<script lang="ts">
    let taps = $state<number[]>([]);
    let bpm = $state<number | null>(null);
    let confidence = $state<'low' | 'medium' | 'high'>('low');
    let lastTap = $state<number | null>(null);

    function tap() {
        const now = performance.now();
        if (lastTap && now - lastTap > 3000) {
            taps = [];
        }
        lastTap = now;
        taps = [...taps, now].slice(-16);

        if (taps.length < 2) {
            bpm = null;
            return;
        }

        const intervals: number[] = [];
        for (let i = 1; i < taps.length; i++) {
            intervals.push(taps[i] - taps[i - 1]);
        }
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        bpm = Math.round(60000 / avg);

        if (intervals.length < 4) {
            confidence = 'low';
        } else {
            const variance = intervals.reduce((s, x) => s + (x - avg) ** 2, 0) / intervals.length;
            const std = Math.sqrt(variance);
            const cv = std / avg;
            confidence = cv < 0.05 ? 'high' : cv < 0.12 ? 'medium' : 'low';
        }
    }

    function reset() {
        taps = [];
        bpm = null;
        confidence = 'low';
        lastTap = null;
    }

    function handleKey(e: KeyboardEvent) {
        if (e.key === ' ') {
            e.preventDefault();
            tap();
        } else if (e.key === 'Escape' || e.key === 'r' || e.key === 'R') {
            reset();
        }
    }
</script>

<svelte:head>
    <title>BPM 탭 카운터 — 음원 BPM 측정 | 뮤지아</title>
    <meta
        name="description"
        content="곡을 들으며 박자에 맞춰 탭하면 BPM 자동 계산. 4박 이상 탭하면 신뢰도 표시. DJ / 사보 / 편곡 / 댄스 작업 시 BPM 측정에 활용."
    />
</svelte:head>

<svelte:window onkeydown={handleKey} />

<div class="page">
    <nav class="crumb"><a href="/tools">← 도구 모음</a></nav>

    <header class="head">
        <h1>BPM 탭 카운터</h1>
        <p>곡을 들으며 박자에 맞춰 탭하세요. 스페이스바 또는 화면 클릭. 4번 이상 탭하면 정확.</p>
    </header>

    <div class="display">
        <div class="bpm-num" class:has={bpm !== null}>
            {bpm ?? '-'}
        </div>
        <div class="bpm-label">BPM</div>
        {#if bpm !== null}
            <div class="confidence conf-{confidence}">
                {confidence === 'high' ? '높음' : confidence === 'medium' ? '보통' : '낮음'} 신뢰도
                · {taps.length}회 탭
            </div>
        {/if}
    </div>

    <button class="tap-btn" onclick={tap}>TAP</button>

    <div class="actions">
        <button class="reset" onclick={reset}>초기화 (R)</button>
    </div>

    <section class="info">
        <h2>장르별 BPM 가이드 (25 장르)</h2>
        <ul>
            <li><strong>40~60</strong> — 장송곡 / 국악 정악 (영산회상)</li>
            <li><strong>60~70</strong> — 슬로우 발라드 / 한국 발라드</li>
            <li><strong>70~80</strong> — R&amp;B 슬로우 / Soul</li>
            <li><strong>80~90</strong> — 힙합 (붐뱁) / 미드템포 발라드</li>
            <li><strong>90~100</strong> — 레게 / 다운템포 EDM / 한국 발라드 (빠른 편)</li>
            <li><strong>100~110</strong> — 팝 미드템포 / 트로트 (느린 편) / Old School Hip-hop</li>
            <li><strong>110~120</strong> — 펑크 / 80년대 팝 / 디스코 / 트로트</li>
            <li><strong>120~130</strong> — <strong>K-Pop 댄스</strong> / 하우스 / 일렉트로 / 4 on the floor</li>
            <li><strong>128 BPM</strong> — EDM 표준 (Avicii / Calvin Harris)</li>
            <li><strong>130~140</strong> — 트랜스 / Big Room / 빅비트</li>
            <li><strong>140~150</strong> — 트랩 (half-time = 70 BPM 느낌)</li>
            <li><strong>150~160</strong> — 덥스텝 / 메탈 (mid)</li>
            <li><strong>160~180</strong> — 드럼앤베이스 / Jungle / 스피드코어</li>
            <li><strong>180~200</strong> — Hardcore / Speedcore</li>
            <li><strong>200+</strong> — 그라인드코어 / Extreme Metal</li>
        </ul>
        <h3 style="font-size:14px;margin-top:18px;">📚 참고</h3>
        <ul>
            <li>같은 곡도 <strong>half-time</strong> (반의 BPM) 또는 <strong>double-time</strong> 으로 셀 수 있음 — 예: 140 BPM 트랩 = 70 느낌</li>
            <li>한국 가요는 <strong>78~92 BPM</strong> 발라드, <strong>120~128 BPM</strong> 댄스가 압도적</li>
            <li>국악 진양조 = 약 <strong>30~45 BPM</strong> (가장 느린 장단), 자진모리 = <strong>120 BPM 내외</strong></li>
        </ul>
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
    .display {
        text-align: center;
        padding: 32px 0 24px;
    }
    .bpm-num {
        font-size: 100px;
        font-weight: 800;
        color: #d1d5db;
        line-height: 1;
        font-variant-numeric: tabular-nums;
    }
    .bpm-num.has {
        color: #6366f1;
    }
    .bpm-label {
        font-size: 14px;
        letter-spacing: 4px;
        color: #6b7280;
        margin-top: 4px;
    }
    .confidence {
        margin-top: 12px;
        font-size: 13px;
    }
    .conf-high {
        color: #16a34a;
    }
    .conf-medium {
        color: #d97706;
    }
    .conf-low {
        color: #6b7280;
    }
    .tap-btn {
        display: block;
        width: 100%;
        padding: 64px 0;
        background: #6366f1;
        color: #fff;
        border: none;
        border-radius: 14px;
        font-size: 28px;
        font-weight: 800;
        letter-spacing: 4px;
        cursor: pointer;
        font-family: inherit;
        transition: transform 0.05s;
    }
    .tap-btn:active {
        transform: scale(0.98);
        background: #4f46e5;
    }
    .actions {
        text-align: center;
        margin-top: 16px;
    }
    .reset {
        padding: 8px 18px;
        background: #f3f4f6;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        font-size: 13px;
        cursor: pointer;
        font-family: inherit;
    }
    .info {
        margin-top: 40px;
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
