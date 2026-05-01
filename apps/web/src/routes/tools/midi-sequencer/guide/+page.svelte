<script lang="ts">
    import { getLang } from '$lib/i18n/store.svelte';
    const lang = $derived(getLang());
</script>

<svelte:head>
    <title>MIDI 시퀀서 작·편곡 가이드 — 4 트랙 + DAW 임포트 | 뮤지아</title>
    <meta name="description" content="MIDI 시퀀서 4 트랙 (Piano / Bass / Strings / Drums) 활용. 트랙별 역할, 비트 패턴, .mid 입출력, Logic / Cubase / Ableton / FL Studio / Studio One 임포트 워크플로." />
    <link rel="canonical" href="https://muzia.net/tools/midi-sequencer/guide" />
</svelte:head>

<article class="guide">
    <nav class="crumb"><a href="/tools">← 도구 모음</a> / <a href="/tools/midi-sequencer">MIDI 시퀀서</a> / <span>가이드</span></nav>
    <header>
        <h1>MIDI 시퀀서 작·편곡 가이드</h1>
        <p class="lead">4 트랙 × 32 스텝 시퀀서로 본격 작·편곡. DAW 임포트 워크플로 + 트랙별 역할 + 비트 패턴 종합 가이드.</p>
        <p class="cta-row"><a href="/tools/midi-sequencer" class="cta-btn">▶ MIDI 시퀀서 열기</a></p>
    </header>

    <section>
        <h2>1. MIDI 란?</h2>
        <p>
            MIDI = Musical Instrument Digital Interface. 1983 년 만들어진 음악 데이터 표준. 음 자체 (오디오) 가 아닌 <strong>"어떤 음을 언제 얼마나 강하게"</strong> 라는 정보만 저장. 즉 악보의 디지털 형태에 가깝습니다.
        </p>
        <ul>
            <li>파일 크기 매우 작음 (1 분 곡 = 5KB 이하)</li>
            <li>편집 자유 — 음/리듬/악기 모두 후처리 가능</li>
            <li>오디오가 아닌 정보 — 어떤 음원으로 연주할지는 별도</li>
        </ul>
    </section>

    <section>
        <h2>2. 4 트랙의 역할</h2>
        <ul>
            <li><strong>Piano (멜로디 / 화성)</strong> — 코드 백킹 또는 멜로디 메인. 음역 C3-C5.</li>
            <li><strong>Bass (베이스 라인)</strong> — 각 코드의 루트음 위주. 음역 E1-G2. 1, 9 스텝에 강하게.</li>
            <li><strong>Strings (스트링)</strong> — 긴 노트로 화성을 받쳐줌. 코드의 위쪽 음 (3음 / 5음).</li>
            <li><strong>Drums (드럼)</strong> — 킥 1, 9 / 스네어 5, 13 / 하이햇 모든 8분.</li>
        </ul>
    </section>

    <section>
        <h2>3. 4 코드 워크플로 — 5 분 안에 곡 한 마디</h2>
        <ol>
            <li><strong>코드 진행 결정</strong> — <a href="/tools/chord-progression">코드 진행 도구</a>에서 vi-IV-I-V (K-Pop) 선택. C 메이저 = Am-F-C-G.</li>
            <li><strong>Bass 트랙</strong> — 각 8 스텝마다 코드 루트음 (Am=A, F=F, C=C, G=G). 1, 9, 17, 25 스텝.</li>
            <li><strong>Piano 트랙</strong> — 각 코드의 3음 / 5음을 화성으로. Am 코드면 A-C-E.</li>
            <li><strong>Drums 트랙</strong> — 록 비트 (킥 1,9,17,25 / 스네어 5,13,21,29).</li>
            <li><strong>Strings 트랙</strong> — 긴 노트 (4박 이상) 로 화성 받쳐줌.</li>
            <li><strong>재생 + .mid 다운로드</strong> → DAW 로 임포트 → 인스트 갱신 → 마무리.</li>
        </ol>
    </section>

    <section>
        <h2>4. DAW 임포트 워크플로</h2>
        <ul>
            <li><strong>Logic Pro</strong> — File → Import → MIDI File. 트랙별 자동 분할.</li>
            <li><strong>Cubase</strong> — File → Import → MIDI File. Track 폴더 자동 생성.</li>
            <li><strong>Ableton Live</strong> — Drag &amp; Drop .mid 파일 → MIDI 트랙으로 자동 변환.</li>
            <li><strong>FL Studio</strong> — File → Import → MIDI. Channel Rack 에 트랙별 추가.</li>
            <li><strong>Studio One</strong> — Drag &amp; Drop 또는 Song → Import File.</li>
            <li><strong>Reaper</strong> — Insert → Media File → .mid 선택.</li>
            <li><strong>Pro Tools</strong> — File → Import → MIDI.</li>
            <li><strong>GarageBand</strong> — File → Import → MIDI File.</li>
        </ul>
        <p>임포트 후 인스트루먼트 (음원) 는 DAW 에서 별도 지정. 본 시퀀서는 GM (General MIDI) 채널 매핑 안 함.</p>
    </section>

    <section>
        <h2>5. .mid 업로드 — 다른 곡 분석</h2>
        <p>
            기존 .mid 파일을 업로드하면 32 스텝 격자에 자동 변환됩니다. 32 초과 부분은 잘림. 곡의 첫 8 마디 (4/4 32 스텝) 를 분석하는 데 활용.
        </p>
        <ul>
            <li>인터넷의 무료 MIDI 사이트에서 다운로드</li>
            <li>DAW 에서 자기 곡을 .mid 로 내보내기</li>
            <li>본 시퀀서에서 업로드 → 시각화 + 편집</li>
        </ul>
    </section>

    <section>
        <h2>6. 자동 저장 + 백업</h2>
        <p>
            작업 내용은 자동으로 브라우저 localStorage 에 저장 (1 초 debounce). 새로고침 시 마지막 상태 복원.
        </p>
        <p>
            <strong>중요한 작업은 .mid 다운로드</strong>로 백업. localStorage 는 브라우저 캐시 정리 시 삭제 가능.
        </p>
    </section>

    <section>
        <h2>7. 한국 음악 K-Pop / 트로트 / CCM 편곡 팁</h2>
        <ul>
            <li><strong>K-Pop 댄스 (BPM 128)</strong> — 4-on-the-floor 킥, 빠른 하이햇, 베이스는 옥타브 도약.</li>
            <li><strong>발라드 (BPM 70)</strong> — 드럼은 적게 (1, 9 만), Piano + Strings 위주, Bass 는 단순.</li>
            <li><strong>트로트 (BPM 110)</strong> — 단조 진행 (Am-Dm-E), 스트레이트 8분음표 베이스.</li>
            <li><strong>CCM 찬양 (BPM 80)</strong> — Piano 중심, Strings 패드, Bass 는 4분음표 워킹.</li>
        </ul>
    </section>

    <section>
        <h2>8. 인스트루먼트 변경 / Mute / Solo</h2>
        <ul>
            <li><strong>인스트 변경</strong> — 트랙 행의 select 메뉴에서 4 종 (Piano / Bass / Strings / Drums) 선택.</li>
            <li><strong>M (Mute)</strong> — 그 트랙만 끔. 다른 트랙은 그대로.</li>
            <li><strong>S (Solo)</strong> — 그 트랙만 들음. Solo 가 하나라도 켜지면 Solo 트랙만 재생.</li>
            <li><strong>볼륨 슬라이더</strong> — -30dB ~ 0dB. 트랙별 믹싱.</li>
        </ul>
    </section>

    <section>
        <h2>관련 도구</h2>
        <div class="related">
            <a href="/tools/piano-roll" class="related-card">🎹 피아노 롤 — 1 트랙 단순 작곡</a>
            <a href="/tools/chord-progression" class="related-card">🎼 코드 진행 — 화성 결정</a>
            <a href="/tools/score-editor" class="related-card">📜 MusicXML 사보 — 사보로 변환</a>
            <a href="/tools/bpm-tap" class="related-card">⏱️ BPM 탭 — 곡 BPM 측정</a>
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
