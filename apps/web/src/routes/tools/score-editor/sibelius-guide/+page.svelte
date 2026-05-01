<script lang="ts">
    import { getLang } from '$lib/i18n/store.svelte';
    const lang = $derived(getLang());
</script>

<svelte:head>
    <title>시벨리우스 (Sibelius) 종합 가이드 — Avid 의 표준 사보 프로그램 | 뮤지아</title>
    <meta name="description" content="Avid Sibelius (Ultimate / Artist / First) 종합 가이드. 30 년 표준 사보 프로그램. 단축키 60+, 한글 입력, MusicXML 워크플로, 도리코/뮤즈스코어로 마이그레이션, 한국 사보 사용자 본진." />
    <link rel="canonical" href="https://muzia.net/tools/score-editor/sibelius-guide" />
</svelte:head>

<article class="guide">
    <nav class="crumb">
        <a href="/tools">← 도구 모음</a> / <a href="/tools/score-editor">MusicXML 사보</a> /
        <a href="/tools/score-editor/guide">가이드</a> / <span>시벨리우스</span>
    </nav>

    <header>
        <h1>시벨리우스 (Sibelius) 종합 가이드</h1>
        <p class="lead">
            <strong>Avid Sibelius</strong> = 1993 년 출시, 30 년 사보 프로그램의 표준. 한국 음대 / 출판사 / 작곡가의 본진. 핵심 개발진이 도리코로 이적했지만 시벨리우스는 여전히 가장 검증된 워크플로.
        </p>
        <p class="cta-row">
            <a href="/tools/score-editor" class="cta-btn">▶ MusicXML 사보 도구 열기</a>
            <a href="/sibelius" class="cta-btn ghost">시벨리우스 게시판</a>
        </p>
    </header>

    <section>
        <h2>1. 시벨리우스 — 30 년의 역사</h2>
        <p>
            Sibelius 는 1993 년 영국 케임브리지에서 Ben Finn / Jonathan Finn 형제가 만든 사보 프로그램. 2006 년 Avid 가 인수, 현재까지 개발 중. 핵심 개발진이 2012 년 이적해 도리코를 만들었지만, 시벨리우스는 30 년 누적된 사용자 / 워크플로 / 플러그인이 있어 여전히 표준.
        </p>
        <ul>
            <li><strong>가장 빠른 음표 입력</strong> — 알파벳 (A-G) 키 + 숫자 (1-9) 길이의 직관적 조합</li>
            <li><strong>Magnetic Layout</strong> — 자동 충돌 회피. 다이나믹 / 슬러 / 가사가 자동 정렬</li>
            <li><strong>한국 음대 표준</strong> — 모든 음대 작곡과 / 이론과 학생 사용</li>
            <li><strong>출판사 표준</strong> — Hal Leonard, Boosey & Hawkes 등 메이저 출판사가 시벨리우스로 사보</li>
            <li><strong>NotePerformer</strong> — 별도 음원 ($129), 시벨리우스의 표준 재생</li>
        </ul>
    </section>

    <section>
        <h2>2. 시벨리우스 버전</h2>
        <table>
            <thead><tr><th>버전</th><th>가격</th><th>특징</th></tr></thead>
            <tbody>
                <tr><td><strong>Sibelius Ultimate</strong></td><td>$599 (영구) / $9.99/월</td><td>모든 기능. 무제한 악기. 출판 품질.</td></tr>
                <tr><td><strong>Sibelius Artist</strong></td><td>$199 / $9.99/월</td><td>최대 16 악기. 일반 사용자.</td></tr>
                <tr><td><strong>Sibelius First (구 Sibelius First)</strong></td><td>무료</td><td>최대 4 악기. 학생 / 입문.</td></tr>
                <tr><td>학생 / 교사</td><td>~50% off</td><td>인증 시. Avid 사이트.</td></tr>
            </tbody>
        </table>
    </section>

    <section>
        <h2>3. 핵심 단축키 60+</h2>

        <h3>음표 입력 (가장 중요)</h3>
        <ul>
            <li><code>N</code> — 음표 입력 모드 시작 / 종료</li>
            <li><code>A~G</code> — 해당 음 입력 (가장 가까운 옥타브)</li>
            <li><code>1~9</code> — 음표 길이 (3=8분, 4=4분, 5=2분, 6=온음, 7=2 옥타브)</li>
            <li><code>.</code> — 점음표</li>
            <li><code>0</code> (zero) — 휴 (Rest)</li>
            <li><code>+</code> — 샵</li>
            <li><code>-</code> — 플랫</li>
            <li><code>=</code> — 자연음</li>
            <li><code>R</code> — 반복 (이전 음 / 마디 복사)</li>
            <li><code>Ctrl+L</code> / <code>Cmd+L</code> — 가사 (Lyric) 입력 모드</li>
            <li><code>Ctrl+T</code> / <code>Cmd+T</code> — 텍스트 (Technique Text)</li>
            <li><code>Ctrl+E</code> / <code>Cmd+E</code> — Expression (다이나믹 / 표현)</li>
            <li><code>Ctrl+K</code> / <code>Cmd+K</code> — Chord Symbol</li>
            <li><code>Ctrl+M</code> / <code>Cmd+M</code> — Measure number</li>
        </ul>

        <h3>편집</h3>
        <ul>
            <li><code>Ctrl+Z</code> / <code>Cmd+Z</code> — Undo</li>
            <li><code>Ctrl+Y</code> 또는 <code>Ctrl+Shift+Z</code> — Redo</li>
            <li><code>Ctrl+C</code>, <code>Ctrl+V</code> — 복사 / 붙이기</li>
            <li><code>Ctrl+B</code> — Bar (마디 끝에 추가)</li>
            <li><code>Ctrl+Shift+B</code> — 마디 일괄 추가 (다이얼로그)</li>
            <li><code>Delete</code> — 선택 음표를 휴로</li>
            <li><code>Ctrl+Delete</code> — 마디 삭제</li>
        </ul>

        <h3>이동 / 선택</h3>
        <ul>
            <li><code>Ctrl+Home</code> — 곡 처음</li>
            <li><code>Ctrl+End</code> — 곡 끝</li>
            <li><code>Ctrl+G</code> — Go to Bar (마디 번호로 이동)</li>
            <li><code>Ctrl+A</code> — 모두 선택</li>
            <li><code>Ctrl+Shift+End</code> — 끝까지 선택</li>
            <li>마디 클릭 + <code>Shift+클릭</code> — 범위 선택</li>
            <li><code>Esc</code> — 선택 해제 / 입력 모드 종료</li>
        </ul>

        <h3>음 이동</h3>
        <ul>
            <li><code>위/아래 화살표</code> — 반음 이동</li>
            <li><code>Ctrl+위/아래</code> — 다이아토닉 이동</li>
            <li><code>Ctrl+Shift+위/아래</code> — 옥타브 이동</li>
        </ul>

        <h3>레이아웃</h3>
        <ul>
            <li><code>Ctrl+Enter</code> — 시스템 줄바꿈 (System Break)</li>
            <li><code>Ctrl+Shift+Enter</code> — 페이지 줄바꿈 (Page Break)</li>
            <li><code>Ctrl+Shift+L</code> — 자동 레이아웃 토글</li>
        </ul>

        <h3>박자 / 조 / 템포</h3>
        <ul>
            <li><code>T</code> — 박자표 (Time Signature) 다이얼로그</li>
            <li><code>K</code> — 조표 (Key Signature) 다이얼로그</li>
            <li><code>Ctrl+Alt+T</code> — Tempo Text</li>
            <li><code>Ctrl+Alt+M</code> — Metronome Mark</li>
        </ul>

        <h3>재생</h3>
        <ul>
            <li><code>Space</code> — 재생 / 정지</li>
            <li><code>P</code> — Play 패널</li>
            <li><code>Ctrl+ ` </code> (백틱) — Mixer</li>
        </ul>

        <h3>인쇄 / 내보내기</h3>
        <ul>
            <li><code>Ctrl+P</code> — 인쇄</li>
            <li><code>Ctrl+S</code> — 저장</li>
            <li><code>File → Export → MusicXML</code> — MusicXML 내보내기</li>
        </ul>
    </section>

    <section>
        <h2>4. 시벨리우스 워크플로 — 처음 곡 시작</h2>
        <ol>
            <li><strong>새 프로젝트</strong>: File → New → 악기 선택 (Solo Piano / String Quartet / Orchestra 등 템플릿)</li>
            <li><strong>박자 / 조 / 템포 설정</strong>: 첫 마디 클릭 후 <code>T</code> (박자), <code>K</code> (조), <code>Ctrl+Alt+M</code> (BPM)</li>
            <li><strong>음표 입력 모드</strong>: 첫 마디 클릭 → <code>N</code> 누르면 입력 커서 활성</li>
            <li><strong>음표 입력</strong>: 길이 (4=4분음표) → 음 (A-G)</li>
            <li><strong>다음 마디로</strong>: 자동으로 다음 마디로 넘어감</li>
            <li><strong>가사</strong>: 음표 선택 후 <code>Ctrl+L</code> → 한글 직접 입력</li>
            <li><strong>다이나믹</strong>: 음표 선택 후 <code>Ctrl+E</code> → "p", "f", "mf" 등</li>
            <li><strong>슬러</strong>: 시작 음 선택 후 <code>S</code> → 끝 음까지</li>
            <li><strong>저장</strong>: <code>Ctrl+S</code> (.sib 형식)</li>
            <li><strong>내보내기</strong>: File → Export → MusicXML / PDF / MIDI</li>
        </ol>
    </section>

    <section>
        <h2>5. MusicXML 내보내기 / 가져오기</h2>

        <h3>시벨리우스에서 내보내기</h3>
        <ol>
            <li><strong>File</strong> → <strong>Export</strong> → <strong>MusicXML</strong></li>
            <li>형식: <strong>Compressed (.mxl)</strong> 권장</li>
            <li>옵션: 가사 / 텍스트 / 다이나믹 / 페이지 레이아웃 보존 여부 체크</li>
            <li>저장</li>
        </ol>

        <h3>시벨리우스에서 가져오기</h3>
        <ol>
            <li><strong>File</strong> → <strong>Open</strong> → 형식 필터 MusicXML</li>
            <li>가져오기 옵션 다이얼로그 → 박자 / 조 / 가사 / 다이나믹 / 페이지 모두 체크</li>
        </ol>

        <h3>본 도구와 연동</h3>
        <p>
            시벨리우스에서 .musicxml 내보내기 → <a href="/tools/score-editor">사보 에디터</a> 에 업로드 → 트랜스포즈 / 조성 변경 / 재생 → 다운로드 → 시벨리우스 다시 열기 (가져오기로).
        </p>
        <p>
            <strong>이조 악기 보면 만들기</strong>: 콘서트 키 곡을 시벨리우스에서 만든 후 → MusicXML 내보내기 → 사보 에디터에서 +2 반음 (B♭ 클라리넷용) → 다운로드 → 클라리넷 보면 완성.
        </p>
    </section>

    <section>
        <h2>6. 한글 입력 — 가사 / 텍스트</h2>
        <ul>
            <li><strong>가사 (Lyrics)</strong>: <code>Ctrl+L</code> 후 한글 입력. 한글 IME 자동 감지. 띄어쓰기는 다음 음표.</li>
            <li><strong>한 음에 여러 음절</strong>: 음절 사이에 <code>_</code> (밑줄) 또는 <code>-</code> (하이픈).</li>
            <li><strong>한글 폰트</strong>: <strong>House Style → Edit Text Styles → Lyrics</strong> 에서 한글 폰트 (나눔명조 / 바탕) 지정.</li>
            <li><strong>제목 / 작곡가</strong>: File → Score Info 또는 첫 페이지 텍스트 직접 클릭.</li>
            <li><strong>리허설 마크 / 섹션</strong>: <code>Ctrl+R</code> 후 한글 ("후렴", "간주", "코다" 등).</li>
        </ul>
    </section>

    <section>
        <h2>7. 한국 음대 / 출판사 워크플로</h2>
        <ul>
            <li><strong>음대 작곡과</strong>: 1, 2학년부터 시벨리우스 표준. 졸업 작품도 시벨리우스로.</li>
            <li><strong>출판사</strong>: 한국 음악 교과서 / 합창 악보 / CCM 악보집 대부분 시벨리우스로 사보.</li>
            <li><strong>오케스트라</strong>: KBS / 서울시향 등 직업 오케스트라가 보면 작성 시 시벨리우스. NotePerformer 로 미리 들어보고 출력.</li>
            <li><strong>합창단</strong>: SATB 4 부 합창은 시벨리우스 Voices (1~4) 로 분리 작성. 각 보이스 컬러 다르게.</li>
            <li><strong>CCM / 교회 음악</strong>: 인도자 키 / 회중 키 두 버전을 트랜스포즈로 만든 후 둘 다 출력.</li>
        </ul>
    </section>

    <section>
        <h2>8. 시벨리우스 ManuScript — 플러그인 / 자동화</h2>
        <p>
            시벨리우스의 강력한 기능 = ManuScript (자체 스크립트 언어). 사용자 정의 자동화 가능.
        </p>
        <ul>
            <li>플러그인 매니저에서 무료 플러그인 수백 개 설치</li>
            <li>예: 자동 코드 분석, 화성 진행 표시, 한국어 가사 자동 분배, 합창 자동 분리</li>
            <li>커뮤니티 사이트 sibelius.com / sibelius forum 에서 공유</li>
        </ul>
    </section>

    <section>
        <h2>9. 시벨리우스 → 도리코 / 뮤즈스코어 마이그레이션</h2>

        <h3>시벨리우스 → 도리코</h3>
        <p>핵심 개발진이 도리코로 이적했기 때문에, 도리코의 자동 레이아웃이 시벨리우스보다 우수. MusicXML 경유 마이그레이션:</p>
        <ol>
            <li>시벨리우스: File → Export → MusicXML (.mxl)</li>
            <li>도리코: Hub → Import MusicXML → .mxl 파일</li>
            <li>도리코에서 페이지 레이아웃 다시 손보기 (자동 조정 활용)</li>
        </ol>

        <h3>시벨리우스 → 뮤즈스코어</h3>
        <p>비용 절약 / 학생 / 동호회 목적:</p>
        <ol>
            <li>시벨리우스: File → Export → MusicXML</li>
            <li>뮤즈스코어: File → Open → .musicxml</li>
            <li>가사 / 다이나믹 / 슬러 모두 잘 들어옴</li>
            <li>출판 품질은 시벨리우스 > 뮤즈스코어 4 (격차 줄어드는 중)</li>
        </ol>
    </section>

    <section>
        <h2>10. 한국 시벨리우스 사용자 커뮤니티</h2>
        <ul>
            <li><strong>뮤지아 시벨리우스 게시판</strong>: <a href="/sibelius">/sibelius</a> — 한국 시벨리우스 사용자의 가장 큰 커뮤니티. 2002 년부터.</li>
            <li><strong>도리코 게시판</strong>: <a href="/dorico">/dorico</a> — 시벨리우스 → 도리코 마이그레이션 정보</li>
            <li><strong>강좌 / 팁</strong>: <a href="/tip">/tip</a> — 사보 사용자 팁 모음</li>
            <li><strong>공식 Avid 한국</strong> — Avid 사이트에 한국어 매뉴얼 일부 제공</li>
        </ul>
    </section>

    <section>
        <h2>관련 가이드</h2>
        <div class="related">
            <a href="/tools/score-editor/dorico-guide" class="related-card">🎹 도리코 (차세대)</a>
            <a href="/tools/score-editor/musescore-guide" class="related-card">🎵 뮤즈스코어 (무료)</a>
            <a href="/tools/score-editor/guide" class="related-card">📜 MusicXML 종합</a>
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
