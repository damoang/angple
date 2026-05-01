<script lang="ts">
    import { getLang } from '$lib/i18n/store.svelte';
    const lang = $derived(getLang());
</script>

<svelte:head>
    <title>장르별 코드 진행 해설 — K-Pop / CCM / 재즈 / 블루스 | 뮤지아</title>
    <meta name="description" content="작곡가를 위한 장르별 코드 진행 가이드. 팝의 황금 진행 (I-V-vi-IV), K-Pop 4 코드, CCM 찬양 진행, 재즈 ii-V-I, 12-bar blues, EDM 진행, 트로트 3 코드, 록의 ♭VII 진행. 30+ 진행 모두 설명." />
    <link rel="canonical" href="https://muzia.net/tools/chord-progression/guide" />
</svelte:head>

<article class="guide">
    <nav class="crumb"><a href="/tools">← 도구 모음</a> / <a href="/tools/chord-progression">코드 진행</a> / <span>가이드</span></nav>
    <header>
        <h1>장르별 코드 진행 해설 — 작곡가를 위한 종합 가이드</h1>
        <p class="lead">
            팝의 황금 진행부터 K-Pop 4 코드 / CCM 찬양 / 재즈 ii-V-I / 블루스 / EDM / 트로트 / 록의 ♭VII 까지 — 32 진행을 장르별로 깊이 해설.
        </p>
        <p class="cta-row"><a href="/tools/chord-progression" class="cta-btn">▶ 코드 진행 도구 열기</a></p>
    </header>

    <section>
        <h2>1. 팝 음악 — I-V-vi-IV "황금 진행"</h2>
        <p>
            <strong>I-V-vi-IV</strong> 는 팝 음악의 80% 이상이 사용하는 가장 인기 있는 진행. C 메이저 = C-G-Am-F. 비틀즈 "Let It Be", U2 "With Or Without You", Train "Hey Soul Sister", 한국 발라드 / K-Pop 발라드 수십 곡이 이 진행.
        </p>
        <p>
            왜 효과적? <strong>밝은 메이저 (I)</strong> → <strong>긴장의 V</strong> → <strong>슬픈 마이너 (vi)</strong> → <strong>안정의 IV</strong> 의 감정적 변화가 자연스럽기 때문. 가사를 어떻게 붙여도 잘 어울림.
        </p>
        <p>변형: <strong>I-V-vi-iii-IV-I-IV-V</strong> (카논 진행, 8 마디) — 파헬벨 D 카논, 한국 발라드의 단골.</p>
    </section>

    <section>
        <h2>2. K-Pop — vi-IV-I-V "슬픈 시작"</h2>
        <p>
            K-Pop 발라드의 정석 진행. C 메이저에서 <strong>Am-F-C-G</strong>. 같은 4 코드인데 시작이 마이너 (vi) 이라 처음부터 슬픔이 깔림.
        </p>
        <ul>
            <li>아이유 "좋은 날" 후렴부 / NewJeans "Ditto" / 트와이스 "What is Love?" 등 수많은 곡</li>
            <li>마이너 시작 = 감정 이입 빠름. 후반의 메이저 (I) → 도미넌트 (V) 가 희망의 느낌</li>
        </ul>
        <p>변형: <strong>IV-V-iii-vi</strong> (한국 발라드 후렴 진행), <strong>vi-V-IV-V</strong> (감성 K-Pop).</p>
    </section>

    <section>
        <h2>3. CCM 찬양 — 플라갈 종지와 V/vi</h2>
        <ul>
            <li><strong>IV-I (플라갈, "아멘 종지")</strong> — 전통 찬송가의 끝. F-C 진행으로 평안한 종결.</li>
            <li><strong>I-IV-I-V</strong> — 전통 찬송가의 시작-도미넌트 패턴.</li>
            <li><strong>I-V-vi-IV</strong> — 현대 CCM (Hillsong / Bethel) 의 기본.</li>
            <li><strong>I-V/vi-vi-IV</strong> — V/vi = "vi 의 도미넌트" 이차 도미넌트. C 메이저에서 V/vi = E 메이저. 세련된 색채 변화. K-CCM 자주 사용.</li>
        </ul>
    </section>

    <section>
        <h2>4. 재즈 — ii-V-I "재즈의 핵심"</h2>
        <p>
            재즈 / 보사노바의 90% 가 ii-V-I 진행을 사용합니다. C 메이저: <strong>Dm7-G7-CM7</strong>.
        </p>
        <ul>
            <li><strong>왜 ii-V-I?</strong> ii (서브도미넌트 마이너) → V (도미넌트, 강한 해결력) → I (안정). 최단 거리 재즈 종지.</li>
            <li><strong>마이너 키 ii-V-i</strong> — Am 키: Bm7♭5 (반감) - E7 (♭9 추가) - Am7. 어두운 재즈 발라드.</li>
            <li><strong>I-vi-ii-V (Turnaround)</strong> — 8 마디 끝의 회기 패턴. Rhythm Changes (조지 거슈윈) A 섹션 = 이 진행 8 마디 반복.</li>
            <li><strong>iii-vi-ii-V</strong> — 4도 하행 시퀀스. 재즈의 "circle of fifths" 진행.</li>
        </ul>
    </section>

    <section>
        <h2>5. 블루스 — 12 마디 진행</h2>
        <p>
            블루스의 정석 형식. C 키 기준:
        </p>
        <pre>마디 1-4   : I7  - I7  - I7  - I7
마디 5-6   : IV7 - IV7
마디 7-8   : I7  - I7
마디 9     : V7
마디 10    : IV7
마디 11    : I7
마디 12    : V7  (turnaround)</pre>
        <p>
            모든 코드가 도미넌트 7 (I7, IV7, V7) — 이게 블루스의 색채. <strong>Quick Change</strong> 는 2 마디에 IV7 미리 등장하는 변형.
        </p>
        <p>록 / R&B / 펑크 / 재즈의 뿌리. 모든 즉흥 연주의 시작점.</p>
    </section>

    <section>
        <h2>6. EDM — 4 코드 루프</h2>
        <ul>
            <li><strong>i-VI-III-VII</strong> (마이너) — Am-F-C-G. EDM 댄스의 표준. Avicii / Martin Garrix.</li>
            <li><strong>vi-IV-I-V</strong> — Electro Pop / Future Bass.</li>
            <li><strong>i-VII-VI-VII</strong> — 단순 4 코드 루프. 트랜스 / Big Room 의 토대.</li>
        </ul>
        <p>
            EDM 의 특징은 <strong>Drop</strong> 직전 빌드업. 같은 4 코드를 반복하며 텐션을 쌓고, Drop 에서 베이스 + 신스가 폭발.
        </p>
    </section>

    <section>
        <h2>7. 록 — ♭VII 의 마법</h2>
        <p>
            <strong>I-♭VII-IV</strong> = 클래식 록 / 하드록의 정석. C 메이저: C-B♭-F. ♭VII = 믹솔리디안 모드의 색채.
        </p>
        <ul>
            <li>Lynyrd Skynyrd "Sweet Home Alabama"</li>
            <li>The Who "Won't Get Fooled Again"</li>
            <li>The Beatles "Hey Jude" 후반 페이드아웃</li>
        </ul>
        <p><strong>안달루시안 진행</strong> (i-VII-VI-V) — 플라멩코 / 어두운 록. Am-G-F-E. Hit the Road Jack / Stray Cat Strut.</p>
    </section>

    <section>
        <h2>8. 트로트 — 3 코드의 미학</h2>
        <p>
            트로트는 대부분 <strong>I-IV-V</strong> 3 코드. C 메이저 = C-F-G. 단순하지만 강력한 토닉 (T) - 서브도미넌트 (S) - 도미넌트 (D) 진행.
        </p>
        <ul>
            <li><strong>I-V-I-IV-V-I</strong> — 트로트 후렴 패턴. 강한 종결감.</li>
            <li><strong>마이너 키 트로트</strong> — i-iv-V (Am-Dm-E). E 는 도미넌트로 메이저 7.</li>
        </ul>
    </section>

    <section>
        <h2>9. 50년대 진행 — Doowop</h2>
        <p>
            <strong>I-vi-IV-V</strong> = 50~60년대 팝의 표준. C 메이저 = C-Am-F-G.
        </p>
        <ul>
            <li>Ben E. King "Stand By Me"</li>
            <li>The Penguins "Earth Angel"</li>
            <li>Bing Crosby "True Love"</li>
        </ul>
        <p>오늘날은 <strong>레트로</strong> 한 느낌으로 사용. K-Pop 의 일부 발라드가 이 진행 차용.</p>
    </section>

    <section>
        <h2>10. 활용 워크플로 — 곡 시작점</h2>
        <ol>
            <li>장르 결정 (팝 / K-Pop / CCM / 재즈)</li>
            <li>장르별 진행 1~2 개 선택 (이 도구의 장르 칩 활용)</li>
            <li>키 결정 (보컬 음역에 맞춰 — Tools 의 코드 진행에서 12 키 모두 트랜스포즈 가능)</li>
            <li>진행 음원으로 들어보며 멜로디 작곡</li>
            <li>변주 — 같은 진행 반복이 지루하면 ii-V-I turnaround 또는 V/vi 이차 도미넌트 추가</li>
        </ol>
    </section>

    <section>
        <h2>관련 도구</h2>
        <div class="related">
            <a href="/tools/scale-dictionary" class="related-card">📖 스케일 사전 — 진행 위 멜로디 만들기</a>
            <a href="/tools/chord-dictionary" class="related-card">📚 코드 사전 — 360 코드 보이싱</a>
            <a href="/tools/piano-roll" class="related-card">🎹 피아노 롤 — 진행 + 멜로디 작곡</a>
            <a href="/tools/music-theory" class="related-card">📚 음악 이론 퀴즈 — 진행 카테고리</a>
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
    pre { background: #1f2937; color: #d1d5db; padding: 14px; border-radius: 8px; overflow-x: auto; font-size: 13px; line-height: 1.6; }
    .related { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin-top: 12px; }
    .related-card { display: block; padding: 14px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; text-decoration: none; color: #4b5563; font-size: 14px; }
    .related-card:hover { background: #eef2ff; border-color: #6366f1; color: #4f46e5; }
</style>
