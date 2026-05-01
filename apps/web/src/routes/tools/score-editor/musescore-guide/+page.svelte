<script lang="ts">
    import { getLang } from '$lib/i18n/store.svelte';
    const lang = $derived(getLang());
</script>

<svelte:head>
    <title>뮤즈스코어 (MuseScore 4) 종합 가이드 — 무료 사보 프로그램의 정점 | 뮤지아</title>
    <meta name="description" content="MuseScore 4 종합 가이드. 무료 오픈소스 사보 프로그램의 정점. 단축키 60+, MuseHub 음원, 한글 입력, MusicXML 워크플로, 시벨리우스/도리코에서 마이그레이션, MuseScore.com 공유." />
    <link rel="canonical" href="https://muzia.net/tools/score-editor/musescore-guide" />
</svelte:head>

<article class="guide">
    <nav class="crumb">
        <a href="/tools">← 도구 모음</a> / <a href="/tools/score-editor">MusicXML 사보</a> /
        <a href="/tools/score-editor/guide">가이드</a> / <span>뮤즈스코어</span>
    </nav>

    <header>
        <h1>뮤즈스코어 (MuseScore 4) 종합 가이드</h1>
        <p class="lead">
            <strong>MuseScore 4</strong> = 무료 오픈소스 사보 프로그램의 정점. 시벨리우스 / 도리코의 90% 기능을 0원에. 한국 음악 학원 / 학교 / CCM 교회 / 동호회의 표준이 되어가는 추세.
        </p>
        <p class="cta-row">
            <a href="/tools/score-editor" class="cta-btn">▶ MusicXML 사보 도구 열기</a>
            <a href="https://musescore.org" class="cta-btn ghost" target="_blank" rel="noopener">MuseScore 다운로드</a>
        </p>
    </header>

    <section>
        <h2>1. 뮤즈스코어 — 왜 무료가 가능한가?</h2>
        <p>
            MuseScore 는 2002 년부터 GPL 라이선스로 개발된 <strong>오픈소스</strong> 사보 프로그램. 2017 년부터 Muse Group (영국) 이 개발 주도. 무료의 비밀:
        </p>
        <ul>
            <li><strong>오픈소스 + 커뮤니티</strong> — 코드 공개, 전 세계 개발자 기여. GitHub 에 모든 코드.</li>
            <li><strong>수익 모델 = MuseScore.com Pro</strong> ($79/년) — 악보 다운로드 무제한, 페이드인 / 페이드아웃, 광고 제거. 사보 프로그램 자체는 무료.</li>
            <li><strong>Muse Hub</strong> — 무료 / 유료 음원 마켓플레이스. 추가 음원은 in-app 구매.</li>
            <li><strong>유료 전환 X</strong> — 1, 2, 3, 4 모든 메이저 버전 무료.</li>
        </ul>
        <p>
            MuseScore 4 (2022 출시) 는 완전히 새로 만들어진 버전. UI / 음원 / 레이아웃 모두 시벨리우스 / 도리코와 비교 가능 수준.
        </p>
    </section>

    <section>
        <h2>2. MuseScore 4 vs 다른 사보 프로그램</h2>
        <table>
            <thead><tr><th>기능</th><th>MuseScore 4</th><th>Sibelius</th><th>Dorico</th><th>Finale</th></tr></thead>
            <tbody>
                <tr><td>가격</td><td><strong>$0 (무료)</strong></td><td>$599</td><td>$579</td><td>$299</td></tr>
                <tr><td>학생 할인</td><td>해당 없음 (무료)</td><td>~50%</td><td>~50%</td><td>~50%</td></tr>
                <tr><td>음원 품질</td><td>★★★★ (Muse Sounds)</td><td>★★★★★ (NotePerformer 별도)</td><td>★★★★★ (HALion 내장)</td><td>★★★★ (Garritan)</td></tr>
                <tr><td>자동 레이아웃</td><td>★★★★ (4 부터 우수)</td><td>★★★★</td><td>★★★★★</td><td>★★★</td></tr>
                <tr><td>한국어</td><td>★★★★★ (완전 번역)</td><td>★★★★</td><td>★★★★ (5 부터)</td><td>★★★</td></tr>
                <tr><td>MusicXML</td><td>★★★★★ (네이티브)</td><td>★★★★</td><td>★★★★</td><td>★★★★</td></tr>
                <tr><td>플러그인</td><td>★★★★★ (수백 개 무료)</td><td>★★★★ (ManuScript)</td><td>★★ (제한적)</td><td>★★★</td></tr>
                <tr><td>플랫폼</td><td>Win / Mac / Linux</td><td>Win / Mac</td><td>Win / Mac</td><td>Win / Mac</td></tr>
            </tbody>
        </table>
    </section>

    <section>
        <h2>3. 핵심 단축키 60+</h2>

        <h3>음표 입력</h3>
        <ul>
            <li><code>N</code> — 음표 입력 모드 시작 / 종료 (가장 중요)</li>
            <li><code>A~G</code> — 해당 음 입력</li>
            <li><code>1~9</code> — 음표 길이 (1=64분, 2=32분, 3=16분, 4=8분, 5=4분, 6=2분, 7=온음, 8=2 옥타브, 9=4 옥타브)</li>
            <li><code>.</code> — 점음표 토글</li>
            <li><code>0</code> — 휴 (Rest)</li>
            <li><code>+</code> — 타이</li>
            <li><code>R</code> — 반복 (Repeat) — 선택한 음표를 다음 위치에 복사</li>
        </ul>

        <h3>임시표 / 음 수정</h3>
        <ul>
            <li><code>위/아래 화살표</code> — 선택 음 반음 이동</li>
            <li><code>Alt+Shift+위/아래</code> — 옥타브 이동</li>
            <li><code>↑</code> 후 자연음 강제: <code>=</code></li>
        </ul>

        <h3>코드 / 가사 / 텍스트</h3>
        <ul>
            <li><code>Ctrl+K</code> / <code>Cmd+K</code> — Chord symbol 입력 (예: Cmaj7)</li>
            <li><code>Ctrl+L</code> / <code>Cmd+L</code> — 가사 (Lyrics) 입력</li>
            <li><code>Ctrl+T</code> / <code>Cmd+T</code> — 스태프 텍스트</li>
            <li><code>Ctrl+M</code> / <code>Cmd+M</code> — 시스템 텍스트 (모든 악기에 보임)</li>
        </ul>

        <h3>재생 / 이동</h3>
        <ul>
            <li><code>Space</code> — 재생 / 정지</li>
            <li><code>Ctrl+Home</code> — 곡 처음으로</li>
            <li><code>Ctrl+End</code> — 곡 끝으로</li>
            <li><code>Ctrl+G</code> — 마디 번호로 이동 (Go to)</li>
        </ul>

        <h3>편집</h3>
        <ul>
            <li><code>Ctrl+Z</code> — Undo</li>
            <li><code>Ctrl+Shift+Z</code> 또는 <code>Ctrl+Y</code> — Redo</li>
            <li><code>Ctrl+C</code>, <code>Ctrl+V</code> — 복사 / 붙이기</li>
            <li><code>Ctrl+Shift+V</code> — Paste Special (특수 붙이기)</li>
            <li><code>Delete</code> — 선택 음표를 휴로</li>
            <li><code>Ctrl+Delete</code> — 마디 자체 삭제</li>
        </ul>

        <h3>마디 / 박자 / 조</h3>
        <ul>
            <li><code>Ctrl+B</code> — 마디 끝에 새 마디 추가</li>
            <li><code>Insert</code> — 선택 마디 앞에 새 마디 삽입</li>
            <li><code>Ctrl+Shift+B</code> — 시스템 줄바꿈 (System Break)</li>
            <li><code>Ctrl+Shift+P</code> — 페이지 줄바꿈 (Page Break)</li>
        </ul>

        <h3>선택</h3>
        <ul>
            <li><code>Ctrl+A</code> — 모두 선택</li>
            <li><code>Ctrl+Shift+End</code> — 현재 위치부터 끝까지 선택</li>
            <li><code>Ctrl+Shift+Home</code> — 현재 위치부터 처음까지 선택</li>
            <li>마디 클릭 + <code>Shift+클릭</code> — 범위 선택</li>
        </ul>

        <h3>다이나믹 / 표현</h3>
        <ul>
            <li>Properties 패널 (F8) 에서 다이나믹 (pp ~ ff) 드래그</li>
            <li><code>Ctrl+5</code> — 4분음표 길이 (음표 입력 모드 외에서)</li>
        </ul>
    </section>

    <section>
        <h2>4. Muse Hub — 음원 / 폰트 / 플러그인</h2>
        <p>
            MuseScore 4 의 가장 큰 변화 = <strong>Muse Hub</strong>. 별도 앱으로 설치하면 음원 / 폰트 / 익스텐션 무료 / 유료 다운로드.
        </p>
        <ul>
            <li><strong>Muse Sounds</strong> (무료) — 오케스트라 / 합창 / 피아노 / 기타 등 고품질 샘플. 약 5GB 다운로드.</li>
            <li><strong>Muse Strings / Brass / Woodwinds</strong> — 별도 무료 음원 패키지. 클래식 사보 시 필수.</li>
            <li><strong>유료 음원</strong> — 일부 영화 음악 / 합창 전용 / 민속 악기 패키지 ($10~30).</li>
            <li><strong>Notation Fonts</strong> — Bravura (기본), Petaluma (필기체 느낌), Leland (현대) 등.</li>
        </ul>
    </section>

    <section>
        <h2>5. MusicXML 워크플로</h2>

        <h3>MuseScore 에서 내보내기</h3>
        <ol>
            <li><strong>File</strong> → <strong>Export</strong></li>
            <li>형식: <strong>MusicXML</strong> (Compressed .mxl 또는 Uncompressed .xml)</li>
            <li>"Compressed (.mxl)" 권장 — 파일 크기 1/5 ~ 1/10</li>
            <li>저장 경로 선택</li>
        </ol>

        <h3>MuseScore 에서 가져오기</h3>
        <ol>
            <li><strong>File</strong> → <strong>Open</strong></li>
            <li>형식 필터에서 MusicXML 선택 (또는 .musicxml / .mxl 파일 직접)</li>
            <li>가져오기 옵션 다이얼로그 → 박자 / 조성 / 가사 보존</li>
        </ol>
        <p>
            MuseScore 의 MusicXML 임포트는 가장 정확하다고 평가됩니다. 시벨리우스 / 도리코 / 피날레의 .musicxml 파일을 가장 잘 읽음.
        </p>

        <h3>본 도구와 연동</h3>
        <p>
            MuseScore 에서 .musicxml 내보내기 → <a href="/tools/score-editor">사보 에디터</a> 에 업로드 → 트랜스포즈 / 조성 / 재생 → 다운로드 → MuseScore 다시 열기.
        </p>
    </section>

    <section>
        <h2>6. 한글 입력 — 가사 / 코드 / 제목</h2>
        <ul>
            <li><strong>가사 (Lyrics)</strong>: <code>Ctrl+L</code> / <code>Cmd+L</code> 후 한글 입력. 띄어쓰기는 다음 음표로. 한 음에 여러 음절은 <code>_</code> (밑줄). MuseScore 4 는 한글 가사 자동 정렬 우수.</li>
            <li><strong>제목 / 작곡가</strong>: File → Score Properties 에서 한글. 또는 첫 페이지 텍스트 직접 클릭.</li>
            <li><strong>코드 심볼</strong>: <code>Ctrl+K</code> 후 한글 코드 표기 가능 ("Cmaj7", "Dm" 등 영어 표기 권장 / 일부 한국 곡은 "도장조" 같은 표기 가능).</li>
            <li><strong>한글 폰트</strong>: Format → Style → Text Styles 에서 폰트 변경 (나눔명조 / 나눔고딕 등 한글 폰트 지정).</li>
            <li><strong>국악 정간보</strong>: MuseScore 는 5 선보 기본. 정간보는 별도 그래픽 / 텍스트로 표현. 국악원 자료 참고.</li>
        </ul>
    </section>

    <section>
        <h2>7. 시벨리우스 / 도리코 → MuseScore 마이그레이션</h2>

        <h3>시벨리우스 → MuseScore</h3>
        <ol>
            <li>시벨리우스: File → Export → MusicXML (Compressed .mxl)</li>
            <li>MuseScore: File → Open → .mxl 파일 선택</li>
            <li>가져오기 옵션 다이얼로그에서 모두 체크</li>
            <li>가져온 후 페이지 레이아웃 다시 손보기 (자동 조정 활용)</li>
        </ol>

        <h3>도리코 → MuseScore</h3>
        <ol>
            <li>도리코: File → Export → MusicXML</li>
            <li>MuseScore: File → Open → .musicxml 파일</li>
            <li>도리코의 5 모드 워크플로가 MuseScore 에서는 단일 화면으로 통합</li>
        </ol>

        <h3>왜 마이그레이션?</h3>
        <ul>
            <li><strong>비용 절약</strong> — 시벨리우스 / 도리코 구독 / 라이선스 만료 시</li>
            <li><strong>학생 / 동호회</strong> — 무료 도구로 충분</li>
            <li><strong>크로스 플랫폼</strong> — Linux 도 지원 (시벨리우스 / 도리코 X)</li>
            <li><strong>커뮤니티</strong> — MuseScore.com 에 200 만 곡 무료 공유</li>
        </ul>
    </section>

    <section>
        <h2>8. MuseScore.com — 악보 공유 플랫폼</h2>
        <p>
            <strong>musescore.com</strong> 은 MuseScore 사용자들이 악보를 업로드 / 다운로드하는 플랫폼. 200 만 곡 이상.
        </p>
        <ul>
            <li><strong>무료 다운로드</strong> — 사용자가 무료 공유한 곡은 누구나 PDF / MIDI / MuseScore 파일 다운로드</li>
            <li><strong>Pro 구독</strong> ($79/년) — 모든 곡 (저작권자 등록한 인기 곡 포함) 다운로드 무제한, 광고 X</li>
            <li><strong>한국 사용자</strong> — K-Pop / 트로트 / CCM 찬양 / 한국 동요 수많은 악보. 한국어 검색 가능.</li>
            <li><strong>업로드</strong> — 자기 곡을 업로드해 다른 사람과 공유. SNS 처럼 좋아요 / 댓글.</li>
        </ul>
    </section>

    <section>
        <h2>9. 무료 플러그인 — 강력함의 비결</h2>
        <p>
            MuseScore 의 강점 중 하나는 수백 개의 무료 플러그인. <strong>플러그인 매니저</strong> (Plugins → Manage Plugins) 에서 설치.
        </p>
        <ul>
            <li><strong>코드 차트 자동 생성</strong> — 멜로디만 입력하면 화성 분석 → 코드 자동 추가</li>
            <li><strong>한국 민요 변환</strong> — 한국 민요 채보를 다양한 키로 변환</li>
            <li><strong>합창 자동 분배</strong> — 한 줄 멜로디를 SATB 4 부 합창으로 분배</li>
            <li><strong>Tab Score</strong> — 기타 탭 자동 생성</li>
            <li><strong>국악 변환</strong> — 5 선보 → 정간보 (실험적, 일부 플러그인)</li>
        </ul>
    </section>

    <section>
        <h2>10. 한국 사용자를 위한 팁</h2>
        <ul>
            <li><strong>학교 / 학원</strong>: 모든 학생에게 무료 배포 가능. 윤리적으로도 합법적으로도 깨끗.</li>
            <li><strong>CCM / 교회 음악</strong>: 찬송가 편곡 / 합창 / 키보드 코드 차트 등 모두 무료로.</li>
            <li><strong>동호회 / 합주단</strong>: 합주 보면을 모든 단원에게 PDF 로 무료 배포. 라이선스 걱정 X.</li>
            <li><strong>독학 작곡가</strong>: 시벨리우스 / 도리코 가격이 부담이면 MuseScore 4 가 충분.</li>
            <li><strong>한국 사보 사용자 모임</strong>: <a href="/sibelius">시벨리우스 게시판</a>, <a href="/dorico">도리코 게시판</a>, <a href="/tip">강좌/팁</a> 에서 MuseScore 도 자주 다룸.</li>
        </ul>
    </section>

    <section>
        <h2>관련 가이드</h2>
        <div class="related">
            <a href="/tools/score-editor/sibelius-guide" class="related-card">🎼 시벨리우스 가이드</a>
            <a href="/tools/score-editor/dorico-guide" class="related-card">🎹 도리코 가이드</a>
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
