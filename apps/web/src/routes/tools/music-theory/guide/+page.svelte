<script lang="ts">
    import { getLang } from '$lib/i18n/store.svelte';
    const lang = $derived(getLang());
</script>

<svelte:head>
    <title>음악 이론 학습 로드맵 — 입문 / 중급 / 고급 단계별 가이드 | 뮤지아</title>
    <meta name="description" content="음악 이론 입문자부터 고급 학습자까지 단계별 가이드. 음정 → 코드 → 조성 → 진행 → 리듬 → 한국 음악 (평조/계면조/판소리). 105 문항 퀴즈 카테고리별 학습 순서." />
    <link rel="canonical" href="https://muzia.net/tools/music-theory/guide" />
</svelte:head>

<article class="guide">
    <nav class="crumb"><a href="/tools">← 도구 모음</a> / <a href="/tools/music-theory">음악 이론</a> / <span>가이드</span></nav>
    <header>
        <h1>음악 이론 학습 로드맵 — 입문 / 중급 / 고급</h1>
        <p class="lead">
            105 문항 음악 이론 퀴즈를 단계적으로 학습하는 가이드.
            음정 → 코드 → 조성 → 진행 → 리듬 → 한국 음악 순서로.
        </p>
        <p class="cta-row"><a href="/tools/music-theory" class="cta-btn">▶ 음악 이론 퀴즈 열기</a></p>
    </header>

    <section>
        <h2>입문 단계 (Stage 1) — 음정과 메이저 스케일</h2>
        <p><strong>학습 목표</strong>: 도-시 음 이름, 반음/온음, 메이저 스케일 구조</p>
        <ul>
            <li>음정 카테고리 20 문항 풀기 → 정답률 70% 이상 도달</li>
            <li>장2도 (2반음) / 장3도 (4반음) / 완전4도 (5반음) / 완전5도 (7반음) / 옥타브 (12반음) 5 가지 핵심 음정 암기</li>
            <li>메이저 스케일 = 온-온-반-온-온-온-반 (W-W-H-W-W-W-H) 패턴</li>
            <li><strong>도구</strong>: <a href="/tools/scale-dictionary">스케일 사전</a> 에서 메이저 스케일 12 키 모두 들어보기</li>
        </ul>
    </section>

    <section>
        <h2>중급 단계 (Stage 2) — 코드와 7화음</h2>
        <p><strong>학습 목표</strong>: 트라이어드 + 7화음 + 코드 기능 이해</p>
        <ul>
            <li>코드 카테고리 30 문항 풀기 → 70% 이상</li>
            <li>메이저 / 마이너 / 감 / 증 트라이어드 4 종</li>
            <li>Maj7 / Dom7 / m7 / m7♭5 / dim7 / mMaj7 — 7 화음 6 종</li>
            <li>코드 기능: T (토닉, I) / S (서브도미넌트, IV) / D (도미넌트, V)</li>
            <li><strong>도구</strong>: <a href="/tools/chord-dictionary">코드 사전</a> 의 360 코드 + <a href="/tools/chord-progression">코드 진행</a> 의 32 진행</li>
        </ul>
    </section>

    <section>
        <h2>중급 단계 (Stage 3) — 조성과 5도권</h2>
        <p><strong>학습 목표</strong>: 24 조성 식별, 5도권, 평행조 / 관계조</p>
        <ul>
            <li>조성 카테고리 20 문항 풀기 → 70% 이상</li>
            <li>5도권 시계 방향 (♯ 추가): C-G-D-A-E-B-F♯-C♯</li>
            <li>5도권 반시계 방향 (♭ 추가): C-F-B♭-E♭-A♭-D♭-G♭-C♭</li>
            <li>관계조: A 마이너 ↔ C 메이저 (조표 동일)</li>
            <li>평행조: C 메이저 ↔ C 마이너 (으뜸음 동일, 조표 다름)</li>
            <li>화성/선율 단음계: 7음 (도음) 을 반음 올림</li>
        </ul>
    </section>

    <section>
        <h2>고급 단계 (Stage 4) — 화성 진행</h2>
        <p><strong>학습 목표</strong>: 진행 분석 + 작곡 응용</p>
        <ul>
            <li>진행 카테고리 20 문항 풀기 → 70% 이상</li>
            <li>I-V-vi-IV / ii-V-I / 카논 / 50년대 / 안달루시안 / 12-bar blues 모두 식별</li>
            <li>이차 도미넌트 (V/vi, V/ii 등)</li>
            <li>거짓 종지 (V → vi), 플라갈 종지 (IV → I)</li>
            <li>Rhythm Changes A 섹션 (I-vi-ii-V) 이해</li>
        </ul>
    </section>

    <section>
        <h2>리듬 단계 (Stage 5) — 박자와 잇단음표</h2>
        <ul>
            <li>리듬 카테고리 10 문항 풀기 → 80% 이상</li>
            <li>4/4 / 3/4 / 6/8 / 5/4 / 7/8 박자 의미</li>
            <li>점음표 (1.5 배), 셋잇단음표 (2 박을 3 음으로), 폴리리듬 (3:2)</li>
            <li>스윙 vs 스트레이트 8분음표</li>
            <li>Auftakt (마디 끝부터 시작하는 약박)</li>
        </ul>
    </section>

    <section>
        <h2>특화 단계 (Stage 6) — 한국 전통 음악</h2>
        <ul>
            <li>한국 음악 카테고리 5 문항 풀기 → 100%</li>
            <li><strong>평조</strong>: 황종-태주-중려-임종-남려 (도-레-미-솔-라 와 유사)</li>
            <li><strong>계면조</strong>: 황종-협종-중려-임종-무역 (단조 5음, 슬픔/한)</li>
            <li><strong>판소리 장단</strong>: 진양조 (40 BPM, 24박) → 중모리 → 자진모리 (120) → 휘모리 (160)</li>
            <li><strong>가야금</strong>: 정악 12현, 산조 12/18/21현</li>
            <li><strong>단소</strong>: 약 2 옥타브 음역 (저음 황종 ~ 한 옥타브 위)</li>
        </ul>
    </section>

    <section>
        <h2>학습 팁</h2>
        <ul>
            <li><strong>매일 5~10 분</strong> — 길게 한 번보다 매일 짧게.</li>
            <li><strong>약점 카테고리 중점</strong> — 정답률 60% 미만 카테고리는 "약점" 표시. 그것부터.</li>
            <li><strong>마스터 모드</strong> — 한 카테고리만 깊게 풀어 그 영역 마스터.</li>
            <li><strong>이론 + 청음 결합</strong> — 인터벌 트레이너 + 이론 퀴즈 함께.</li>
            <li><strong>실제 곡에서 찾기</strong> — 학습한 진행을 좋아하는 곡에서 들어보기.</li>
        </ul>
    </section>

    <section>
        <h2>관련 도구</h2>
        <div class="related">
            <a href="/tools/interval-trainer" class="related-card">👂 인터벌 트레이너 — 음정 청음</a>
            <a href="/tools/scale-dictionary" class="related-card">📖 스케일 사전 — 192 스케일</a>
            <a href="/tools/chord-dictionary" class="related-card">📚 코드 사전 — 360 코드</a>
            <a href="/tools/chord-progression" class="related-card">🎹 코드 진행 — 32 진행</a>
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
    .related { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin-top: 12px; }
    .related-card { display: block; padding: 14px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; text-decoration: none; color: #4b5563; font-size: 14px; }
    .related-card:hover { background: #eef2ff; border-color: #6366f1; color: #4f46e5; }
</style>
