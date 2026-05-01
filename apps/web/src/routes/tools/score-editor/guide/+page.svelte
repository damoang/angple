<script lang="ts">
    import { getLang } from '$lib/i18n/store.svelte';
    const lang = $derived(getLang());
</script>

<svelte:head>
    <title>시벨리우스 / 피날레 / 도리코 → MusicXML 워크플로 가이드 | 뮤지아</title>
    <meta name="description" content="시벨리우스 / 피날레 / 도리코 / MuseScore 사용자를 위한 MusicXML 내보내기 / 가져오기 가이드. 트랜스포즈, 조성 변경, 이조 악기 보면 만들기, 보컬 키 조정 워크플로." />
    <link rel="canonical" href="https://muzia.net/tools/score-editor/guide" />
</svelte:head>

<article class="guide">
    <nav class="crumb"><a href="/tools">← 도구 모음</a> / <a href="/tools/score-editor">MusicXML 사보</a> / <span>가이드</span></nav>
    <header>
        <h1>시벨리우스 / 도리코 → MusicXML 워크플로</h1>
        <p class="lead">
            한국 사보 사용자 (시벨리우스 / 피날레 / 도리코) 를 위한 MusicXML 내보내기 + 트랜스포즈 + 조성 변경 + 보컬 키 조정 워크플로.
        </p>
        <p class="cta-row"><a href="/tools/score-editor" class="cta-btn">▶ MusicXML 사보 에디터 열기</a></p>
    </header>

    <section>
        <h2>1. MusicXML 이란?</h2>
        <p>
            MusicXML 은 2004 년 만들어진 <strong>악보 교환의 표준 포맷</strong>. 시벨리우스, 피날레, 도리코, MuseScore, Notion 등 모든 사보 프로그램이 지원합니다. 이 포맷 하나로 어떤 사보 프로그램이든 데이터를 주고받을 수 있어서 사보의 세계 표준 역할을 합니다.
        </p>
        <ul>
            <li><strong>.musicxml</strong> — 텍스트 XML 파일 (사람이 읽을 수 있음)</li>
            <li><strong>.mxl</strong> — 압축된 MusicXML (zip 으로 작아짐, 인터넷 공유에 유리)</li>
        </ul>
    </section>

    <section>
        <h2>2. 시벨리우스에서 MusicXML 내보내기</h2>
        <ol>
            <li><strong>파일</strong> 메뉴 → <strong>내보내기 (Export)</strong> → <strong>MusicXML</strong></li>
            <li>"Compressed (.mxl)" 선택 권장 — 파일 크기 1/5 ~ 1/10</li>
            <li>저장 위치 지정</li>
            <li>이 파일을 <a href="/tools/score-editor">사보 에디터</a> 의 드롭존에 끌어다 놓기</li>
        </ol>
        <p>시벨리우스 7 이상은 모든 버전에서 MusicXML 내보내기 지원.</p>
    </section>

    <section>
        <h2>3. 피날레에서 MusicXML 내보내기</h2>
        <ol>
            <li><strong>File</strong> 메뉴 → <strong>MusicXML</strong> → <strong>Export</strong></li>
            <li>형식: <strong>Uncompressed (.xml)</strong> 또는 <strong>Compressed (.mxl)</strong></li>
            <li>버전 선택: <strong>3.1</strong> 또는 최신 (호환성 위해 3.0 도 OK)</li>
        </ol>
        <p>피날레 25 이상 권장. 이전 버전은 MusicXML 1.1 만 지원하여 일부 정보 손실.</p>
    </section>

    <section>
        <h2>4. 도리코에서 MusicXML 내보내기</h2>
        <ol>
            <li><strong>File</strong> → <strong>Export</strong> → <strong>MusicXML</strong></li>
            <li>옵션 → "Compressed" 선택</li>
            <li>저장</li>
        </ol>
        <p>도리코 4 이상은 표현 (다이나믹, 연주법) 도 잘 보존. 단 일부 사용자 정의 기호는 손실 가능.</p>
    </section>

    <section>
        <h2>5. 무료 대안 — MuseScore</h2>
        <ol>
            <li>파일 → 다른 이름으로 저장 → MusicXML 형식</li>
            <li>또는 파일 → 내보내기 → MusicXML</li>
        </ol>
        <p>무료 사보 프로그램. MuseScore 4 가 가장 빠르고 안정적.</p>
    </section>

    <section>
        <h2>6. 트랜스포즈 활용 — 이조 악기 보면 만들기</h2>
        <p>
            관악기들은 <strong>이조 (Transposing)</strong> 가 필요합니다. 즉 악보에 적힌 음과 실제 들리는 음이 다름.
        </p>
        <table>
            <thead><tr><th>악기</th><th>이조</th><th>예시</th></tr></thead>
            <tbody>
                <tr><td>B♭ 클라리넷</td><td>+2 반음</td><td>적힌 C → 들리는 B♭</td></tr>
                <tr><td>B♭ 트럼펫</td><td>+2 반음</td><td>적힌 C → 들리는 B♭</td></tr>
                <tr><td>F 호른</td><td>+7 반음</td><td>적힌 C → 들리는 F</td></tr>
                <tr><td>E♭ 알토 색소폰</td><td>+9 반음</td><td>적힌 C → 들리는 E♭</td></tr>
                <tr><td>B♭ 테너 색소폰</td><td>+14 반음</td><td>적힌 C → 들리는 B♭ (옥타브 + 단7)</td></tr>
                <tr><td>E♭ 바리톤 색소폰</td><td>+21 반음</td><td>옥타브 + 6도</td></tr>
            </tbody>
        </table>
        <p>
            워크플로: 콘서트 키 (실음 키) 의 곡을 시벨리우스로 만든다 → MusicXML 내보내기 → 사보 에디터에서 +2 반음 트랜스포즈 (B♭ 악기용) → 다운로드 → 클라리넷 보면 완성.
        </p>
    </section>

    <section>
        <h2>7. 보컬 키 조정</h2>
        <p>
            가수의 음역에 안 맞는 곡을 발견했을 때 워크플로:
        </p>
        <ol>
            <li>가수의 편한 옥타브 확인 (예: G3 ~ E5)</li>
            <li>곡의 최고음 / 최저음 확인 (시벨리우스/도리코의 음역대 표시 활용)</li>
            <li>차이만큼 트랜스포즈 (예: -3 반음)</li>
            <li>조성도 변경 (트랜스포즈 후 조표 갱신)</li>
            <li>다운로드 → 가수에게 전달</li>
        </ol>
        <p><strong>주의</strong>: 너무 큰 트랜스포즈 (±5 반음 이상) 는 반주 악기에 부담. 가능하면 ±2~3 반음 권장.</p>
    </section>

    <section>
        <h2>8. CCM / 찬송가 키 조정</h2>
        <p>
            한국 교회 음악에서는 <strong>찬양 인도자 키</strong> 와 <strong>회중 노래 키</strong> 가 다릅니다. CCM 곡을 만들 때:
        </p>
        <ul>
            <li>인도자 솔로: D / E♭ / E 메이저 (밝고 높은 키)</li>
            <li>회중 노래: G / A / B♭ (회중이 따라 부르기 편한 키)</li>
            <li>키보드 코드 차트는 회중 키, 솔로 라인은 솔로 키 → 두 보면 필요</li>
            <li>이 도구로 한 키에서 다른 키로 트랜스포즈 → MIDI 도 함께 갱신</li>
        </ul>
    </section>

    <section>
        <h2>9. MusicXML 의 핵심 요소 (개발자용)</h2>
        <table>
            <tbody>
                <tr><td><code>&lt;score-partwise&gt;</code></td><td>최상위 요소 (악기별로 정렬)</td></tr>
                <tr><td><code>&lt;part&gt;</code></td><td>각 악기의 보면</td></tr>
                <tr><td><code>&lt;measure&gt;</code></td><td>마디</td></tr>
                <tr><td><code>&lt;note&gt;</code></td><td>음표 (pitch / duration / type)</td></tr>
                <tr><td><code>&lt;pitch&gt;</code></td><td>step (C/D/E...) + octave + alter (♯=1, ♭=-1)</td></tr>
                <tr><td><code>&lt;duration&gt;</code></td><td>음표 길이 (divisions 단위)</td></tr>
                <tr><td><code>&lt;divisions&gt;</code></td><td>1박 = 몇 단위 (보통 4 또는 16)</td></tr>
                <tr><td><code>&lt;key&gt;&lt;fifths&gt;</code></td><td>조표 (양수=♯, 음수=♭)</td></tr>
                <tr><td><code>&lt;time&gt;</code></td><td>박자표 (beats / beat-type)</td></tr>
                <tr><td><code>&lt;sound tempo="120"&gt;</code></td><td>BPM (sound 요소 내부)</td></tr>
            </tbody>
        </table>
    </section>

    <section>
        <h2>10. 한국 사보 사용자 커뮤니티</h2>
        <p>
            뮤지아 (muzia.net) 는 2002 년부터 한국의 시벨리우스 / 피날레 / 도리코 사용자들이 모여 정보를 나누는 곳. <a href="/sibelius">시벨리우스 게시판</a>, <a href="/dorico">도리코 게시판</a>, <a href="/violin">바이올린 게시판</a> 등에서 더 많은 워크플로 / 팁을 공유합니다.
        </p>
    </section>

    <section>
        <h2>관련 도구</h2>
        <div class="related">
            <a href="/tools/abc-notation" class="related-card">🎼 ABC 표기법 — 텍스트로 사보</a>
            <a href="/tools/midi-sequencer" class="related-card">🎚️ MIDI 시퀀서 — 사보 → DAW</a>
            <a href="/tools/chord-progression" class="related-card">🎹 코드 진행 — 곡의 화성 분석</a>
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
    section a { color: #6366f1; }
    section code { background: #eef2ff; color: #4f46e5; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 700; }
    .related { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin-top: 12px; }
    .related-card { display: block; padding: 14px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; text-decoration: none; color: #4b5563; font-size: 14px; }
    .related-card:hover { background: #eef2ff; border-color: #6366f1; color: #4f46e5; }
</style>
