<script lang="ts">
    import { getLang } from '$lib/i18n/store.svelte';
    const lang = $derived(getLang());
</script>

<svelte:head>
    <title>ABC 표기법 입문서 — 텍스트로 악보 만들기 (한국어 최초급) | 뮤지아</title>
    <meta name="description" content="ABC 표기법 한국어 입문서. 헤더 (X/T/M/L/Q/K), 음표 표기 (대소문자 옥타브), 임시표 (^/_), 음표 길이, 반복 기호, 코드 표기. 한국 민요 / 클래식 / 찬송가 51 예시." />
    <link rel="canonical" href="https://muzia.net/tools/abc-notation/guide" />
</svelte:head>

<article class="guide">
    <nav class="crumb"><a href="/tools">← 도구 모음</a> / <a href="/tools/abc-notation">ABC 표기법</a> / <span>가이드</span></nav>
    <header>
        <h1>ABC 표기법 입문서 — 텍스트로 악보 만들기</h1>
        <p class="lead">
            ABC 표기법은 텍스트만으로 악보를 표현하는 표준. 1991 년 Chris Walshaw 가 만들었고, 이메일 / 게시판 / 블로그 어디서나 악보를 공유할 수 있습니다.
        </p>
        <p class="cta-row"><a href="/tools/abc-notation" class="cta-btn">▶ ABC 도구 열기</a></p>
    </header>

    <section>
        <h2>1. ABC 헤더 (Header) — 곡의 메타데이터</h2>
        <pre>X:1
T:애국가
M:4/4
L:1/4
Q:1/4=80
K:G</pre>
        <ul>
            <li><strong>X:</strong> 곡 번호 (X:1 - 첫 번째 곡)</li>
            <li><strong>T:</strong> 제목 (Title)</li>
            <li><strong>M:</strong> 박자 (Meter — 4/4, 3/4, 6/8 등)</li>
            <li><strong>L:</strong> 기본 음표 길이 (Length — 1/4 = 4분음표가 기본)</li>
            <li><strong>Q:</strong> 템포 (Quarter note = 80 BPM)</li>
            <li><strong>K:</strong> 조성 (Key — G 메이저, Am 마이너 등)</li>
        </ul>
    </section>

    <section>
        <h2>2. 음표 표기 — 대소문자가 옥타브</h2>
        <ul>
            <li><strong>C D E F G A B</strong> = 4 옥타브 (C4 = 가운데 도)</li>
            <li><strong>c d e f g a b</strong> = 5 옥타브 (한 옥타브 위)</li>
            <li><strong>C, D, E,</strong> = 3 옥타브 (한 옥타브 아래, 콤마 사용)</li>
            <li><strong>c' d' e'</strong> = 6 옥타브 (한 옥타브 위, 어퍼스트로피)</li>
        </ul>
        <p>예: <code>CDEFGABc</code> = C 메이저 1 옥타브 상행.</p>
    </section>

    <section>
        <h2>3. 임시표 — ♯ / ♭ / 자연음</h2>
        <ul>
            <li><strong>^F</strong> = F♯ (캐럿 = 샵)</li>
            <li><strong>_B</strong> = B♭ (언더스코어 = 플랫)</li>
            <li><strong>=F</strong> = F 자연음 (등호 = 자연음)</li>
            <li><strong>^^F</strong> = F♯♯ (더블 샵)</li>
            <li><strong>__B</strong> = B♭♭ (더블 플랫)</li>
        </ul>
    </section>

    <section>
        <h2>4. 음표 길이 — 숫자로 곱셈/나눗셈</h2>
        <ul>
            <li><strong>C</strong> = 기본 길이 (L: 에 정의 — 보통 1/4)</li>
            <li><strong>C2</strong> = 기본 × 2 (반음표)</li>
            <li><strong>C/2</strong> 또는 <strong>C/</strong> = 기본 ÷ 2 (8분음표)</li>
            <li><strong>C/4</strong> = 기본 ÷ 4 (16분음표)</li>
            <li><strong>C3</strong> = 기본 × 3 (점음표 효과)</li>
        </ul>
    </section>

    <section>
        <h2>5. 마디 / 반복</h2>
        <ul>
            <li><strong>|</strong> = 마디줄</li>
            <li><strong>|]</strong> = 종지선</li>
            <li><strong>|:</strong> ~ <strong>:|</strong> = 반복 구간</li>
            <li><strong>|1 ~ |2</strong> = 1번 끝 / 2번 끝 (1차/2차 종결)</li>
        </ul>
        <p>예: <code>|: CDEF | GABc :|</code> = 두 번 반복.</p>
    </section>

    <section>
        <h2>6. 코드 표기 — 따옴표 안에</h2>
        <pre>"C" CEGc | "F" FAcf | "G7" GBdf | "C" c4</pre>
        <p>각 음표 위에 코드 심볼이 붙음. 통기타 / 우쿨렐레 코드 차트 만들 때 유용.</p>
    </section>

    <section>
        <h2>7. 한국 민요 ABC 예시 — 아리랑 (본조)</h2>
        <pre>X:1
T:Arirang
M:9/8
L:1/8
Q:3/8=80
K:Bb
|: F3 D2 F G2 A | B3 c2 d c2 B |
A3 G2 F D2 F | G3 F2 D C2 D :|</pre>
        <p>
            아리랑은 9/8 박자 (큰 3박). M:9/8 + L:1/8 (8분 단위) + Q:3/8=80 (점4분 = 80 BPM).
        </p>
    </section>

    <section>
        <h2>8. 다른 표기법과 비교</h2>
        <table>
            <thead><tr><th>표기법</th><th>장점</th><th>단점</th></tr></thead>
            <tbody>
                <tr><td><strong>ABC</strong></td><td>텍스트로 어디서나, 빠른 입력</td><td>복잡한 표현 어려움</td></tr>
                <tr><td><strong>MusicXML</strong></td><td>표현력 풍부, 표준 교환</td><td>사람이 읽기 어려움</td></tr>
                <tr><td><strong>LilyPond</strong></td><td>인쇄 품질 최고</td><td>학습 곡선 큼</td></tr>
                <tr><td><strong>MIDI</strong></td><td>음원 재생</td><td>표기 정보 손실</td></tr>
            </tbody>
        </table>
    </section>

    <section>
        <h2>9. 활용 — 어디에 쓸까?</h2>
        <ul>
            <li><strong>이메일/게시판 공유</strong> — 텍스트로 악보 보냄. <a href="/tools/abc-notation">ABC 도구</a>에 붙여넣으면 즉시 오선지로.</li>
            <li><strong>빠른 멜로디 메모</strong> — 머릿속 멜로디를 30 초 안에 텍스트로.</li>
            <li><strong>국악 / 민요 채보</strong> — 한국 민요 51 템플릿 중 15 개 한국 민요 제공.</li>
            <li><strong>찬송가 / CCM</strong> — 51 템플릿 중 10 찬송가 (Amazing Grace / 주 하나님 지으신 모든 세계 등).</li>
            <li><strong>학습</strong> — 이론으로 배운 진행을 직접 입력해 들어보기.</li>
        </ul>
    </section>

    <section>
        <h2>10. 다운로드 / 공유 워크플로</h2>
        <ol>
            <li>도구에서 ABC 입력 → 우측에 실시간 오선지 렌더</li>
            <li>재생으로 음원 미리듣기</li>
            <li>.abc 다운로드 (텍스트) → 다른 사람에게 메일/메신저로</li>
            <li>.svg 다운로드 (이미지) → 블로그 / 인스타 / 워드 문서</li>
        </ol>
    </section>

    <section>
        <h2>관련 도구</h2>
        <div class="related">
            <a href="/tools/score-editor" class="related-card">📜 MusicXML 사보 — 본격 사보 작업</a>
            <a href="/tools/scale-dictionary" class="related-card">📖 스케일 사전 — 멜로디 만들기</a>
            <a href="/tools/midi-sequencer" class="related-card">🎚️ MIDI 시퀀서 — DAW 워크플로</a>
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
    pre { background: #1f2937; color: #d1d5db; padding: 14px; border-radius: 8px; overflow-x: auto; font-size: 13px; line-height: 1.6; font-family: monospace; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
    th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 700; }
    .related { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin-top: 12px; }
    .related-card { display: block; padding: 14px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; text-decoration: none; color: #4b5563; font-size: 14px; }
    .related-card:hover { background: #eef2ff; border-color: #6366f1; color: #4f46e5; }
</style>
