<script lang="ts">
    import { getLang } from '$lib/i18n/store.svelte';
    const lang = $derived(getLang());
</script>

<svelte:head>
    {#if lang === 'en'}
        <title>Metronome Practice Guide — How to Use Metronome Effectively | Muzia</title>
        <meta name="description" content="Complete metronome practice guide for musicians. Tempo terms (Largo to Prestissimo), genre BPM ranges (K-Pop, ballad, EDM), Sibelius/Finale/Dorico user practice cycle, polyrhythm, swing feel." />
    {:else}
        <title>메트로놈 활용 가이드 — 효과적인 연습법 + 시벨리우스/도리코 사용자용 | 뮤지아</title>
        <meta name="description" content="음악인을 위한 종합 메트로놈 활용 가이드. 템포 용어 (Largo~Prestissimo), 장르별 BPM (K-Pop / 발라드 / EDM / 트로트), 시벨리우스/피날레/도리코 사용자 연습 사이클, 폴리리듬, 스윙 표현법까지." />
    {/if}
    <link rel="canonical" href="https://muzia.net/tools/metronome/guide" />
</svelte:head>

<article class="guide">
    <nav class="crumb">
        <a href="/tools">← {lang === 'en' ? 'Tools' : '도구 모음'}</a> /
        <a href="/tools/metronome">{lang === 'en' ? 'Metronome' : '메트로놈'}</a> /
        <span>{lang === 'en' ? 'Guide' : '활용 가이드'}</span>
    </nav>

    <header>
        <h1>{lang === 'en' ? 'Metronome Practice Guide' : '메트로놈 활용 가이드'}</h1>
        <p class="lead">
            {lang === 'en'
                ? 'How to use a metronome effectively — from beginner practice to advanced polyrhythm. Optimized for Sibelius / Finale / Dorico users and Korean music genres.'
                : '메트로놈을 효과적으로 사용하는 법 — 입문자의 첫 연습부터 폴리리듬까지. 시벨리우스 / 피날레 / 도리코 사용자 + 한국 음악 장르 (K-Pop / 발라드 / 트로트 / CCM) 에 최적화.'}
        </p>
        <p class="cta-row">
            <a href="/tools/metronome" class="cta-btn">{lang === 'en' ? '▶ Open Metronome' : '▶ 메트로놈 열기'}</a>
        </p>
    </header>

    <section>
        <h2>1. 메트로놈은 왜 중요한가?</h2>
        <p>
            메트로놈은 19세기 초 요한 멜첼이 발명한 이래 모든 음악 연습의 기본 도구입니다. <strong>일정한 박</strong> 을 들려주어 연주자의 박자 감각을 단단하게 만들고, 빠르거나 느린 부분에서 흐트러지는 템포를 잡아줍니다.
        </p>
        <p>
            전문 연주자도 매일 메트로놈으로 연습하는 이유는 <strong>"내가 빠르거나 느린 줄 모르는 것"</strong> 이 가장 큰 약점이기 때문입니다. 메트로놈 없이 연습하면 어려운 부분에서 자기도 모르게 느려지고, 쉬운 부분에서 빨라집니다.
        </p>
    </section>

    <section>
        <h2>2. 템포 용어 — Largo 부터 Prestissimo 까지</h2>
        <p>이탈리아어 템포 용어 25 개. 악보에 적힌 용어만 보고도 BPM 을 가늠할 수 있어야 합니다.</p>
        <table>
            <thead><tr><th>용어</th><th>BPM 범위</th><th>한국어 의미</th></tr></thead>
            <tbody>
                <tr><td><strong>Larghissimo</strong></td><td>~24</td><td>가장 느리게 (장송곡)</td></tr>
                <tr><td><strong>Grave</strong></td><td>25~45</td><td>장중하고 느리게</td></tr>
                <tr><td><strong>Largo</strong></td><td>40~60</td><td>매우 느리게</td></tr>
                <tr><td><strong>Lento</strong></td><td>52~68</td><td>느리게</td></tr>
                <tr><td><strong>Adagio</strong></td><td>66~76</td><td>편안하게 느리게</td></tr>
                <tr><td><strong>Andante</strong></td><td>76~108</td><td>걷는 속도 — "안단테"의 어원</td></tr>
                <tr><td><strong>Moderato</strong></td><td>108~120</td><td>보통 빠르기</td></tr>
                <tr><td><strong>Allegro</strong></td><td>120~168</td><td>빠르게 — 클래식 1악장의 표준</td></tr>
                <tr><td><strong>Vivace</strong></td><td>140~160</td><td>활발하게</td></tr>
                <tr><td><strong>Presto</strong></td><td>168~200</td><td>아주 빠르게</td></tr>
                <tr><td><strong>Prestissimo</strong></td><td>200+</td><td>가장 빠르게 — Vivaldi 사계 여름 3악장</td></tr>
            </tbody>
        </table>
        <p>이 외에 Allegretto / Andantino / Adagietto 등 변형 12 개를 메트로놈 페이지에서 확인할 수 있습니다.</p>
    </section>

    <section>
        <h2>3. 장르별 BPM — 한국 음악 컨텍스트</h2>
        <p>같은 BPM 도 장르에 따라 다른 느낌입니다. 한국 음악의 대표 BPM 범위:</p>
        <ul>
            <li><strong>발라드 (한국)</strong> 60~80 — 김광석 / 90년대 발라드 / 대부분의 R&B</li>
            <li><strong>트로트</strong> 100~130 — 4분의 4 단조 진행, 강박이 명확</li>
            <li><strong>K-Pop 댄스</strong> 120~130 — BTS / 트와이스 / NCT / NewJeans 의 대표 BPM</li>
            <li><strong>CCM 찬양</strong> 70~100 — 예배 발라드 (느린 곡 60 BPM 도 흔함)</li>
            <li><strong>국악 정악</strong> 40~70 — 영산회상 / 가곡 (가장 느린 음악)</li>
            <li><strong>국악 민요</strong> 80~120 — 아리랑 / 진도아리랑 (자진모리 = 빠른 박)</li>
            <li><strong>판소리</strong> — 진양조 (40 BPM) / 중모리 (80) / 자진모리 (120) / 휘모리 (160) 식으로 단계적 빠르기</li>
        </ul>
    </section>

    <section>
        <h2>4. 효과적인 연습 사이클 — 시벨리우스/도리코 사용자용</h2>
        <p>
            악보 입력 (시벨리우스/피날레/도리코) 사용자가 자기 곡을 연습할 때:
        </p>
        <ol>
            <li><strong>50% 템포로 시작</strong> — 곡의 정상 BPM 의 절반에서 시작. 음을 정확히 익힘.</li>
            <li><strong>5 BPM 씩 올리기</strong> — 한 번에 큰 점프 X. 5~10 BPM 단위로 올려 근육 기억이 따라가도록.</li>
            <li><strong>실수가 나오면 다시 -10 BPM</strong> — 빨라서 실수가 나면 즉시 10 BPM 낮추고 다시 정확하게.</li>
            <li><strong>정상 템포 ×1.1 까지 도달</strong> — 정상의 110% 까지 안정적으로 갈 수 있으면, 정상 템포는 안전.</li>
            <li><strong>마지막 합주는 메트로놈 없이</strong> — 표현 (rubato) 을 위해서는 메트로놈을 끄고 마무리.</li>
        </ol>
    </section>

    <section>
        <h2>5. 박자 (Meter) 별 강세 패턴</h2>
        <ul>
            <li><strong>2/4</strong> — 강·약 — 행진곡 / 폴카</li>
            <li><strong>3/4</strong> — 강·약·약 — 왈츠 / 마주르카</li>
            <li><strong>4/4</strong> — 강·약·중강·약 — 가장 흔한 박자 (팝/록/EDM 의 99%)</li>
            <li><strong>6/8</strong> — 큰 2박 (1·4 강) — 자장가 / 6/8 발라드 / 한국 민요 자진모리</li>
            <li><strong>5/4</strong> — 3+2 또는 2+3 — 비현대적 느낌 (Dave Brubeck "Take Five")</li>
            <li><strong>7/8</strong> — 보통 2+2+3 또는 3+2+2 — 발칸 / 프로그레시브 록</li>
            <li><strong>9/8</strong> — 한국 민요 표준 (아리랑) — 큰 3박</li>
            <li><strong>12/8</strong> — 큰 4박 (셋잇단 느낌) — 블루스 / 펑크</li>
        </ul>
    </section>

    <section>
        <h2>6. 폴리리듬 (Polyrhythm) — 고급 연습</h2>
        <p>
            두 다른 박을 동시에 연주하는 기법. 가장 흔한 것이 <strong>3:2 (3 against 2)</strong>.
        </p>
        <ul>
            <li><strong>3:2</strong> — 한 손은 3 박, 다른 손은 2 박. 같은 시간 안에. 라틴 음악 / 클래식에 자주.</li>
            <li><strong>4:3</strong> — 한 손 4, 다른 손 3. 쇼팽 야상곡에 자주.</li>
            <li><strong>5:4</strong> — 매우 어려움. 현대 음악 / 인도 음악.</li>
        </ul>
        <p>메트로놈으로 한 박만 들려주고, 다른 박은 머리로 카운트하는 것이 시작점입니다.</p>
    </section>

    <section>
        <h2>7. 스윙 (Swing) — 재즈의 핵심</h2>
        <p>
            재즈의 8분음표는 <strong>2:1 비율</strong> (long-short) 로 연주됩니다. 즉 한 박을 셋잇단으로 나누어 [장-단] 으로 표현. 메트로놈을 4분 단위로 켜고, 그 사이를 스윙 비율로 연주하는 것이 표준 연습.
        </p>
    </section>

    <section>
        <h2>8. 메트로놈 사용 시 흔한 실수</h2>
        <ul>
            <li><strong>너무 빠른 BPM 으로 시작</strong> — 정상 템포부터 시작하면 실수 → 좌절. 50% 부터.</li>
            <li><strong>강세를 너무 강하게</strong> — 첫 박만 강하게 하면 다른 박이 약해짐. 균일하게.</li>
            <li><strong>메트로놈에 의존</strong> — 메트로놈 없이도 박을 유지할 수 있어야. 가끔은 끄고 연습.</li>
            <li><strong>한 BPM 만 연습</strong> — 같은 곡을 여러 BPM 으로 연습하면 표현력이 늘어남.</li>
        </ul>
    </section>

    <section>
        <h2>관련 도구</h2>
        <div class="related">
            <a href="/tools/bpm-tap" class="related-card">⏱️ BPM 탭 카운터 — 곡의 BPM 자동 측정</a>
            <a href="/tools/tuner" class="related-card">🎸 튜너 — 정확한 음정으로 연습</a>
            <a href="/tools/music-theory" class="related-card">📚 음악 이론 퀴즈 — 리듬 카테고리 10 문항</a>
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
    .lead { color: #4b5563; font-size: 16px; line-height: 1.7; margin-bottom: 18px; }
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
