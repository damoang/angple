<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { getAbc } from './_lib/abc-loader';
    import { TEMPLATES, TEMPLATES_BY_CATEGORY, CATEGORIES, CATEGORY_LABEL, type Category } from './_lib/templates';
    import 'abcjs/abcjs-audio.css';

    const STORAGE_KEY = 'muzia.tool.abc-notation.v1';

    let abcText = $state(TEMPLATES[0].abc);
    let activeCategory = $state<Category>('korean');
    let scoreEl = $state<HTMLDivElement | undefined>(undefined);
    let renderTimer: ReturnType<typeof setTimeout> | null = null;
    let isPlaying = $state(false);
    let isReady = $state(false);
    let synthControl: any = null;
    let visualObj: any = null;

    onMount(async () => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) abcText = saved;
        } catch {}

        const abc = await getAbc();
        renderScore(abc);
        isReady = true;
    });

    function renderScore(abc: any) {
        if (!scoreEl) return;
        try {
            const result = abc.renderAbc(scoreEl, abcText, {
                responsive: 'resize',
                add_classes: true,
                staffwidth: 740
            });
            visualObj = result?.[0] ?? null;
        } catch (e) {
            console.error('renderAbc failed:', e);
        }
    }

    let saveTimer: ReturnType<typeof setTimeout> | null = null;

    $effect(() => {
        const text = abcText;
        if (!isReady) return;
        if (renderTimer) clearTimeout(renderTimer);
        if (saveTimer) clearTimeout(saveTimer);

        renderTimer = setTimeout(async () => {
            const abc = await getAbc();
            renderScore(abc);
        }, 250);
        saveTimer = setTimeout(() => {
            try { localStorage.setItem(STORAGE_KEY, text); } catch {}
        }, 600);
    });

    async function play() {
        if (isPlaying) return;
        const abc = await getAbc();
        if (!visualObj) renderScore(abc);
        if (!visualObj) return;

        try {
            if (synthControl?.stop) synthControl.stop();
            const SynthCtrl: any = (abc as any).synth?.SynthController;
            const create: any = (abc as any).synth?.CreateSynth;
            if (!SynthCtrl || !create) {
                alert('이 브라우저는 abcjs synth 를 지원하지 않습니다.');
                return;
            }
            synthControl = new SynthCtrl();
            synthControl.disable(true);
            await synthControl.load(scoreEl, undefined, {
                displayPlay: false,
                displayProgress: false,
                displayRestart: false
            });
            const synth = new create();
            await synth.init({
                visualObj,
                options: {
                    soundFontUrl: 'https://paulrosen.github.io/midi-js-soundfonts/abcjs/'
                }
            });
            await synthControl.setTune(visualObj, false, {});
            isPlaying = true;
            await synthControl.play();
        } catch (e) {
            console.error('play failed:', e);
            isPlaying = false;
        }
    }

    function stop() {
        try { synthControl?.pause(); } catch {}
        isPlaying = false;
    }

    function loadTemplate(idx: number) {
        abcText = TEMPLATES[idx].abc;
    }

    function downloadAbc() {
        const blob = new Blob([abcText], { type: 'text/plain;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `score-${Date.now()}.abc`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    function downloadSvg() {
        const svg = scoreEl?.querySelector('svg');
        if (!svg) return;
        const xml = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([xml], { type: 'image/svg+xml' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `score-${Date.now()}.svg`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    onDestroy(() => {
        try { synthControl?.stop?.(); } catch {}
        if (renderTimer) clearTimeout(renderTimer);
        if (saveTimer) clearTimeout(saveTimer);
    });
</script>

<svelte:head>
    <title>ABC 표기법 → 악보 — 텍스트로 작곡하는 무료 도구 | 뮤지아</title>
    <meta
        name="description"
        content="ABC 표기법(텍스트) 입력 → 오선지 악보 실시간 렌더 + 음원 재생. 한국 민요 / 클래식 / 블루스 5 가지 예시. .abc / .svg 다운로드. 작곡·교육·공유에 활용."
    />
    <meta property="og:title" content="뮤지아 ABC 표기법 에디터" />
</svelte:head>

<div class="page">
    <nav class="crumb"><a href="/tools">← 도구 모음</a></nav>

    <header class="head">
        <h1>ABC 표기법 → 악보</h1>
        <p>
            <strong>ABC 표기법</strong>은 텍스트로 음악을 표현하는 표준 형식. 입력 즉시 오선지로 렌더 + 재생.
            저장 / 인쇄 / 공유 가능.
        </p>
    </header>

    <div class="categories">
        <span class="label">카테고리:</span>
        {#each CATEGORIES as c}
            {@const count = TEMPLATES_BY_CATEGORY[c].length}
            <button class="chip" class:on={activeCategory === c} onclick={() => activeCategory = c}>
                {CATEGORY_LABEL[c]} <span class="chip-count">{count}</span>
            </button>
        {/each}
    </div>
    <div class="templates">
        {#each TEMPLATES_BY_CATEGORY[activeCategory] as t}
            {@const idx = TEMPLATES.indexOf(t)}
            <button class="tpl" onclick={() => loadTemplate(idx)} title={t.desc}>{t.name}</button>
        {/each}
    </div>

    <div class="editor">
        <div class="left">
            <textarea
                bind:value={abcText}
                spellcheck="false"
                aria-label="ABC notation text"
            ></textarea>
        </div>
        <div class="right">
            <div bind:this={scoreEl} class="score-box"></div>
        </div>
    </div>

    <div class="controls">
        <button class="primary" onclick={isPlaying ? stop : play}>
            {isPlaying ? '■ 정지' : '▶ 재생'}
        </button>
        <button class="ghost" onclick={downloadAbc}>.abc 다운로드</button>
        <button class="ghost" onclick={downloadSvg}>.svg 다운로드</button>
    </div>

    <section class="info">
        <h2>ABC 표기법 빠른 안내</h2>
        <table>
            <tbody>
                <tr><td><code>X:1</code></td><td>곡 번호</td></tr>
                <tr><td><code>T:제목</code></td><td>곡 제목</td></tr>
                <tr><td><code>M:4/4</code></td><td>박자</td></tr>
                <tr><td><code>L:1/4</code></td><td>기본 음표 길이 (4분음표)</td></tr>
                <tr><td><code>Q:1/4=120</code></td><td>BPM</td></tr>
                <tr><td><code>K:G</code></td><td>조성 (G 메이저)</td></tr>
                <tr><td><code>C D E F G A B c</code></td><td>도-시 (대문자 = 4옥타브, 소문자 = 5옥타브)</td></tr>
                <tr><td><code>^F</code> / <code>_B</code></td><td>샵 / 플랫</td></tr>
                <tr><td><code>C2 C/2</code></td><td>2배 길이 / 절반 길이</td></tr>
                <tr><td><code>|: ... :|</code></td><td>반복 구간</td></tr>
            </tbody>
        </table>
        <p class="hint">ABC 표기법은 1991 년 Chris Walshaw 가 만든 표준. 텍스트만으로 악보 공유 가능 — 이메일·게시판·메모장 어디서든.</p>
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
        margin: 0 0 18px;
        font-size: 14px;
        line-height: 1.6;
    }
    .categories {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 10px;
    }
    .chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 999px;
        font-size: 12px;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.12s;
    }
    .chip:hover { border-color: #6366f1; }
    .chip.on { background: #6366f1; color: #fff; border-color: #6366f1; }
    .chip-count {
        font-size: 10px;
        font-weight: 700;
        background: rgba(0,0,0,0.08);
        padding: 1px 5px;
        border-radius: 999px;
    }
    .chip.on .chip-count { background: rgba(255,255,255,0.25); }
    .templates {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
        margin-bottom: 14px;
    }
    .label {
        font-size: 12px;
        color: #6b7280;
        font-weight: 600;
    }
    .tpl {
        padding: 6px 12px;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 999px;
        font-size: 12px;
        cursor: pointer;
        font-family: inherit;
    }
    .tpl:hover {
        background: #eef2ff;
        border-color: #6366f1;
    }
    .editor {
        display: grid;
        grid-template-columns: 1fr 1.4fr;
        gap: 12px;
    }
    @media (max-width: 900px) {
        .editor {
            grid-template-columns: 1fr;
        }
    }
    .left textarea {
        width: 100%;
        min-height: 360px;
        padding: 14px;
        font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
        font-size: 13px;
        line-height: 1.6;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        resize: vertical;
        background: #fafafa;
    }
    .left textarea:focus {
        outline: none;
        border-color: #6366f1;
        background: #fff;
    }
    .right .score-box {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        padding: 12px;
        min-height: 360px;
        overflow-x: auto;
    }
    .controls {
        display: flex;
        gap: 10px;
        margin-top: 14px;
        flex-wrap: wrap;
    }
    .primary {
        padding: 10px 24px;
        background: #6366f1;
        color: #fff;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
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
    .info table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
    }
    .info td {
        padding: 6px 10px;
        border-bottom: 1px solid #f3f4f6;
    }
    .info td:first-child {
        width: 130px;
    }
    .info code {
        background: #eef2ff;
        color: #4f46e5;
        padding: 1px 6px;
        border-radius: 4px;
        font-size: 12px;
    }
    .info .hint {
        margin: 14px 0 0;
        font-size: 12px;
        color: #9ca3af;
    }
</style>
