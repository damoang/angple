<script lang="ts">
    import { getLang } from '$lib/i18n/store.svelte';
    const lang = $derived(getLang());
</script>

<svelte:head>
    {#if lang === 'en'}
        <title>Tuner Guide — Guitar / Violin / Ukulele Tuning + 432/440/442 Hz | Muzia</title>
        <meta name="description" content="Complete tuner guide for stringed instruments. Standard tuning (guitar/bass/violin/cello/ukulele), alt tunings (DADGAD, Open G, Drop D), A4 calibration (432/440/442 Hz), equal temperament vs just intonation." />
    {:else}
        <title>튜너 활용 가이드 — 기타 / 바이올린 / 우쿨렐레 + 432/440/442Hz 보정 | 뮤지아</title>
        <meta name="description" content="현악기 튜닝 종합 가이드. 표준 튜닝 (기타/베이스/바이올린/첼로/우쿨렐레), 알트 튜닝 (DADGAD / Open G / Drop D), A4 보정 (432/440/442Hz), 평균율 vs 순정율." />
    {/if}
    <link rel="canonical" href="https://muzia.net/tools/tuner/guide" />
</svelte:head>

<article class="guide">
    <nav class="crumb">
        <a href="/tools">← {lang === 'en' ? 'Tools' : '도구 모음'}</a> /
        <a href="/tools/tuner">{lang === 'en' ? 'Tuner' : '튜너'}</a> /
        <span>{lang === 'en' ? 'Guide' : '활용 가이드'}</span>
    </nav>

    <header>
        <h1>튜너 활용 가이드</h1>
        <p class="lead">
            기타, 베이스, 바이올린, 우쿨렐레, 보컬까지 — 무료 브라우저 크로매틱 튜너 활용법.
            표준 튜닝 / 알트 튜닝 / A4 보정 / 평균율 vs 순정율 모두 다룹니다.
        </p>
        <p class="cta-row">
            <a href="/tools/tuner" class="cta-btn">▶ 튜너 열기</a>
        </p>
    </header>

    <section>
        <h2>1. 튜너 기초 — 마이크 권한과 환경</h2>
        <p>
            브라우저 튜너는 <strong>마이크 입력</strong> 을 받아 음정 (피치) 을 분석합니다. 처음 사용 시 브라우저가
            "muzia.net 에서 마이크에 접근하려고 합니다" 안내를 띄우는데, "허용" 을 누르면 됩니다.
        </p>
        <ul>
            <li><strong>조용한 방</strong> — 백색 잡음 / 에어컨 소리 / 옆 사람 말소리는 분석을 흐트러뜨림.</li>
            <li><strong>마이크 거리</strong> — 악기에서 30~50cm. 너무 가깝거나 멀면 부정확.</li>
            <li><strong>한 음씩</strong> — 코드를 치면 음 여러 개가 섞여 분석 어려움. 한 줄 (현) 씩 띄우기.</li>
            <li><strong>볼륨 적절</strong> — 너무 작으면 인식 X, 너무 크면 클리핑.</li>
        </ul>
    </section>

    <section>
        <h2>2. 표준 튜닝 — 모든 악기</h2>
        <table>
            <thead><tr><th>악기</th><th>튜닝 (저음 → 고음)</th></tr></thead>
            <tbody>
                <tr><td>기타 (6현)</td><td>E2 - A2 - D3 - G3 - B3 - E4</td></tr>
                <tr><td>기타 (7현)</td><td>B1 - E2 - A2 - D3 - G3 - B3 - E4</td></tr>
                <tr><td>베이스 (4현)</td><td>E1 - A1 - D2 - G2</td></tr>
                <tr><td>베이스 (5현)</td><td>B0 - E1 - A1 - D2 - G2</td></tr>
                <tr><td>바이올린</td><td>G3 - D4 - A4 - E5</td></tr>
                <tr><td>비올라</td><td>C3 - G3 - D4 - A4</td></tr>
                <tr><td>첼로</td><td>C2 - G2 - D3 - A3</td></tr>
                <tr><td>콘트라베이스</td><td>E1 - A1 - D2 - G2</td></tr>
                <tr><td>우쿨렐레 (소프라노)</td><td>G4 - C4 - E4 - A4 (재진입)</td></tr>
                <tr><td>밴조 (5현)</td><td>G4 - D3 - G3 - B3 - D4</td></tr>
                <tr><td>만돌린</td><td>G3 - D4 - A4 - E5 (페어 현)</td></tr>
            </tbody>
        </table>
        <p><strong>우쿨렐레의 G4</strong> 는 "재진입 튜닝" — 4현인데 G4 가 가장 높은 음 (고음 G). 일반적인 베이스→트레블 순서가 아닌 점이 특징.</p>
    </section>

    <section>
        <h2>3. 기타 알트 튜닝 — 6 종류</h2>
        <ul>
            <li><strong>Drop D</strong> (D2-A2-D3-G3-B3-E4) — 6번 줄만 D 로 한 음 ↓. 메탈 / 록 / 어쿠스틱 강세.</li>
            <li><strong>DADGAD</strong> (D2-A2-D3-G3-A3-D4) — 켈틱 / 핑거스타일 (Tommy Emmanuel, Pierre Bensusan).</li>
            <li><strong>Open D</strong> (D2-A2-D3-F♯3-A3-D4) — 모든 현이 D 메이저 코드. 슬라이드 기타 / 블루스.</li>
            <li><strong>Open G</strong> (D2-G2-D3-G3-B3-D4) — Keith Richards (Rolling Stones) 의 시그니처. 슬라이드.</li>
            <li><strong>Drop C</strong> (C2-G2-C3-F3-A3-D4) — 모던 메탈 / 헤비. Drop D 에서 모든 현이 한 음 ↓.</li>
            <li><strong>Half-step Down</strong> (E♭-A♭-D♭-G♭-B♭-E♭) — 지미 헨드릭스 / 거니스 N 로지스. 보컬 키 조정용.</li>
        </ul>
    </section>

    <section>
        <h2>4. A4 보정 — 440 vs 442 vs 432 Hz</h2>
        <ul>
            <li><strong>440 Hz</strong> — 1939 년 ISO 16 표준. 현대 음악의 디폴트. 피아노 / 키보드 / 디지털 악기.</li>
            <li><strong>442 Hz</strong> — 일부 오케스트라 (특히 유럽 / 일본). 약간 밝은 음색. 악기들이 함께 연주할 때 미세 조정.</li>
            <li><strong>432 Hz</strong> — 베르디 / 뉴에이지 / "자연 주파수" 신봉자. 학술적 근거는 약하지만 일부 음악인은 더 편안한 느낌이라 함.</li>
            <li><strong>415 Hz</strong> — 바로크 음악 (역사적 연주). 본 페이지 미지원.</li>
        </ul>
        <p>
            <strong>중요</strong>: 기타와 피아노가 함께 연주할 때, 피아노가 440 Hz 면 기타도 440 Hz. 디지털 키보드는 보통 음정 조절 메뉴에 보정 가능.
        </p>
    </section>

    <section>
        <h2>5. 평균율 (Equal Temperament) vs 순정율 (Just Intonation)</h2>
        <p>
            <strong>평균율</strong> = 한 옥타브 (12 반음) 을 균등하게 12 등분. 모든 조성에서 같은 음정 비율. 현대 키보드 / 기타의 기본. 약간 부정확한 협화음 (장3도가 14 cents 정도 더 높음) 이지만 모든 키에서 일관됨.
        </p>
        <p>
            <strong>순정율</strong> = 단순 정수비 (3:2 = 완전5도, 5:4 = 장3도). 한 조성 (예: C 메이저) 에서 모든 화음이 깨끗하게 들리지만, 다른 조성으로 옮기면 어긋남.
        </p>
        <p>
            합창 / 현악 4중주 같은 가변 음정 악기는 순정율 ↔ 평균율 사이를 자연스럽게 미세 조정합니다. 본 튜너는 평균율 기준입니다.
        </p>
    </section>

    <section>
        <h2>6. 효과적인 튜닝 순서 — 기타 6현 기준</h2>
        <ol>
            <li><strong>6번 (E2)</strong> — 가장 두꺼운 줄. 기준점. 다른 줄을 비교할 때 사용.</li>
            <li><strong>5번 (A2)</strong> — 6번의 5번 프렛 = A2. 또는 튜너로 직접.</li>
            <li><strong>4번 (D3)</strong> — 5번의 5번 프렛 = D3.</li>
            <li><strong>3번 (G3)</strong> — 4번의 5번 프렛 = G3.</li>
            <li><strong>2번 (B3)</strong> — 3번의 <strong>4번 프렛</strong> = B3 (예외!).</li>
            <li><strong>1번 (E4)</strong> — 2번의 5번 프렛 = E4.</li>
        </ol>
        <p>이것이 "5번 프렛 튜닝" 방법. 튜너가 있으면 직접 각 줄을 표시된 음으로 맞추면 됩니다.</p>
    </section>

    <section>
        <h2>7. 흔한 튜닝 문제</h2>
        <ul>
            <li><strong>음이 빠르게 어긋남</strong> — 새 줄은 늘어남 → 30 분 정도 친 후 다시 튜닝. 줄을 살짝 잡아당겨 미리 늘리기 (stretching) 도움.</li>
            <li><strong>옥타브가 다른 표시</strong> — E2 가 아니라 E3 / E4 가 표시되면 줄이 너무 팽팽하거나 마이크 잡음. 음을 조금 풀어보기.</li>
            <li><strong>cents 가 흔들림</strong> — 손가락으로 줄을 누르는 압력 / 픽 위치에 따라 음정 변화. 가만히 띄우고 5 초 정도 지속음.</li>
            <li><strong>주변 노이즈</strong> — 백그라운드 음악 / TV 끄고 진행.</li>
        </ul>
    </section>

    <section>
        <h2>관련 도구</h2>
        <div class="related">
            <a href="/tools/metronome" class="related-card">🎵 메트로놈 — 정확한 박자로 연습</a>
            <a href="/tools/scale-dictionary" class="related-card">📖 스케일 사전 — 튜닝 후 스케일 연습</a>
            <a href="/tools/chord-dictionary" class="related-card">📚 코드 사전 — 360 코드 보이싱</a>
        </div>
    </section>
</article>

<style>
    .guide { max-width: 760px; margin: 0 auto; padding: 28px 16px 64px; line-height: 1.75; }
    .crumb { font-size: 13px; color: #9ca3af; margin-bottom: 16px; }
    .crumb a { color: #6366f1; text-decoration: none; }
    .crumb span { color: #6b7280; }
    h1 { font-size: 32px; font-weight: 800; margin: 12px 0 10px; letter-spacing: -0.5px; }
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
    .related-card { display: block; padding: 14px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; text-decoration: none; color: #4b5563; font-size: 14px; transition: all 0.12s; }
    .related-card:hover { background: #eef2ff; border-color: #6366f1; color: #4f46e5; }
</style>
