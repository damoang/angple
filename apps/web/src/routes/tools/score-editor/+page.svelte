<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { getOSMD, readMxlOrXml } from './_lib/osmd-loader';
    import {
        parseXml,
        serialize,
        transposeAll,
        changeKeyAll,
        downloadXml,
        KEY_OPTIONS
    } from './_lib/musicxml-edit';

    let osmdContainer = $state<HTMLDivElement | undefined>(undefined);
    let fileName = $state<string>('');
    let xmlText = $state<string>('');
    let osmdInstance: any = null;
    let loading = $state(false);
    let error = $state<string | null>(null);
    let transposeAmount = $state(0);
    let keyChoice = $state('');
    let isPlaying = $state(false);

    async function handleFile(file: File) {
        loading = true;
        error = null;
        try {
            const text = await readMxlOrXml(file);
            fileName = file.name;
            xmlText = text;
            await render(text);
        } catch (e: any) {
            error = `파일 읽기 실패: ${e?.message || e}`;
        } finally {
            loading = false;
        }
    }

    function onPick(e: Event) {
        const input = e.target as HTMLInputElement;
        const f = input.files?.[0];
        if (f) handleFile(f);
    }

    function onDrop(e: DragEvent) {
        e.preventDefault();
        const f = e.dataTransfer?.files?.[0];
        if (f) handleFile(f);
    }

    async function render(text: string) {
        const osmd = await getOSMD();
        if (!osmdContainer) return;
        if (!osmdInstance) {
            osmdInstance = new osmd.OpenSheetMusicDisplay(osmdContainer, {
                autoResize: true,
                drawTitle: true,
                drawComposer: true,
                drawingParameters: 'compact'
            });
        }
        await osmdInstance.load(text);
        osmdInstance.render();
    }

    async function applyTranspose() {
        if (!xmlText || transposeAmount === 0) return;
        const doc = parseXml(xmlText);
        transposeAll(doc, transposeAmount);
        xmlText = serialize(doc);
        transposeAmount = 0;
        await render(xmlText);
    }

    async function applyKeyChange() {
        if (!xmlText || !keyChoice) return;
        const doc = parseXml(xmlText);
        changeKeyAll(doc, keyChoice);
        xmlText = serialize(doc);
        await render(xmlText);
    }

    async function play() {
        if (!xmlText || isPlaying) return;
        try {
            const Tone = await import('tone');
            await Tone.start();

            const doc = parseXml(xmlText);
            const synth = new Tone.PolySynth(Tone.Synth).toDestination();
            synth.volume.value = -8;

            const divisionsEl = doc.querySelector('divisions');
            const divisions = divisionsEl ? parseInt(divisionsEl.textContent || '4', 10) : 4;

            const tempoEl = doc.querySelector('sound[tempo]');
            const bpm = tempoEl ? parseFloat(tempoEl.getAttribute('tempo') || '120') : 120;
            const secPerDivision = 60 / bpm / divisions;

            isPlaying = true;
            const start = Tone.now() + 0.05;

            const measures = Array.from(doc.querySelectorAll('measure'));
            let cursor = 0;
            for (const m of measures) {
                const notes = Array.from(m.querySelectorAll('note'));
                let measureCursor = cursor;
                for (const n of notes) {
                    const isChord = n.querySelector('chord') !== null;
                    const dur = parseInt(n.querySelector('duration')?.textContent || '0', 10);
                    const isRest = n.querySelector('rest') !== null;

                    if (!isRest) {
                        const step = n.querySelector('step')?.textContent || 'C';
                        const oct = parseInt(n.querySelector('octave')?.textContent || '4', 10);
                        const alter = parseInt(n.querySelector('alter')?.textContent || '0', 10);
                        const noteName = step + (alter === 1 ? '#' : alter === -1 ? 'b' : '') + oct;
                        const startAt = start + (isChord ? measureCursor - dur * secPerDivision : measureCursor) * 1;
                        const len = dur * secPerDivision;
                        synth.triggerAttackRelease(noteName, Math.max(0.05, len * 0.95), startAt);
                    }
                    if (!isChord) {
                        measureCursor += dur * secPerDivision;
                    }
                }
                cursor = measureCursor;
            }
            setTimeout(() => {
                isPlaying = false;
                synth.dispose();
            }, (cursor + 0.5) * 1000);
        } catch (e) {
            console.error('play error:', e);
            isPlaying = false;
        }
    }

    function download() {
        if (!xmlText) return;
        const doc = parseXml(xmlText);
        downloadXml(doc, fileName.replace(/\.(musicxml|xml|mxl)$/i, '') + '-edited.musicxml');
    }

    onDestroy(() => {
        if (osmdInstance?.clear) osmdInstance.clear();
    });
</script>

<svelte:head>
    <title>MusicXML 사보 에디터 — 시벨리우스 / 피날레 / 도리코 호환 | 뮤지아</title>
    <meta
        name="description"
        content="MusicXML / .mxl 파일 업로드 → 오선지 렌더 + 트랜스포즈(±12반음) + 조성 변경 + 재생 + 수정본 다운로드. 시벨리우스 / 피날레 / 도리코 모두 호환."
    />
    <meta property="og:title" content="뮤지아 MusicXML 사보 에디터" />
</svelte:head>

<div class="page">
    <nav class="crumb"><a href="/tools">← 도구 모음</a></nav>

    <header class="head">
        <h1>MusicXML 사보 에디터</h1>
        <p>
            시벨리우스 / 피날레 / 도리코에서 내보낸 <code>.musicxml</code> 또는 <code>.mxl</code> 업로드 →
            트랜스포즈 / 조성 변경 / 재생 / 수정본 다운로드.
        </p>
    </header>

    {#if !xmlText}
        <div
            class="drop-zone"
            ondrop={onDrop}
            ondragover={(e) => e.preventDefault()}
            role="button"
            tabindex="0"
        >
            <div class="drop-icon">📜</div>
            <h2>파일을 끌어다 놓거나 클릭하여 선택</h2>
            <p>MusicXML (.xml / .musicxml) · 압축본 .mxl 지원 · 최대 10MB</p>
            <label class="primary">
                파일 선택
                <input type="file" accept=".xml,.musicxml,.mxl" onchange={onPick} hidden />
            </label>
            <p class="hint">
                💡 시벨리우스 / 피날레 / 도리코에서 <strong>"MusicXML 내보내기"</strong> 옵션으로 저장한 파일을 사용하세요.
            </p>
        </div>
    {:else}
        <div class="toolbar">
            <span class="filename">📜 {fileName}</span>
            <button class="ghost" onclick={() => { xmlText = ''; fileName = ''; }}>새 파일</button>
        </div>

        <div bind:this={osmdContainer} class="score-area"></div>

        <div class="controls">
            <div class="ctl-group">
                <label>
                    트랜스포즈 (반음)
                    <input type="number" min="-12" max="12" bind:value={transposeAmount} />
                </label>
                <button class="ghost" onclick={applyTranspose} disabled={transposeAmount === 0}>적용</button>
            </div>

            <div class="ctl-group">
                <label>
                    조성 변경
                    <select bind:value={keyChoice}>
                        <option value="">선택...</option>
                        {#each KEY_OPTIONS as k}
                            <option value={k}>{k.replace('-', ' ')}</option>
                        {/each}
                    </select>
                </label>
                <button class="ghost" onclick={applyKeyChange} disabled={!keyChoice}>적용</button>
            </div>

            <button class="primary" onclick={play} disabled={isPlaying}>
                {isPlaying ? '재생 중...' : '▶ 재생'}
            </button>
            <button class="primary" onclick={download}>다운로드 (.musicxml)</button>
        </div>
    {/if}

    {#if loading}
        <div class="loading">불러오는 중...</div>
    {/if}
    {#if error}
        <div class="err">{error}</div>
    {/if}

    <section class="info">
        <h2>이 도구로 할 수 있는 것</h2>
        <ul>
            <li><strong>호환성</strong> — 시벨리우스 / 피날레 / 도리코 / MuseScore 모두 MusicXML 표준 지원.</li>
            <li><strong>트랜스포즈</strong> — 전체 악보를 ±12 반음 이동. 이조 악기 / 보컬 키 조정에 활용.</li>
            <li><strong>조성 변경</strong> — 악곡의 조성 표시(<code>&lt;key&gt;</code>)만 갱신. 음 자체는 트랜스포즈로 별도 조정.</li>
            <li><strong>재생</strong> — 브라우저 내장 신디사이저 (Tone.js) 로 음원 미리듣기.</li>
            <li><strong>다운로드</strong> — 수정본을 다시 <code>.musicxml</code> 로 저장 → 사보 프로그램에서 다시 열기 가능.</li>
        </ul>

        <h3 style="font-size:15px;margin-top:24px;">📝 사보 프로그램별 MusicXML 내보내기</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;">
            <thead>
                <tr style="border-bottom:1px solid #e5e7eb;"><th style="text-align:left;padding:8px;">프로그램</th><th style="text-align:left;padding:8px;">내보내기 방법</th></tr>
            </thead>
            <tbody>
                <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px;font-weight:600;">시벨리우스 (Sibelius)</td><td style="padding:8px;">파일 → 내보내기 → MusicXML (Compressed .mxl 권장)</td></tr>
                <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px;font-weight:600;">피날레 (Finale)</td><td style="padding:8px;">파일 → MusicXML 내보내기 (XML 또는 Compressed)</td></tr>
                <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px;font-weight:600;">도리코 (Dorico)</td><td style="padding:8px;">파일 → 내보내기 → MusicXML</td></tr>
                <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px;font-weight:600;">뮤즈스코어 (MuseScore)</td><td style="padding:8px;">파일 → 다른 이름으로 저장 → MusicXML 형식</td></tr>
                <tr><td style="padding:8px;font-weight:600;">노션 (Notion)</td><td style="padding:8px;">파일 → 내보내기 → XML</td></tr>
            </tbody>
        </table>

        <h3 style="font-size:15px;margin-top:24px;">🎼 트랜스포즈 활용 팁</h3>
        <ul>
            <li><strong>이조 악기 보면 만들기</strong> — B♭ 클라리넷용 보면은 +2 반음 (장2도 위) 트랜스포즈</li>
            <li><strong>호른 (F)</strong> — +7 반음 (완전5도 위) 으로 이조</li>
            <li><strong>알토 색소폰 (E♭)</strong> — +9 반음 (장6도 위)</li>
            <li><strong>테너 색소폰 (B♭)</strong> — +14 반음 (장9도 위, 한 옥타브 + 2반음)</li>
            <li><strong>보컬 키 변경</strong> — 가수의 음역에 맞춰 ±2~5 반음 시도. 너무 큰 트랜스포즈는 반주에 부담.</li>
            <li><strong>코드 차트만 키 변경</strong> — 트랜스포즈 적용 후 조성 변경 옵션을 사용해 조표 갱신 (<code>&lt;key&gt;</code>의 <code>fifths</code>).</li>
        </ul>

        <h3 style="font-size:15px;margin-top:24px;">⚙️ MusicXML 의 핵심 요소</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tbody>
                <tr><td style="padding:6px;width:40%;"><code>&lt;key&gt;&lt;fifths&gt;</code></td><td style="padding:6px;">조표 (♯/♭ 개수, 양수=♯, 음수=♭)</td></tr>
                <tr><td style="padding:6px;"><code>&lt;time&gt;</code></td><td style="padding:6px;">박자표 (beats / beat-type)</td></tr>
                <tr><td style="padding:6px;"><code>&lt;divisions&gt;</code></td><td style="padding:6px;">4분음표 1박을 몇 단위로 나누는지 (보통 4 또는 16)</td></tr>
                <tr><td style="padding:6px;"><code>&lt;note&gt;&lt;pitch&gt;</code></td><td style="padding:6px;">음표 정보 (step / octave / alter)</td></tr>
                <tr><td style="padding:6px;"><code>&lt;duration&gt;</code></td><td style="padding:6px;">음표 길이 (divisions 단위)</td></tr>
                <tr><td style="padding:6px;"><code>&lt;tempo&gt;</code></td><td style="padding:6px;">BPM (sound 요소 안에 숨겨진 경우 많음)</td></tr>
            </tbody>
        </table>

        <p class="hint">
            ⚠️ 1차 출시 (MVP) 는 <strong>읽기 / 트랜스포즈 / 조성 / 재생 / 다운로드</strong> 까지 지원.
            노트 직접 편집(피치 변경 / 추가 / 삭제) 은 다음 단계에서 추가 예정.
        </p>
    </section>
</div>

<style>
    .page {
        max-width: 1200px;
        margin: 0 auto;
        padding: 24px 16px 64px;
    }
    .crumb {
        font-size: 13px;
        margin-bottom: 16px;
    }
    .crumb a {
        color: #6366f1;
        text-decoration: none;
    }
    .head h1 {
        font-size: 28px;
        margin: 4px 0 6px;
        font-weight: 800;
    }
    .head p {
        color: #6b7280;
        margin: 0 0 24px;
        font-size: 14px;
        line-height: 1.7;
    }
    .head code {
        background: #eef2ff;
        color: #4f46e5;
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 12px;
    }
    .drop-zone {
        text-align: center;
        padding: 60px 24px;
        background: #fff;
        border: 2px dashed #c7d2fe;
        border-radius: 14px;
    }
    .drop-icon {
        font-size: 56px;
        line-height: 1;
        margin-bottom: 12px;
    }
    .drop-zone h2 {
        font-size: 18px;
        margin: 0 0 8px;
    }
    .drop-zone p {
        margin: 0 0 18px;
        color: #6b7280;
        font-size: 14px;
    }
    .primary {
        display: inline-block;
        padding: 12px 28px;
        background: #6366f1;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
    }
    .primary:disabled {
        opacity: 0.5;
        cursor: default;
    }
    .ghost {
        padding: 9px 16px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        font-size: 13px;
        cursor: pointer;
        font-family: inherit;
    }
    .hint {
        margin-top: 16px !important;
        font-size: 12px;
        color: #9ca3af;
    }
    .toolbar {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 14px;
    }
    .filename {
        font-size: 14px;
        font-weight: 600;
        color: #4b5563;
        flex: 1;
    }
    .score-area {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 16px;
        min-height: 400px;
        overflow-x: auto;
    }
    .controls {
        display: flex;
        gap: 10px;
        margin-top: 14px;
        flex-wrap: wrap;
        align-items: center;
        padding: 14px;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
    }
    .ctl-group {
        display: flex;
        align-items: center;
        gap: 6px;
    }
    .ctl-group label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: #6b7280;
    }
    .ctl-group input,
    .ctl-group select {
        padding: 6px 10px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        font-family: inherit;
    }
    .ctl-group input[type='number'] {
        width: 70px;
    }
    .loading {
        text-align: center;
        padding: 40px;
        color: #6b7280;
    }
    .err {
        margin: 14px 0;
        padding: 12px;
        background: #fef2f2;
        border: 1px solid #fecaca;
        color: #b91c1c;
        border-radius: 8px;
        font-size: 14px;
    }
    .info {
        margin-top: 36px;
        padding: 20px;
        background: #f9fafb;
        border-radius: 10px;
    }
    .info h2 {
        font-size: 16px;
        margin: 0 0 12px;
    }
    .info ul {
        margin: 0;
        padding-left: 18px;
        color: #4b5563;
        line-height: 1.8;
        font-size: 14px;
    }
    .info code {
        background: #eef2ff;
        color: #4f46e5;
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 12px;
    }
</style>
