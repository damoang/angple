<script lang="ts">
    import { getLang } from '$lib/i18n/store.svelte';
    const lang = $derived(getLang());
</script>

<svelte:head>
    <title>피아노 롤 작곡 입문 — 멜로디 / 리듬 / 화성 만들기 | 뮤지아</title>
    <meta name="description" content="피아노 롤로 작곡 입문. 16 스텝 격자, 메이저 스케일에서 멜로디 만들기, 4-on-the-floor / 록 / 보사노바 / 트랩 / K-Pop 리듬 패턴, 화성 위에 멜로디 쌓기, 자동 저장과 URL 공유." />
    <link rel="canonical" href="https://muzia.net/tools/piano-roll/guide" />
</svelte:head>

<article class="guide">
    <nav class="crumb"><a href="/tools">← 도구 모음</a> / <a href="/tools/piano-roll">피아노 롤</a> / <span>가이드</span></nav>
    <header>
        <h1>피아노 롤 작곡 입문 — 멜로디 / 리듬 / 화성</h1>
        <p class="lead">16 스텝 × 24 키 격자에서 작곡 시작하기. 작곡 입문자를 위한 멜로디 / 리듬 / 화성 가이드.</p>
        <p class="cta-row"><a href="/tools/piano-roll" class="cta-btn">▶ 피아노 롤 열기</a></p>
    </header>

    <section>
        <h2>1. 첫 단계 — 스케일 안에서</h2>
        <p>모든 음을 자유롭게 찍으면 음악이 되지 않습니다. <strong>스케일 안의 음만</strong> 찍어보세요.</p>
        <ul>
            <li>C 메이저 스케일: <strong>C - D - E - F - G - A - B</strong> (흰 건반만)</li>
            <li>피아노 롤에서 흰 건반 행만 클릭 → 자연스러운 멜로디</li>
            <li>다른 스케일은 <a href="/tools/scale-dictionary">스케일 사전</a>에서 확인</li>
        </ul>
    </section>

    <section>
        <h2>2. 멜로디 만들기 5 가지 팁</h2>
        <ul>
            <li><strong>2도 / 3도 step 위주</strong> — 인접한 음 (도→레, 레→미) 으로 이동. 큰 도약 (5도+) 은 강조용.</li>
            <li><strong>강박에 화성음</strong> — 1, 5 박 (스텝 1, 9) 에 코드 안의 음 (C 메이저 키면 C-E-G).</li>
            <li><strong>긴장과 해결</strong> — 후렴 끝은 "도 (C)" 또는 "솔 (G)" 로 회귀.</li>
            <li><strong>리듬 다양화</strong> — 같은 음 길이만 X. 4분 + 8분 + 점음표 섞어 변화.</li>
            <li><strong>대칭과 반복</strong> — 같은 모티브를 약간 변형해 재활용.</li>
        </ul>
    </section>

    <section>
        <h2>3. 리듬 패턴 — 4/4 16 스텝 기준</h2>
        <ul>
            <li><strong>4-on-the-floor (하우스)</strong> — 스텝 1, 5, 9, 13 (모든 다운비트). 댄스 EDM.</li>
            <li><strong>록 비트</strong> — 킥 1, 9 / 스네어 5, 13 / 하이햇 모든 8분음표.</li>
            <li><strong>보사노바</strong> — 1, 4, 7, 11, 14 (싱코페이션).</li>
            <li><strong>K-Pop 댄스</strong> — 록 비트 + 16분음표 트리플 강세 (boom-bap-tk-tk).</li>
            <li><strong>발라드</strong> — 1, 9 (큰 비트만). 빠른 음표 배제.</li>
            <li><strong>트랩</strong> — 하이햇 16분음표 분할, 32분 stutter.</li>
            <li><strong>레게</strong> — 2, 4 (오프비트), 1박은 비움.</li>
            <li><strong>블루스 셔플</strong> — 8분 스윙 (장-단 비율).</li>
        </ul>
    </section>

    <section>
        <h2>4. 화성 위에 멜로디 — 코드 진행 결합</h2>
        <p>
            <a href="/tools/chord-progression">코드 진행 도구</a>에서 마음에 드는 진행을 골라 들으면서, 그 코드 안의 음으로 멜로디를 짜는 게 정석.
        </p>
        <ul>
            <li>C 메이저 (C-E-G) 위에는 C, E, G 음을 강박에</li>
            <li>약박에는 진행하는 음 (D, F 등)</li>
            <li>코드 변화 시 멜로디도 같이 변화 (다음 코드의 음으로 이동)</li>
        </ul>
    </section>

    <section>
        <h2>5. 자동 저장 + URL 공유</h2>
        <p>
            피아노 롤은 작업 내용을 <strong>localStorage</strong> 에 자동 저장합니다. 새로고침해도 유지.
            "🔗 공유" 버튼은 현재 패턴을 URL hash 로 인코딩 → 누구든 그 URL 로 접속하면 같은 패턴 즉시 보임.
        </p>
    </section>

    <section>
        <h2>6. JSON 다운로드 — 외부 도구 연동</h2>
        <p>
            피아노 롤의 데이터를 JSON 으로 다운로드 가능. 형식:
        </p>
        <pre>{`{
  "version": 1,
  "bpm": 120,
  "cells": [[true, false, ...], ...]
}`}</pre>
        <p>다른 도구에서 읽거나 직접 코드로 처리할 수 있도록 단순한 형식.</p>
    </section>

    <section>
        <h2>7. 다음 단계 — MIDI 시퀀서로</h2>
        <p>
            피아노 롤은 16 스텝 + 1 트랙. 본격 편곡은 <a href="/tools/midi-sequencer">MIDI 시퀀서</a>:
        </p>
        <ul>
            <li>32 스텝 (2배)</li>
            <li>4 트랙 (Piano + Bass + Strings + Drums)</li>
            <li>.mid 다운로드 → DAW (Logic / Ableton / Cubase) 임포트</li>
        </ul>
    </section>

    <section>
        <h2>관련 도구</h2>
        <div class="related">
            <a href="/tools/scale-dictionary" class="related-card">📖 스케일 사전 — 멜로디용 스케일</a>
            <a href="/tools/chord-progression" class="related-card">🎹 코드 진행 — 화성 위에 멜로디</a>
            <a href="/tools/midi-sequencer" class="related-card">🎚️ MIDI 시퀀서 — 본격 편곡</a>
            <a href="/tools/metronome" class="related-card">🎵 메트로놈 — 박자 잡기</a>
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
    pre { background: #1f2937; color: #d1d5db; padding: 14px; border-radius: 8px; overflow-x: auto; font-size: 13px; line-height: 1.6; font-family: monospace; }
    .related { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin-top: 12px; }
    .related-card { display: block; padding: 14px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; text-decoration: none; color: #4b5563; font-size: 14px; }
    .related-card:hover { background: #eef2ff; border-color: #6366f1; color: #4f46e5; }
</style>
