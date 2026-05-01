<script lang="ts">
    import {
        ALL_QUESTIONS,
        QUESTIONS_BY_CATEGORY,
        CATEGORIES,
        CATEGORY_LABEL,
        CATEGORY_DESC,
        type Category,
        type Question
    } from './_lib/questions';

    type Mode = 'mixed' | Category;

    const STORAGE_KEY = 'muzia.tool.music-theory.v2';
    const QUIZ_SIZE = 10;

    interface Progress {
        attempts: Record<Category, { correct: number; total: number }>;
    }

    function loadProgress(): Progress {
        if (typeof localStorage === 'undefined') return blank();
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return blank();
            return JSON.parse(raw) as Progress;
        } catch {
            return blank();
        }
    }
    function blank(): Progress {
        const a = {} as Progress['attempts'];
        for (const c of CATEGORIES) a[c] = { correct: 0, total: 0 };
        return { attempts: a };
    }
    function saveProgress(p: Progress) {
        if (typeof localStorage === 'undefined') return;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
    }

    function shuffle<T>(arr: T[]): T[] {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    let mode = $state<Mode>('mixed');
    let progress = $state<Progress>(loadProgress());
    let questions = $state<Question[]>(shuffle(ALL_QUESTIONS).slice(0, QUIZ_SIZE));
    let idx = $state(0);
    let selected = $state<number | null>(null);
    let score = $state(0);
    let finished = $state(false);
    let started = $state(false);

    const current = $derived(questions[idx]);

    function startMode(m: Mode) {
        mode = m;
        const pool = m === 'mixed' ? ALL_QUESTIONS : QUESTIONS_BY_CATEGORY[m];
        questions = shuffle(pool).slice(0, Math.min(QUIZ_SIZE, pool.length));
        idx = 0;
        selected = null;
        score = 0;
        finished = false;
        started = true;
    }

    function pick(i: number) {
        if (selected !== null) return;
        selected = i;
        const correct = i === current.answer;
        if (correct) score++;
        const cat = current.category;
        progress.attempts[cat].total++;
        if (correct) progress.attempts[cat].correct++;
        saveProgress(progress);
    }

    function next() {
        if (idx + 1 >= questions.length) {
            finished = true;
            return;
        }
        idx++;
        selected = null;
    }

    function backToHome() {
        started = false;
        finished = false;
    }

    function clearProgress() {
        if (!confirm('모든 진도 기록을 초기화할까요?')) return;
        progress = blank();
        saveProgress(progress);
    }

    function categoryRate(cat: Category): number {
        const a = progress.attempts[cat];
        if (a.total === 0) return -1;
        return Math.round((a.correct / a.total) * 100);
    }

    function isWeak(cat: Category): boolean {
        const a = progress.attempts[cat];
        return a.total >= 3 && a.correct / a.total < 0.6;
    }

    const totalAttempts = $derived(
        CATEGORIES.reduce((s, c) => s + progress.attempts[c].total, 0)
    );
    const totalCorrect = $derived(
        CATEGORIES.reduce((s, c) => s + progress.attempts[c].correct, 0)
    );
</script>

<svelte:head>
    <title>음악 이론 퀴즈 — 음정 / 코드 / 조성 / 진행 / 리듬 / 한국 음악 100+ | 뮤지아</title>
    <meta
        name="description"
        content="100+ 문항 음악 이론 퀴즈 — 음정 (장2도 ~ 증4도), 코드 (트라이어드 / 7th / 텐션 / sus), 조성 (5도권 / 평행조 / 화성·선율 단음계), 진행 (I-V-vi-IV / ii-V-I / 카논 / 12-bar blues), 리듬 (점음표 / 셋잇단 / 폴리리듬), 한국 음악 (평조 / 계면조 / 진양조). 카테고리별 마스터 모드 + 진도 자동 저장 + 약점 분석."
    />
    <meta property="og:title" content="뮤지아 음악 이론 퀴즈 100+" />
</svelte:head>

<div class="page">
    <nav class="crumb"><a href="/tools">← 도구 모음</a></nav>

    <header class="head">
        <h1>음악 이론 퀴즈</h1>
        <p>음정 · 코드 · 조성 · 진행 · 리듬 · 한국 음악 — <strong>{ALL_QUESTIONS.length}+ 문항</strong>. 카테고리별 마스터 + 진도 저장 + 약점 분석.</p>
    </header>

    {#if !started}
        <section class="intro">
            <div class="modes">
                <h2>모드 선택</h2>
                <button class="mode-card mixed" onclick={() => startMode('mixed')}>
                    <div class="mode-title">🎲 종합 (랜덤)</div>
                    <div class="mode-desc">전체 카테고리에서 무작위 {QUIZ_SIZE} 문항</div>
                    <div class="mode-meta">총 {ALL_QUESTIONS.length} 문항 풀</div>
                </button>
                {#each CATEGORIES as cat}
                    {@const count = QUESTIONS_BY_CATEGORY[cat].length}
                    {@const rate = categoryRate(cat)}
                    <button class="mode-card" class:weak={isWeak(cat)} onclick={() => startMode(cat)}>
                        <div class="mode-title">{CATEGORY_LABEL[cat]} <span class="badge">{count}</span></div>
                        <div class="mode-desc">{CATEGORY_DESC[cat]}</div>
                        <div class="mode-meta">
                            {#if rate >= 0}
                                정답률 {rate}% ({progress.attempts[cat].correct}/{progress.attempts[cat].total})
                                {#if isWeak(cat)}<span class="weak-tag">약점</span>{/if}
                            {:else}
                                미응시
                            {/if}
                        </div>
                    </button>
                {/each}
            </div>

            {#if totalAttempts > 0}
                <div class="overall">
                    <div class="overall-stat">
                        전체 진도: <strong>{totalCorrect} / {totalAttempts}</strong>
                        ({Math.round((totalCorrect / totalAttempts) * 100)}%)
                    </div>
                    <button class="reset" onclick={clearProgress}>진도 초기화</button>
                </div>
            {/if}

            <div class="info">
                <h3>이 퀴즈로 마스터하는 것</h3>
                <ul>
                    <li><strong>음정</strong> 20 — 완전/장/단/증/감, 옥타브, 협화/불협화, enharmonic</li>
                    <li><strong>코드</strong> 30 — 트라이어드, 7th, 9/11/13, sus, 전위, 종지</li>
                    <li><strong>조성</strong> 20 — 24 조성 식별, 5도권, 평행조/관계조, 화성·선율 단음계</li>
                    <li><strong>진행</strong> 20 — I-V-vi-IV / ii-V-I / 카논 / 50년대 / 안달루시안 / 블루스 / EDM / 트로트 / Rhythm Changes</li>
                    <li><strong>리듬</strong> 10 — 박자표, 점음표, 잇단음표, 스윙, 폴리리듬, Auftakt</li>
                    <li><strong>한국 음악</strong> 5 — 평조 / 계면조 / 진양조 / 단소 / 가야금</li>
                </ul>
            </div>
        </section>
    {:else if finished}
        <div class="result">
            <div class="score-num">{score} / {questions.length}</div>
            <div class="score-msg">
                {#if score === questions.length}
                    완벽! 음악 이론 마스터 🎓
                {:else if score >= 8}
                    훌륭합니다 — 탄탄한 이론 기반.
                {:else if score >= 6}
                    좋아요 — 약점 카테고리 복습 추천.
                {:else if score >= 4}
                    기본 OK, 코드 / 조성 영역 더 풀어보세요.
                {:else}
                    이제 시작! 음정 + 메이저 스케일부터.
                {/if}
            </div>
            <div class="result-actions">
                <button class="primary" onclick={() => startMode(mode)}>다시 풀기 ({mode === 'mixed' ? '종합' : CATEGORY_LABEL[mode]})</button>
                <button class="ghost" onclick={backToHome}>모드 변경</button>
            </div>
        </div>
    {:else if current}
        <div class="quiz">
            <div class="progress-bar">
                <div class="progress-info">
                    {idx + 1} / {questions.length} · <strong>{CATEGORY_LABEL[current.category]}</strong>
                    {#if current.difficulty}
                        · 난이도 {'★'.repeat(current.difficulty)}
                    {/if}
                </div>
                <button class="back" onclick={backToHome}>← 모드</button>
            </div>
            <h2 class="question">{current.q}</h2>
            <div class="choices">
                {#each current.choices as choice, i}
                    <button
                        class="choice"
                        class:correct={selected !== null && i === current.answer}
                        class:wrong={selected === i && i !== current.answer}
                        disabled={selected !== null}
                        onclick={() => pick(i)}
                    >
                        <span class="num">{['A', 'B', 'C', 'D'][i]}</span>
                        {choice}
                    </button>
                {/each}
            </div>

            {#if selected !== null}
                <div class="explain">
                    <strong>{selected === current.answer ? '✓ 정답!' : '✗ 오답'}</strong> — {current.explain}
                </div>
                <button class="primary" onclick={next}>
                    {idx + 1 >= questions.length ? '결과 보기' : '다음 문제 →'}
                </button>
            {/if}
        </div>
    {/if}
</div>

<style>
    .page { max-width: 720px; margin: 0 auto; padding: 24px 16px 64px; }
    .crumb { font-size: 13px; margin-bottom: 16px; }
    .crumb a { color: #6366f1; text-decoration: none; }
    .head h1 { font-size: 28px; margin: 4px 0 6px; font-weight: 800; }
    .head p { color: #6b7280; margin: 0 0 20px; font-size: 14px; line-height: 1.6; }
    .modes h2 { font-size: 16px; margin: 0 0 12px; color: #4b5563; }
    .modes { display: grid; gap: 10px; grid-template-columns: 1fr 1fr; }
    .modes h2 { grid-column: 1 / -1; }
    @media (max-width: 600px) { .modes { grid-template-columns: 1fr; } }
    .mode-card {
        text-align: left; padding: 14px 16px;
        background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
        cursor: pointer; font-family: inherit; transition: all 0.12s;
    }
    .mode-card:hover { border-color: #6366f1; transform: translateY(-1px); }
    .mode-card.mixed { background: linear-gradient(135deg, #eef2ff, #f5f3ff); border-color: #c7d2fe; grid-column: 1 / -1; }
    .mode-card.weak { border-color: #fbbf24; background: #fffbeb; }
    .mode-title { font-weight: 700; font-size: 15px; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
    .badge { font-size: 11px; font-weight: 600; background: #6366f1; color: #fff; padding: 1px 7px; border-radius: 999px; }
    .mode-desc { font-size: 12px; color: #6b7280; line-height: 1.5; margin-bottom: 6px; }
    .mode-meta { font-size: 11px; color: #9ca3af; }
    .weak-tag { background: #fbbf24; color: #78350f; padding: 1px 6px; border-radius: 4px; font-weight: 700; margin-left: 6px; }
    .overall { margin-top: 18px; padding: 14px 16px; background: #f9fafb; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
    .overall-stat { font-size: 13px; color: #4b5563; }
    .reset { background: transparent; border: 1px solid #e5e7eb; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-family: inherit; color: #6b7280; }
    .info { margin-top: 28px; padding: 18px; background: #f9fafb; border-radius: 10px; }
    .info h3 { font-size: 14px; margin: 0 0 10px; }
    .info ul { margin: 0; padding-left: 18px; color: #4b5563; line-height: 1.8; font-size: 13px; }
    .quiz { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 28px; }
    .progress-bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .progress-info { font-size: 12px; color: #6b7280; letter-spacing: 0.5px; font-weight: 600; }
    .back { font-size: 11px; background: transparent; border: none; color: #6366f1; cursor: pointer; font-family: inherit; }
    .question { font-size: 22px; margin: 0 0 24px; line-height: 1.5; font-weight: 700; }
    .choices { display: grid; gap: 10px; }
    .choice { display: flex; align-items: center; gap: 14px; padding: 14px 18px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; font-size: 15px; text-align: left; cursor: pointer; font-family: inherit; transition: all 0.12s; }
    .choice:not(:disabled):hover { background: #eef2ff; border-color: #6366f1; }
    .choice .num { display: inline-flex; width: 26px; height: 26px; align-items: center; justify-content: center; background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 12px; font-weight: 700; color: #6b7280; }
    .choice.correct { background: #ecfdf5; border-color: #10b981; color: #047857; }
    .choice.correct .num { background: #10b981; color: #fff; border-color: #10b981; }
    .choice.wrong { background: #fef2f2; border-color: #ef4444; color: #b91c1c; }
    .choice.wrong .num { background: #ef4444; color: #fff; border-color: #ef4444; }
    .choice:disabled { cursor: default; }
    .explain { margin-top: 18px; padding: 14px 16px; background: #f5f3ff; border-radius: 10px; font-size: 14px; line-height: 1.6; color: #4c1d95; }
    .primary { margin-top: 16px; width: 100%; padding: 14px; background: #6366f1; color: #fff; border: none; border-radius: 10px; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; }
    .primary:hover { background: #4f46e5; }
    .ghost { padding: 12px 18px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; cursor: pointer; font-family: inherit; font-size: 13px; }
    .result { text-align: center; background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 48px 28px; }
    .score-num { font-size: 64px; font-weight: 800; color: #6366f1; line-height: 1; font-variant-numeric: tabular-nums; }
    .score-msg { font-size: 17px; margin: 14px 0 24px; color: #374151; }
    .result-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
</style>
