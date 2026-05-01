<script lang="ts">
    import { getLang, t } from '$lib/i18n/store.svelte';

    const lang = $derived(getLang());
    const m = $derived(t());

    const ICONS: Record<string, string> = {
        metronome: '🎵', tuner: '🎸', 'bpm-tap': '⏱️', 'chord-progression': '🎹',
        'music-theory': '📚', 'piano-roll': '🎹', 'abc-notation': '🎼',
        'score-editor': '📜', 'midi-sequencer': '🎚️',
        'scale-dictionary': '📖', 'chord-dictionary': '📚', 'interval-trainer': '👂'
    };

    const tools = $derived([
        { slug: 'metronome', icon: ICONS.metronome, ...m.cards.metronome },
        { slug: 'tuner', icon: ICONS.tuner, ...m.cards.tuner },
        { slug: 'bpm-tap', icon: ICONS['bpm-tap'], ...m.cards.bpmTap },
        { slug: 'chord-progression', icon: ICONS['chord-progression'], ...m.cards.chordProgression },
        { slug: 'music-theory', icon: ICONS['music-theory'], ...m.cards.musicTheory },
        { slug: 'piano-roll', icon: ICONS['piano-roll'], ...m.cards.pianoRoll },
        { slug: 'abc-notation', icon: ICONS['abc-notation'], ...m.cards.abcNotation },
        { slug: 'score-editor', icon: ICONS['score-editor'], ...m.cards.scoreEditor },
        { slug: 'midi-sequencer', icon: ICONS['midi-sequencer'], ...m.cards.midiSequencer },
        { slug: 'scale-dictionary', icon: ICONS['scale-dictionary'], ...m.cards.scaleDictionary },
        { slug: 'chord-dictionary', icon: ICONS['chord-dictionary'], ...m.cards.chordDictionary },
        { slug: 'interval-trainer', icon: ICONS['interval-trainer'], ...m.cards.intervalTrainer }
    ]);
</script>

<svelte:head>
    {#if lang === 'en'}
        <title>Music Tools — Metronome · Tuner · Piano Roll · Notation · MIDI | Muzia</title>
        <meta
            name="description"
            content="Muzia Music Tools — 9 free browser tools for musicians: metronome, chromatic tuner, BPM tap, chord progressions (32+ across 10 genres), 105 theory quiz questions, piano roll, ABC notation (51 templates), MusicXML editor (Sibelius/Finale/Dorico compatible), MIDI sequencer."
        />
        <meta property="og:title" content="Muzia Music Tools" />
        <meta property="og:description" content="9 free browser music tools for composition, arranging, notation, practice, and learning." />
    {:else}
        <title>음악 도구 모음 — 메트로놈 · 튜너 · 피아노롤 · 사보 · MIDI | 뮤지아</title>
        <meta
            name="description"
            content="뮤지아 음악 도구 9종: 메트로놈, 크로매틱 튜너, BPM 탭 카운터, 코드 진행 추천(32 진행 × 10 장르), 음악 이론 퀴즈(105 문항), 피아노 롤, ABC 표기법(51 템플릿), MusicXML 사보, MIDI 시퀀서. 작곡 · 편곡 · 사보 · 연습 · 학습."
        />
        <meta property="og:title" content="뮤지아 음악 도구 모음" />
        <meta
            property="og:description"
            content="메트로놈 / 튜너 / 피아노 롤 / 사보 / MIDI — 음악인을 위한 무료 웹 도구 9종"
        />
    {/if}
    <link rel="alternate" hreflang="ko" href="https://muzia.net/tools" />
    <link rel="alternate" hreflang="en" href="https://muzia.net/tools" />
    <link rel="alternate" hreflang="x-default" href="https://muzia.net/tools" />
    {@html `<script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        'name': lang === 'en' ? 'Muzia Music Tools' : '뮤지아 음악 도구 모음',
        'url': 'https://muzia.net/tools',
        'description': lang === 'en'
            ? 'Metronome / Tuner / BPM / Chord Progressions / Theory Quiz / Piano Roll / ABC / MusicXML / MIDI — 9 free web music tools'
            : '메트로놈 / 튜너 / BPM / 코드 / 이론 / 피아노 롤 / ABC / MusicXML / MIDI — 음악인을 위한 무료 웹 도구 9종',
        'inLanguage': lang === 'en' ? 'en' : 'ko',
        'hasPart': tools.map(t => ({
            '@type': 'SoftwareApplication',
            'name': t.title,
            'description': t.desc,
            'url': `https://muzia.net/tools/${t.slug}`,
            'applicationCategory': 'MultimediaApplication',
            'operatingSystem': 'Web',
            'offers': { '@type': 'Offer', 'price': '0', 'priceCurrency': 'KRW' }
        }))
    })}</` + `script>`}
</svelte:head>

<div class="tools-wrap">
    <header class="hero">
        <div class="kicker">{m.toolsIndex.kicker}</div>
        <h1>{m.toolsIndex.title}</h1>
        <p class="lead">{m.toolsIndex.lead}</p>
    </header>

    <div class="grid">
        {#each tools as t}
            <a href="/tools/{t.slug}" class="card">
                <div class="icon">{t.icon}</div>
                <div class="meta">
                    <div class="tag">{t.tag}</div>
                    <h2>{t.title}</h2>
                    <p>{t.desc}</p>
                </div>
                <div class="cta">{m.toolsIndex.open}</div>
            </a>
        {/each}
    </div>

    <section class="info">
        <h2>{m.toolsIndex.infoTitle}</h2>
        <ul>
            <li>{m.toolsIndex.info1}</li>
            <li>{m.toolsIndex.info2}</li>
            <li>{m.toolsIndex.info3}</li>
            <li>{m.toolsIndex.info4}</li>
        </ul>
    </section>
</div>

<style>
    .tools-wrap {
        max-width: 1080px;
        margin: 0 auto;
        padding: 32px 16px 64px;
    }
    .hero {
        text-align: center;
        padding: 32px 0 40px;
    }
    .kicker {
        font-size: 13px;
        color: #6366f1;
        letter-spacing: 2px;
        font-weight: 600;
    }
    .hero h1 {
        font-size: 38px;
        margin: 8px 0 12px;
        font-weight: 800;
        letter-spacing: -0.5px;
    }
    .hero .lead {
        color: #4b5563;
        font-size: 16px;
        line-height: 1.7;
        max-width: 640px;
        margin: 0 auto;
    }
    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
        margin-top: 8px;
    }
    .card {
        position: relative;
        display: flex;
        flex-direction: column;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 14px;
        padding: 20px;
        text-decoration: none;
        color: inherit;
        transition: all 0.18s;
    }
    .card.coming {
        background: #f9fafb;
        opacity: 0.78;
        cursor: default;
    }
    .badge {
        position: absolute;
        top: 12px;
        right: 12px;
        font-size: 11px;
        background: #fef3c7;
        color: #92400e;
        padding: 3px 8px;
        border-radius: 999px;
        font-weight: 700;
        letter-spacing: 0.4px;
    }
    .cta.muted {
        color: #9ca3af;
    }
    a.card:hover {
        border-color: #6366f1;
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(99, 102, 241, 0.12);
    }
    .icon {
        font-size: 36px;
        line-height: 1;
        margin-bottom: 12px;
    }
    .tag {
        font-size: 11px;
        color: #6b7280;
        text-transform: uppercase;
        letter-spacing: 1.5px;
        font-weight: 600;
    }
    .card h2 {
        font-size: 18px;
        margin: 4px 0 8px;
        font-weight: 700;
    }
    .card p {
        color: #4b5563;
        font-size: 14px;
        line-height: 1.55;
        margin: 0;
        flex: 1;
    }
    .cta {
        margin-top: 14px;
        font-size: 13px;
        color: #6366f1;
        font-weight: 600;
    }
    .info {
        margin-top: 56px;
        padding: 28px;
        background: linear-gradient(135deg, #f5f3ff, #eff6ff);
        border-radius: 14px;
    }
    .info h2 {
        font-size: 18px;
        margin: 0 0 14px;
    }
    .info ul {
        margin: 0;
        padding-left: 18px;
        color: #374151;
        line-height: 1.8;
        font-size: 14px;
    }
    .info li + li {
        margin-top: 4px;
    }
    @media (max-width: 600px) {
        .hero h1 {
            font-size: 28px;
        }
        .hero .lead {
            font-size: 15px;
        }
    }
</style>
