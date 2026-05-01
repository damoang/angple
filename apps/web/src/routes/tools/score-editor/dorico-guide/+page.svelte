<script lang="ts">
    import { getLang } from '$lib/i18n/store.svelte';
    const lang = $derived(getLang());
</script>

<svelte:head>
    <title>도리코 (Dorico) 종합 가이드 — Steinberg 의 차세대 사보 프로그램 | 뮤지아</title>
    <meta name="description" content="Steinberg 도리코 (Dorico Pro / Elements / SE) 종합 가이드. 5 가지 모드 (Setup / Write / Engrave / Play / Print), 단축키 50+, 한글 입력, MusicXML 워크플로, 시벨리우스에서 마이그레이션, 한국 사보 사용자를 위한 팁." />
    <link rel="canonical" href="https://muzia.net/tools/score-editor/dorico-guide" />
</svelte:head>

<article class="guide">
    <nav class="crumb">
        <a href="/tools">← 도구 모음</a> / <a href="/tools/score-editor">MusicXML 사보</a> /
        <a href="/tools/score-editor/guide">가이드</a> / <span>도리코</span>
    </nav>

    <header>
        <h1>도리코 (Dorico) 종합 가이드</h1>
        <p class="lead">
            Steinberg 의 차세대 사보 프로그램 <strong>도리코 (Dorico)</strong> 종합 가이드. 5 모드 워크플로 / 단축키 50+ / 한글 입력 / MusicXML 워크플로 / 시벨리우스 마이그레이션까지.
        </p>
        <p class="cta-row">
            <a href="/tools/score-editor" class="cta-btn">▶ MusicXML 사보 도구 열기</a>
            <a href="/dorico" class="cta-btn ghost">도리코 게시판</a>
        </p>
    </header>

    <section>
        <h2>1. 도리코 — 무엇이 다른가?</h2>
        <p>
            도리코는 2016 년 Steinberg (Cubase 제작사) 가 출시한 사보 프로그램. 시벨리우스 핵심 개발진이 이적해 만든 차세대 프로그램으로, 시벨리우스 / 피날레의 한계를 의식한 새 설계가 특징입니다.
        </p>
        <ul>
            <li><strong>5 가지 모드</strong> — Setup (기본 설정) / Write (음표 입력) / Engrave (페이지 디자인) / Play (재생) / Print (인쇄). 각 모드가 서로 다른 화면 구성.</li>
            <li><strong>자동 레이아웃</strong> — 마디 / 페이지 / 시스템 자동 조정. 시벨리우스보다 훨씬 자연스러운 결과.</li>
            <li><strong>플로우 (Flow)</strong> — 한 프로젝트 안에 여러 곡 (악장) 을 자유롭게. Movement 가 아닌 Flow 라는 개념.</li>
            <li><strong>HALion Sonic SE</strong> 음원 내장 (Cubase 와 공유). 재생 품질 우수.</li>
            <li><strong>Cubase 와 연동</strong> — VST 임포트, VariAudio 호환, ARA 통합.</li>
        </ul>
    </section>

    <section>
        <h2>2. 도리코 버전 — Pro / Elements / SE</h2>
        <table>
            <thead><tr><th>버전</th><th>가격 (USD)</th><th>주요 차이</th></tr></thead>
            <tbody>
                <tr><td><strong>Dorico Pro 6</strong></td><td>~$579</td><td>모든 기능. 무제한 악기 / 무제한 플로우. 전문가용</td></tr>
                <tr><td><strong>Dorico Elements 6</strong></td><td>~$99</td><td>최대 24 악기, 페이지 디자인 일부 제한. 학생 / 작곡가</td></tr>
                <tr><td><strong>Dorico SE 6</strong></td><td>무료</td><td>최대 2 악기, 4 페이지. 학습용 / 트라이얼</td></tr>
                <tr><td>학생 할인</td><td>~50% off</td><td>학생 / 교사 인증 시. Steinberg 사이트에서.</td></tr>
            </tbody>
        </table>
        <p>처음 도리코를 쓰려면 <strong>Dorico SE 무료</strong> 부터 시작 → 익숙해지면 Elements (대부분 충분) → Pro.</p>
    </section>

    <section>
        <h2>3. 핵심 단축키 50+</h2>

        <h3>Setup 모드</h3>
        <ul>
            <li><code>Ctrl+1</code> 또는 <code>Cmd+1</code> — Setup 모드</li>
            <li><code>Shift+P</code> — Players (악기) 추가</li>
            <li><code>Shift+L</code> — Layouts (페이지) 추가</li>
            <li><code>Shift+F</code> — Flow (곡 / 악장) 추가</li>
        </ul>

        <h3>Write 모드 (음표 입력)</h3>
        <ul>
            <li><code>Ctrl+2</code> / <code>Cmd+2</code> — Write 모드</li>
            <li><code>Shift+N</code> — 음표 입력 시작 / 종료 (Caret 활성)</li>
            <li><code>A~G</code> — 해당 음 입력 (Caret 위치에)</li>
            <li><code>1~8</code> — 음표 길이 (4=8분, 5=4분, 6=2분, 7=온음, 8=2 옥타브 위)</li>
            <li><code>.</code> — 점음표 (해당 음 다음)</li>
            <li><code>;</code> — 셋잇단음표 (Tuplet 입력 모드)</li>
            <li><code>Y</code> — 코드 모드 (한 비트에 여러 음)</li>
            <li><code>=</code> — 슬러 (Slur)</li>
            <li><code>T</code> — 타이 (Tie)</li>
            <li><code>P</code> — 다이나믹 popover (예: <code>P p</code> = piano, <code>P f</code> = forte)</li>
            <li><code>Shift+T</code> — Tempo popover (예: <code>Shift+T q=120</code> = 4분 = 120 BPM)</li>
            <li><code>Shift+M</code> — Time signature (예: <code>Shift+M 4/4</code>)</li>
            <li><code>Shift+K</code> — Key signature (예: <code>Shift+K G</code> = G 메이저, <code>Shift+K Ab</code> = A♭)</li>
            <li><code>Shift+C</code> — Chord symbol (예: <code>Shift+C Cmaj7</code>)</li>
        </ul>

        <h3>Engrave 모드 (페이지 디자인)</h3>
        <ul>
            <li><code>Ctrl+3</code> / <code>Cmd+3</code> — Engrave 모드</li>
            <li><code>Alt+드래그</code> — 객체 미세 이동</li>
            <li><code>Ctrl+드래그</code> — 큰 단위 이동</li>
        </ul>

        <h3>Play 모드 / Print 모드</h3>
        <ul>
            <li><code>Ctrl+4</code> / <code>Cmd+4</code> — Play 모드</li>
            <li><code>Ctrl+5</code> / <code>Cmd+5</code> — Print 모드</li>
            <li><code>Space</code> — 재생 / 정지 (모든 모드)</li>
        </ul>

        <h3>편집 / 이동</h3>
        <ul>
            <li><code>Tab</code> — 다음 마디로</li>
            <li><code>Shift+Tab</code> — 이전 마디로</li>
            <li><code>Ctrl+Z</code> / <code>Cmd+Z</code> — Undo</li>
            <li><code>Ctrl+R</code> / <code>Cmd+R</code> — 선택 영역 반복 (Repeat)</li>
            <li><code>Alt+위/아래</code> — 선택 음 다이아토닉 이동 (한 도수)</li>
            <li><code>Shift+Alt+위/아래</code> — 옥타브 이동</li>
            <li><code>Ctrl+I</code> / <code>Cmd+I</code> — Properties 패널</li>
            <li><code>Z</code> — Insert mode (음표 삽입 시 뒤 음 밀어냄)</li>
        </ul>
    </section>

    <section>
        <h2>4. 도리코의 5 가지 모드 워크플로</h2>

        <h3>Setup 모드 — 기본 설정</h3>
        <p>곡 시작 전에 악기 (Player) 와 레이아웃 (Layout), 그리고 곡 (Flow) 을 정의합니다.</p>
        <ol>
            <li>Players 패널에서 <strong>+</strong> 클릭 → 악기 카테고리 (Strings / Woodwinds / Brass / Keyboards / Voices) 선택</li>
            <li>Layouts: Full Score (전체 악보) / Part (개별 악기 보면) 자동 생성</li>
            <li>Flow: 여러 곡 / 악장이면 Flow 추가 (Symphony 의 4 악장 = 4 Flows)</li>
        </ol>

        <h3>Write 모드 — 음표 입력</h3>
        <p>실제 음표를 입력하는 단계. <strong>Shift+N</strong> 으로 Caret (입력 커서) 활성.</p>
        <ul>
            <li><strong>음표 입력</strong>: <code>A~G</code> 키. 옥타브는 가장 가까운 옥타브로 자동.</li>
            <li><strong>음표 길이</strong>: 입력 전에 <code>1~8</code> 키.</li>
            <li><strong>샵/플랫</strong>: 입력 후 <code>+</code> (샵), <code>-</code> (플랫). 또는 음표 직접 클릭 후 화살표 키.</li>
            <li><strong>휴 (Rest)</strong>: <code>0</code> (zero) 키. 음표 길이 적용됨.</li>
            <li><strong>Popovers</strong>: 다이나믹 <code>P</code>, 템포 <code>Shift+T</code>, 박자 <code>Shift+M</code>, 조 <code>Shift+K</code> 등 — 텍스트로 빠르게 입력.</li>
        </ul>

        <h3>Engrave 모드 — 페이지 디자인</h3>
        <p>인쇄 전 페이지 미세 조정. 도리코의 자동 레이아웃이 우수해 대부분 손볼 게 적음.</p>
        <ul>
            <li>객체 (음표 / 슬러 / 다이나믹) 위치 조정 — Alt 드래그</li>
            <li>마디 / 시스템 줄바꿈 (System Break) 강제</li>
            <li>페이지 마진 / 스테이브 사이즈 / 폰트 변경</li>
        </ul>

        <h3>Play 모드 — 재생 / 음원</h3>
        <p>HALion Sonic SE 또는 외부 VST 로 재생. 미세 조정 (벨로시티 / 페달) 가능.</p>

        <h3>Print 모드 — 인쇄 / PDF</h3>
        <p>인쇄 미리보기. PDF / GraphicSlice (PNG / SVG) 내보내기.</p>
    </section>

    <section>
        <h2>5. MusicXML 워크플로</h2>

        <h3>도리코에서 MusicXML 내보내기</h3>
        <ol>
            <li><strong>File</strong> → <strong>Export</strong> → <strong>MusicXML</strong></li>
            <li>대상 폴더 선택</li>
            <li>옵션: <strong>Compressed (.mxl)</strong> 권장 — 파일 크기 1/5 ~ 1/10</li>
            <li>저장</li>
        </ol>
        <p>도리코 4 부터 표현 (다이나믹 / 슬러 / 연주법) 보존이 우수. 단 일부 사용자 정의 마킹은 손실 가능.</p>

        <h3>도리코에서 MusicXML 가져오기</h3>
        <ol>
            <li><strong>Hub</strong> 화면에서 <strong>Import MusicXML</strong> 클릭</li>
            <li>또는 <strong>File</strong> → <strong>Open</strong> → 형식 필터에서 MusicXML 선택</li>
            <li>가져오기 옵션: 박자표 / 조표 / 가사 보존 여부</li>
        </ol>
        <p>다른 사보 프로그램의 곡을 도리코로 옮길 때 사용. 시벨리우스 / 피날레 → 도리코 마이그레이션의 핵심 경로.</p>

        <h3>본 도구와 연동</h3>
        <p>
            도리코에서 .musicxml 내보내기 → <a href="/tools/score-editor">사보 에디터</a> 에 업로드 → 트랜스포즈 / 조성 변경 / 재생 → 수정본 다운로드 → 도리코로 다시 가져오기.
        </p>
    </section>

    <section>
        <h2>6. 한글 입력 — 가사 / 텍스트</h2>
        <p>
            도리코는 한글 입력을 잘 지원합니다.
        </p>
        <ul>
            <li><strong>가사 (Lyrics)</strong>: <code>Shift+L</code> 으로 Lyric Caret 활성 → 한글 직접 입력. 음절 (소절) 단위로 음표에 자동 정렬. 띄어쓰기는 다음 음표로 이동.</li>
            <li><strong>텍스트 (Text)</strong>: <code>Shift+X</code> 로 자유 텍스트. 한글 폰트 (예: 바탕 / 나눔명조) 지정 가능.</li>
            <li><strong>제목 / 작곡가</strong>: Setup 모드에서 Project Info 에 한글 입력.</li>
            <li><strong>리허설 마크</strong>: <code>Shift+R</code> 후 한글 가능 (예: "후렴", "간주").</li>
        </ul>
        <p>도리코 한국어 인터페이스는 5 버전부터 정식 지원 (메뉴 / 패널 한국어).</p>
    </section>

    <section>
        <h2>7. 시벨리우스 → 도리코 마이그레이션</h2>
        <ol>
            <li><strong>시벨리우스에서 MusicXML 내보내기</strong>: File → Export → MusicXML (Compressed .mxl)</li>
            <li><strong>도리코에서 가져오기</strong>: Hub → Import MusicXML → 파일 선택</li>
            <li><strong>확인 사항</strong>: 박자표 / 조표 / 가사 / 다이나믹 / 슬러 모두 잘 들어왔는지</li>
            <li><strong>손실 가능 항목</strong>: 시벨리우스 전용 마킹 (특수 다이나믹 등) / 페이지 레이아웃은 다시 손봐야</li>
            <li><strong>장점</strong>: 도리코 자동 레이아웃이 더 깔끔. 시벨리우스에서 수동 조정한 부분이 도리코는 자동으로 처리.</li>
        </ol>
        <p>
            <strong>주의</strong>: 시벨리우스 프로젝트 (.sib) 를 직접 못 열음. 반드시 MusicXML 경유. 그래서 도리코 4 부터 .musicxml import 가 핵심.
        </p>
    </section>

    <section>
        <h2>8. 한국 사보 사용자를 위한 팁</h2>
        <ul>
            <li><strong>한글 폰트</strong>: Engrave 모드 → Library → Paragraph Styles → 한글 폰트 (나눔명조 / 바탕) 변경. 가사 / 제목 / 작곡가 정보에 적용.</li>
            <li><strong>K-Pop / CCM 코드 차트</strong>: <code>Shift+C</code> Chord popover 로 빠른 입력. 전체 키 트랜스포즈는 <strong>Edit → Paste Special → Paste at Pitch</strong>.</li>
            <li><strong>국악 기보</strong>: 도리코는 5 선보 기본. 국악 정간보는 별도 그래픽 표 또는 시벨리우스 호환 사보로.</li>
            <li><strong>합창 (CCM 찬양)</strong>: 4 부 합창 (SATB) 은 도리코의 Voices 기능 활용. <code>Alt+1~4</code> 로 보이스 변경.</li>
            <li><strong>기타 코드 차트</strong>: <strong>Edit → Players → Properties → Notation Options</strong> 에서 코드 다이어그램 자동 생성.</li>
        </ul>
    </section>

    <section>
        <h2>9. 도리코의 특징 — 시벨리우스 / 피날레와 비교</h2>
        <table>
            <thead><tr><th>특징</th><th>도리코</th><th>시벨리우스</th><th>피날레</th></tr></thead>
            <tbody>
                <tr><td>출시</td><td>2016 (최신)</td><td>1993 (성숙)</td><td>1988 (가장 오래됨)</td></tr>
                <tr><td>자동 레이아웃</td><td>★★★★★ (최고)</td><td>★★★★ (우수)</td><td>★★★ (수동 조정 필요)</td></tr>
                <tr><td>음원 품질</td><td>HALion 내장 (★★★★★)</td><td>NotePerformer (별도, ★★★★★)</td><td>Garritan (내장, ★★★★)</td></tr>
                <tr><td>학습 곡선</td><td>중상 (5 모드 익숙)</td><td>중 (직관적)</td><td>높음 (가장 복잡)</td></tr>
                <tr><td>한글 지원</td><td>★★★★ (우수)</td><td>★★★★ (우수)</td><td>★★★ (가능)</td></tr>
                <tr><td>가격</td><td>$579 (Pro)</td><td>$599 (Ultimate)</td><td>$299 (단일)</td></tr>
                <tr><td>구독 옵션</td><td>월 $14.95</td><td>월 $9.99</td><td>없음 (영구)</td></tr>
            </tbody>
        </table>
    </section>

    <section>
        <h2>10. 도리코 학습 자료</h2>
        <ul>
            <li><strong>Steinberg 공식 튜토리얼</strong> (영어) — YouTube "Dorico" 채널, 수십 시간 분량 무료</li>
            <li><strong>한국 도리코 게시판</strong> — 뮤지아 <a href="/dorico">도리코 게시판</a> 에 한국 사용자 팁 공유</li>
            <li><strong>도리코 Notes</strong> (Steinberg 블로그) — 영어 / 새 기능 안내</li>
            <li><strong>Daniel Spreadbury</strong> 의 트위터 / 페이스북 — 도리코 핵심 개발자, 핫픽스 / 팁 공유</li>
        </ul>
    </section>

    <section>
        <h2>관련 가이드</h2>
        <div class="related">
            <a href="/tools/score-editor/sibelius-guide" class="related-card">🎼 시벨리우스 가이드</a>
            <a href="/tools/score-editor/musescore-guide" class="related-card">🎵 뮤즈스코어 (무료)</a>
            <a href="/tools/score-editor/guide" class="related-card">📜 MusicXML 워크플로</a>
            <a href="/tools/score-editor" class="related-card">▶ MusicXML 사보 도구</a>
        </div>
    </section>
</article>

<style>
    .guide { max-width: 820px; margin: 0 auto; padding: 28px 16px 64px; line-height: 1.75; }
    .crumb { font-size: 13px; color: #9ca3af; margin-bottom: 16px; }
    .crumb a { color: #6366f1; text-decoration: none; }
    .crumb span { color: #6b7280; }
    h1 { font-size: 32px; font-weight: 800; margin: 12px 0 10px; }
    h2 { font-size: 22px; font-weight: 800; margin: 36px 0 14px; padding-bottom: 8px; border-bottom: 2px solid #eef2ff; }
    h3 { font-size: 17px; font-weight: 700; margin: 18px 0 10px; color: #4f46e5; }
    .lead { color: #4b5563; font-size: 16px; line-height: 1.7; }
    .cta-row { margin: 16px 0 0; display: flex; gap: 8px; flex-wrap: wrap; }
    .cta-btn { display: inline-block; padding: 10px 20px; background: #6366f1; color: #fff; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; }
    .cta-btn.ghost { background: #f9fafb; color: #6366f1; border: 1px solid #c7d2fe; }
    section p { color: #374151; font-size: 15px; margin: 10px 0; }
    section ul, section ol { color: #374151; font-size: 15px; padding-left: 22px; }
    section li { margin: 6px 0; }
    section strong { color: #4f46e5; font-weight: 700; }
    section a { color: #6366f1; }
    section code { background: #1f2937; color: #fbbf24; padding: 2px 8px; border-radius: 4px; font-size: 13px; font-family: monospace; }
    table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 13px; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    th { background: #f9fafb; font-weight: 700; }
    .related { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 10px; margin-top: 12px; }
    .related-card { display: block; padding: 14px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; text-decoration: none; color: #4b5563; font-size: 14px; }
    .related-card:hover { background: #eef2ff; border-color: #6366f1; color: #4f46e5; }
</style>
