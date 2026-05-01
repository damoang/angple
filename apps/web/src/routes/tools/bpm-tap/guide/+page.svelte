<script lang="ts">
    import { getLang } from '$lib/i18n/store.svelte';
    const lang = $derived(getLang());
</script>

<svelte:head>
    <title>BPM 측정 가이드 — 곡의 템포 정확히 알아내는 법 | 뮤지아</title>
    <meta name="description" content="BPM (Beats Per Minute) 의 의미, 탭 측정 방법, 25 장르별 BPM 가이드, half-time / double-time 개념, K-Pop / 발라드 / EDM / 트로트 / 국악 의 표준 BPM 범위." />
    <link rel="canonical" href="https://muzia.net/tools/bpm-tap/guide" />
</svelte:head>

<article class="guide">
    <nav class="crumb"><a href="/tools">← 도구 모음</a> / <a href="/tools/bpm-tap">BPM 탭</a> / <span>가이드</span></nav>
    <header>
        <h1>BPM 측정 활용 가이드</h1>
        <p class="lead">곡을 들으며 박자에 맞춰 탭 → BPM 자동 계산. DJ / 사보 / 편곡 / 댄스 안무 작업에 필수.</p>
        <p class="cta-row"><a href="/tools/bpm-tap" class="cta-btn">▶ BPM 탭 카운터 열기</a></p>
    </header>

    <section>
        <h2>1. BPM 이란?</h2>
        <p>
            BPM = Beats Per Minute. 1 분 동안 몇 박이 있는지를 나타냅니다. 4/4 박자의 4분음표가 1 분에 120 번 = 120 BPM. 메트로놈 / DJ / 사보 / 편곡 모든 영역에서 곡의 속도를 표현하는 표준 단위입니다.
        </p>
    </section>

    <section>
        <h2>2. 탭 측정 정확도 높이기</h2>
        <ul>
            <li><strong>4 번 이상 탭</strong> — 정답률 ≥ 70%. 8 번 이상이면 90%+.</li>
            <li><strong>박자 명확한 부분</strong> — 곡 시작이 어렵다면 후렴 또는 드럼 비트가 명확한 곳.</li>
            <li><strong>스페이스바 사용</strong> — 마우스 클릭보다 정확. 키보드 단축키 활성화 시.</li>
            <li><strong>다운비트 (Down beat)</strong> — 4/4 의 1 박만 탭하는 것이 아니라 모든 박. 또는 일관되게 1 박만.</li>
        </ul>
    </section>

    <section>
        <h2>3. Half-time vs Double-time — 같은 곡, 다른 BPM</h2>
        <p>
            한 곡의 BPM 은 <strong>어떤 음표를 1 박</strong> 으로 셀지에 따라 달라집니다.
        </p>
        <ul>
            <li><strong>140 BPM 트랩</strong> = <strong>70 BPM half-time</strong> 으로도 셀 수 있음. 둘 다 정답.</li>
            <li><strong>60 BPM 발라드</strong> = <strong>120 BPM double-time</strong>. 단 일반적으로 60 표기.</li>
            <li>같은 곡에서 두 BPM 이 모두 측정될 수 있음. 곡이 어떤 그루브를 의도하는지에 따라 선택.</li>
        </ul>
    </section>

    <section>
        <h2>4. 한국 음악 장르별 BPM</h2>
        <table>
            <thead><tr><th>장르</th><th>BPM</th><th>대표곡</th></tr></thead>
            <tbody>
                <tr><td>발라드 (한국)</td><td>60~80</td><td>김광석 / 이문세 / 발라드 강자들</td></tr>
                <tr><td>R&B 슬로우</td><td>70~90</td><td>박효신 / 휘성</td></tr>
                <tr><td>트로트</td><td>100~130</td><td>임영웅 / 송가인 / 진성</td></tr>
                <tr><td>K-Pop 미드</td><td>110~120</td><td>BTS 발라드 / Bigbang 발라드</td></tr>
                <tr><td>K-Pop 댄스</td><td>120~130</td><td>NewJeans / Twice / NCT</td></tr>
                <tr><td>EDM 하우스</td><td>120~128</td><td>4 on the floor</td></tr>
                <tr><td>EDM 트랜스</td><td>132~140</td><td>Avicii / Tiesto</td></tr>
                <tr><td>드럼앤베이스</td><td>160~180</td><td>Pendulum / Sub Focus</td></tr>
                <tr><td>CCM</td><td>70~100</td><td>한국 찬양 / Hillsong</td></tr>
                <tr><td>국악 진양조</td><td>30~45</td><td>가장 느린 판소리 장단</td></tr>
                <tr><td>국악 자진모리</td><td>110~130</td><td>빠른 판소리 / 사물놀이</td></tr>
                <tr><td>국악 휘모리</td><td>160+</td><td>가장 빠른 판소리</td></tr>
            </tbody>
        </table>
    </section>

    <section>
        <h2>5. 활용 예시</h2>
        <ul>
            <li><strong>DJ 믹싱</strong> — 두 곡의 BPM 을 맞춰 비트 매치. 보통 ±2 BPM 범위가 자연스러움.</li>
            <li><strong>댄스 안무</strong> — 곡 BPM 을 알아야 안무 카운트 (8박 단위) 정확히 짤 수 있음.</li>
            <li><strong>사보 작업</strong> — 시벨리우스/도리코에 곡 BPM 을 입력하기 전에 정확한 값 측정.</li>
            <li><strong>편곡</strong> — 새 편곡이 원곡 BPM 과 잘 맞는지 검증.</li>
            <li><strong>운동 / 러닝</strong> — 자기 페이스 (걸음 수) BPM 을 알면 적절한 곡 매칭 가능.</li>
        </ul>
    </section>

    <section>
        <h2>관련 도구</h2>
        <div class="related">
            <a href="/tools/metronome" class="related-card">🎵 메트로놈 — 측정한 BPM 으로 연습</a>
            <a href="/tools/midi-sequencer" class="related-card">🎚️ MIDI 시퀀서 — BPM 기반 작·편곡</a>
            <a href="/tools/score-editor" class="related-card">📜 MusicXML 사보 — 곡에 BPM 입력</a>
        </div>
    </section>
</article>

<style>
    .guide { max-width: 760px; margin: 0 auto; padding: 28px 16px 64px; line-height: 1.75; }
    .crumb { font-size: 13px; color: #9ca3af; margin-bottom: 16px; }
    .crumb a { color: #6366f1; text-decoration: none; }
    .crumb span { color: #6b7280; }
    h1 { font-size: 32px; font-weight: 800; margin: 12px 0 10px; }
    h2 { font-size: 20px; font-weight: 800; margin: 32px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #eef2ff; }
    .lead { color: #4b5563; font-size: 16px; line-height: 1.7; }
    .cta-row { margin: 16px 0 0; }
    .cta-btn { display: inline-block; padding: 10px 20px; background: #6366f1; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; }
    section p { color: #374151; font-size: 15px; margin: 10px 0; }
    section ul, section ol { color: #374151; font-size: 15px; padding-left: 22px; }
    section li { margin: 6px 0; }
    section strong { color: #4f46e5; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 14px; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 700; }
    .related { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin-top: 12px; }
    .related-card { display: block; padding: 14px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; text-decoration: none; color: #4b5563; font-size: 14px; }
    .related-card:hover { background: #eef2ff; border-color: #6366f1; color: #4f46e5; }
</style>
