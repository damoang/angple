export type Lang = 'ko' | 'en' | 'ja' | 'zh' | 'es' | 'fr' | 'de' | 'pt';

export const LANGS: Lang[] = ['ko', 'en', 'ja', 'zh', 'es', 'fr', 'de', 'pt'];

export const LANG_LABEL: Record<Lang, string> = {
    ko: '한국어',
    en: 'English',
    ja: '日本語',
    zh: '中文',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    pt: 'Português'
};

export const LANG_FLAG: Record<Lang, string> = {
    ko: '🇰🇷',
    en: '🇺🇸',
    ja: '🇯🇵',
    zh: '🇨🇳',
    es: '🇪🇸',
    fr: '🇫🇷',
    de: '🇩🇪',
    pt: '🇵🇹'
};

export const LANG_HTML_CODE: Record<Lang, string> = {
    ko: 'ko',
    en: 'en',
    ja: 'ja',
    zh: 'zh-CN',
    es: 'es',
    fr: 'fr',
    de: 'de',
    pt: 'pt'
};

export interface Messages {
    nav: {
        home: string;
        attendance: string;
        qna: string;
        forum: string;
        music: string;
        violin: string;
        sibelius: string;
        dorico: string;
        tools: string;
        tip: string;
        notice: string;
        hello: string;
        feed: string;
    };
    toolsIndex: {
        kicker: string;
        title: string;
        lead: string;
        infoTitle: string;
        info1: string;
        info2: string;
        info3: string;
        info4: string;
        comingSoon: string;
        open: string;
        commingSoonLabel: string;
    };
    cards: {
        metronome: { tag: string; title: string; desc: string };
        tuner: { tag: string; title: string; desc: string };
        bpmTap: { tag: string; title: string; desc: string };
        chordProgression: { tag: string; title: string; desc: string };
        musicTheory: { tag: string; title: string; desc: string };
        pianoRoll: { tag: string; title: string; desc: string };
        abcNotation: { tag: string; title: string; desc: string };
        scoreEditor: { tag: string; title: string; desc: string };
        midiSequencer: { tag: string; title: string; desc: string };
        scaleDictionary: { tag: string; title: string; desc: string };
        chordDictionary: { tag: string; title: string; desc: string };
        intervalTrainer: { tag: string; title: string; desc: string };
    };
    common: {
        backToTools: string;
        play: string;
        stop: string;
        clear: string;
        download: string;
        upload: string;
        share: string;
        copied: string;
        next: string;
        previous: string;
        bpm: string;
        key: string;
        save: string;
        loading: string;
    };
}

export const MESSAGES: Record<Lang, Messages> = {
    ko: {
        nav: { home: '홈', attendance: '출석부', qna: 'Q&A', forum: '포럼', music: '음악', violin: '바이올린', sibelius: '시벨리우스', dorico: '도리코', tools: '음악 도구', tip: '강좌/팁', notice: '공지사항', hello: '가입인사', feed: '피드' },
        toolsIndex: {
            kicker: 'Tools', title: '음악 도구 모음',
            lead: '작곡 · 편곡 · 사보 · 연습 · 학습 — 음악인이 매일 쓰는 도구를 브라우저에서 무료로. 로그인 / 설치 없이 즉시 사용. 모바일 지원.',
            infoTitle: '왜 뮤지아 도구인가?',
            info1: '설치 불필요 — 모든 도구가 브라우저(Web Audio API) 기반. 데스크톱 / 노트북 / 스마트폰 어디서나.',
            info2: '광고 최소 — 음악 작업 흐름을 끊지 않도록 도구 화면은 깨끗하게.',
            info3: '한국어 / 한국 음악 친화 — 국악 / K-Pop / CCM / 클래식 모두 고려한 도구.',
            info4: '오픈 / 빠름 / 정확 — 메트로놈 ±1ms, 튜너 ±2 cents 정밀도.',
            comingSoon: '곧 출시', open: '열기 →', commingSoonLabel: '준비 중'
        },
        cards: {
            metronome: { tag: '연주 · 연습', title: '메트로놈', desc: 'BPM 30~300, 11 박자, 강세, 시각 비주얼' },
            tuner: { tag: '튜닝', title: '튜너 (Chromatic)', desc: '마이크 입력 음정 분석 + 432/440/442Hz 보정 + 알트 튜닝 6종' },
            bpmTap: { tag: '분석', title: 'BPM 탭 카운터', desc: '곡을 들으며 탭 → BPM 자동 계산. 25 장르 가이드' },
            chordProgression: { tag: '작곡 · 편곡', title: '코드 진행 추천', desc: '12 키 × 32 진행, 10 장르 필터' },
            musicTheory: { tag: '학습', title: '음악 이론 퀴즈', desc: '105 문항 — 음정/코드/조성/진행/리듬/한국 음악' },
            pianoRoll: { tag: '작곡', title: '피아노 롤', desc: '16 스텝 × 24 키, Tone.js 재생, 자동 저장, 공유 URL' },
            abcNotation: { tag: '사보', title: 'ABC 표기법 → 악보', desc: '51 템플릿 + 실시간 렌더 + 재생' },
            scoreEditor: { tag: '사보 · 편곡', title: 'MusicXML 사보 에디터', desc: '시벨리우스 / 피날레 / 도리코 호환' },
            midiSequencer: { tag: '편곡 · DAW', title: 'MIDI 시퀀서', desc: '4 트랙 + 마스터 BPM + .mid 입출력' },
            scaleDictionary: { tag: '레퍼런스', title: '스케일 사전', desc: '16 스케일 × 12 키 (평조/계면조 포함)' },
            chordDictionary: { tag: '레퍼런스', title: '코드 사전', desc: '30 코드 × 12 루트 + 보이싱' },
            intervalTrainer: { tag: '학습', title: '인터벌 트레이너', desc: '음정 듣고 맞히기' }
        },
        common: { backToTools: '← 도구 모음', play: '▶ 재생', stop: '■ 정지', clear: '전체 지우기', download: '다운로드', upload: '업로드', share: '🔗 공유', copied: '✓ 복사됨', next: '다음 →', previous: '← 이전', bpm: 'BPM', key: '키', save: '저장', loading: '로딩 중...' }
    },
    en: {
        nav: { home: 'Home', attendance: 'Attendance', qna: 'Q&A', forum: 'Forum', music: 'Music', violin: 'Violin', sibelius: 'Sibelius', dorico: 'Dorico', tools: 'Music Tools', tip: 'Tips', notice: 'Notices', hello: 'Greetings', feed: 'Feed' },
        toolsIndex: {
            kicker: 'Tools', title: 'Music Tools',
            lead: 'Composition · Arranging · Notation · Practice · Learning — Tools musicians use every day, free in your browser. No login, no install. Mobile-friendly.',
            infoTitle: 'Why Muzia Tools?',
            info1: 'No install — every tool runs in the browser. Desktop / laptop / smartphone, anywhere.',
            info2: 'Minimal ads — clean tool screens that don\'t interrupt your workflow.',
            info3: 'Korean & Korean music aware — Gugak / K-Pop / CCM / Classical all considered.',
            info4: 'Open / Fast / Accurate — Metronome ±1ms, Tuner ±2 cents.',
            comingSoon: 'Coming Soon', open: 'Open →', commingSoonLabel: 'In Progress'
        },
        cards: {
            metronome: { tag: 'Practice', title: 'Metronome', desc: 'BPM 30~300, 11 time signatures, accent, visual beats' },
            tuner: { tag: 'Tuning', title: 'Chromatic Tuner', desc: 'Mic-input pitch + 432/440/442Hz + 6 alt tunings' },
            bpmTap: { tag: 'Analysis', title: 'BPM Tap Counter', desc: 'Tap along → BPM detected. 25 genre guide' },
            chordProgression: { tag: 'Composition', title: 'Chord Progression', desc: '12 keys × 32 progressions, 10 genre filters' },
            musicTheory: { tag: 'Learning', title: 'Music Theory Quiz', desc: '105 questions across 6 categories' },
            pianoRoll: { tag: 'Composition', title: 'Piano Roll', desc: '16 steps × 24 keys, auto-save, share URL' },
            abcNotation: { tag: 'Notation', title: 'ABC Notation', desc: '51 templates + live render + playback' },
            scoreEditor: { tag: 'Notation', title: 'MusicXML Editor', desc: 'Sibelius / Finale / Dorico compatible' },
            midiSequencer: { tag: 'DAW', title: 'MIDI Sequencer', desc: '4 tracks + master BPM + .mid I/O' },
            scaleDictionary: { tag: 'Reference', title: 'Scale Dictionary', desc: '16 scales × 12 keys (incl. Korean Pyeongjo/Gyemyeonjo)' },
            chordDictionary: { tag: 'Reference', title: 'Chord Dictionary', desc: '30 chords × 12 roots + voicings' },
            intervalTrainer: { tag: 'Learning', title: 'Interval Trainer', desc: 'Listen and identify intervals' }
        },
        common: { backToTools: '← Tools', play: '▶ Play', stop: '■ Stop', clear: 'Clear', download: 'Download', upload: 'Upload', share: '🔗 Share', copied: '✓ Copied', next: 'Next →', previous: '← Prev', bpm: 'BPM', key: 'Key', save: 'Save', loading: 'Loading...' }
    },
    ja: {
        nav: { home: 'ホーム', attendance: '出席簿', qna: 'Q&A', forum: 'フォーラム', music: '音楽', violin: 'バイオリン', sibelius: 'Sibelius', dorico: 'Dorico', tools: '音楽ツール', tip: 'チップ', notice: 'お知らせ', hello: '入会挨拶', feed: 'フィード' },
        toolsIndex: {
            kicker: 'Tools', title: '音楽ツール集',
            lead: '作曲・編曲・浄書・練習・学習 — 音楽家が毎日使うツールをブラウザで無料に。ログイン/インストール不要。モバイル対応。',
            infoTitle: 'なぜMuziaツールか?',
            info1: 'インストール不要 — すべてのツールがブラウザ (Web Audio API) ベース。',
            info2: '広告は最小限 — 音楽作業の流れを妨げないクリーンな画面。',
            info3: '韓国語/韓国音楽対応 — 国楽/K-Pop/CCM/クラシックすべて考慮。',
            info4: 'オープン/速い/正確 — メトロノーム±1ms、チューナー±2 cents。',
            comingSoon: '近日公開', open: '開く →', commingSoonLabel: '準備中'
        },
        cards: {
            metronome: { tag: '練習', title: 'メトロノーム', desc: 'BPM 30~300、11拍子、アクセント、ビジュアル' },
            tuner: { tag: 'チューニング', title: 'クロマチックチューナー', desc: 'マイク入力 + 432/440/442Hz補正 + オルタナティブチューニング6種' },
            bpmTap: { tag: '分析', title: 'BPMタップカウンター', desc: 'タップでBPM自動計算。25ジャンルガイド' },
            chordProgression: { tag: '作曲', title: 'コード進行', desc: '12キー × 32進行、10ジャンルフィルター' },
            musicTheory: { tag: '学習', title: '音楽理論クイズ', desc: '105問 — 6カテゴリ' },
            pianoRoll: { tag: '作曲', title: 'ピアノロール', desc: '16ステップ × 24鍵、自動保存、URL共有' },
            abcNotation: { tag: '浄書', title: 'ABC記譜法', desc: '51テンプレート + リアルタイムレンダリング + 再生' },
            scoreEditor: { tag: '浄書', title: 'MusicXMLエディタ', desc: 'Sibelius / Finale / Dorico互換' },
            midiSequencer: { tag: 'DAW', title: 'MIDIシーケンサー', desc: '4トラック + マスターBPM + .mid入出力' },
            scaleDictionary: { tag: 'リファレンス', title: 'スケール辞典', desc: '16スケール × 12キー (韓国平調/界面調含む)' },
            chordDictionary: { tag: 'リファレンス', title: 'コード辞典', desc: '30コード × 12ルート + ボイシング' },
            intervalTrainer: { tag: '学習', title: 'インターバルトレーナー', desc: '音程聴音' }
        },
        common: { backToTools: '← ツール', play: '▶ 再生', stop: '■ 停止', clear: 'クリア', download: 'ダウンロード', upload: 'アップロード', share: '🔗 共有', copied: '✓ コピー済み', next: '次 →', previous: '← 前', bpm: 'BPM', key: 'キー', save: '保存', loading: '読み込み中...' }
    },
    zh: {
        nav: { home: '首页', attendance: '考勤', qna: '问答', forum: '论坛', music: '音乐', violin: '小提琴', sibelius: 'Sibelius', dorico: 'Dorico', tools: '音乐工具', tip: '技巧', notice: '公告', hello: '入会问候', feed: '动态' },
        toolsIndex: {
            kicker: 'Tools', title: '音乐工具集',
            lead: '作曲·编曲·记谱·练习·学习 — 音乐人每日使用的工具,在浏览器中免费使用。无需登录或安装。支持移动端。',
            infoTitle: '为什么选择Muzia工具?',
            info1: '免安装 — 所有工具均基于浏览器 (Web Audio API)。',
            info2: '极少广告 — 干净的工具界面,不打断音乐工作流。',
            info3: '韩语/韩国音乐友好 — 国乐/K-Pop/CCM/古典全部考虑。',
            info4: '开放/快速/精确 — 节拍器±1ms,调音器±2 cents。',
            comingSoon: '即将推出', open: '打开 →', commingSoonLabel: '准备中'
        },
        cards: {
            metronome: { tag: '练习', title: '节拍器', desc: 'BPM 30~300, 11种拍号, 重音, 视觉节拍' },
            tuner: { tag: '调音', title: '半音调音器', desc: '麦克风输入 + 432/440/442Hz校准 + 6种替代调音' },
            bpmTap: { tag: '分析', title: 'BPM节拍计数器', desc: '点击自动计算BPM。25种流派指南' },
            chordProgression: { tag: '作曲', title: '和弦进行', desc: '12调 × 32进行, 10流派筛选' },
            musicTheory: { tag: '学习', title: '乐理测验', desc: '105题 — 6个分类' },
            pianoRoll: { tag: '作曲', title: '钢琴卷帘', desc: '16步 × 24键, 自动保存, URL分享' },
            abcNotation: { tag: '记谱', title: 'ABC记谱法', desc: '51个模板 + 实时渲染 + 播放' },
            scoreEditor: { tag: '记谱', title: 'MusicXML编辑器', desc: 'Sibelius / Finale / Dorico兼容' },
            midiSequencer: { tag: 'DAW', title: 'MIDI音序器', desc: '4轨道 + 主BPM + .mid导入导出' },
            scaleDictionary: { tag: '参考', title: '音阶词典', desc: '16音阶 × 12调 (含韩国平调/界面调)' },
            chordDictionary: { tag: '参考', title: '和弦词典', desc: '30和弦 × 12根音 + 声部布局' },
            intervalTrainer: { tag: '学习', title: '音程训练', desc: '聆听并识别音程' }
        },
        common: { backToTools: '← 工具', play: '▶ 播放', stop: '■ 停止', clear: '清除', download: '下载', upload: '上传', share: '🔗 分享', copied: '✓ 已复制', next: '下一个 →', previous: '← 上一个', bpm: 'BPM', key: '调', save: '保存', loading: '加载中...' }
    },
    es: {
        nav: { home: 'Inicio', attendance: 'Asistencia', qna: 'Q&A', forum: 'Foro', music: 'Música', violin: 'Violín', sibelius: 'Sibelius', dorico: 'Dorico', tools: 'Herramientas', tip: 'Consejos', notice: 'Avisos', hello: 'Saludos', feed: 'Inicio' },
        toolsIndex: {
            kicker: 'Tools', title: 'Herramientas Musicales',
            lead: 'Composición · Arreglos · Notación · Práctica · Aprendizaje — Herramientas que los músicos usan a diario, gratis en tu navegador. Sin login ni instalación. Compatible con móvil.',
            infoTitle: '¿Por qué Muzia Tools?',
            info1: 'Sin instalación — todas las herramientas funcionan en el navegador.',
            info2: 'Anuncios mínimos — pantallas limpias que no interrumpen tu trabajo musical.',
            info3: 'Compatible con coreano y música coreana — Gugak / K-Pop / CCM / Clásica.',
            info4: 'Abierto / Rápido / Preciso — Metrónomo ±1ms, afinador ±2 centésimas.',
            comingSoon: 'Próximamente', open: 'Abrir →', commingSoonLabel: 'En progreso'
        },
        cards: {
            metronome: { tag: 'Práctica', title: 'Metrónomo', desc: 'BPM 30~300, 11 compases, acento, visual' },
            tuner: { tag: 'Afinación', title: 'Afinador Cromático', desc: 'Micrófono + 432/440/442Hz + 6 afinaciones alt' },
            bpmTap: { tag: 'Análisis', title: 'Contador BPM', desc: 'Toca al ritmo → BPM automático. 25 géneros' },
            chordProgression: { tag: 'Composición', title: 'Progresión de Acordes', desc: '12 tonalidades × 32 progresiones, 10 géneros' },
            musicTheory: { tag: 'Aprendizaje', title: 'Teoría Musical', desc: '105 preguntas en 6 categorías' },
            pianoRoll: { tag: 'Composición', title: 'Piano Roll', desc: '16 pasos × 24 teclas, autoguardado, URL' },
            abcNotation: { tag: 'Notación', title: 'Notación ABC', desc: '51 plantillas + render en vivo + reproducción' },
            scoreEditor: { tag: 'Notación', title: 'Editor MusicXML', desc: 'Compatible con Sibelius / Finale / Dorico' },
            midiSequencer: { tag: 'DAW', title: 'Secuenciador MIDI', desc: '4 pistas + BPM maestro + .mid I/O' },
            scaleDictionary: { tag: 'Referencia', title: 'Diccionario de Escalas', desc: '16 escalas × 12 tonos (incl. Pyeongjo/Gyemyeonjo)' },
            chordDictionary: { tag: 'Referencia', title: 'Diccionario de Acordes', desc: '30 acordes × 12 raíces + voicings' },
            intervalTrainer: { tag: 'Aprendizaje', title: 'Entrenador de Intervalos', desc: 'Escucha e identifica' }
        },
        common: { backToTools: '← Herramientas', play: '▶ Reproducir', stop: '■ Detener', clear: 'Limpiar', download: 'Descargar', upload: 'Subir', share: '🔗 Compartir', copied: '✓ Copiado', next: 'Siguiente →', previous: '← Anterior', bpm: 'BPM', key: 'Tonalidad', save: 'Guardar', loading: 'Cargando...' }
    },
    fr: {
        nav: { home: 'Accueil', attendance: 'Présence', qna: 'Q&R', forum: 'Forum', music: 'Musique', violin: 'Violon', sibelius: 'Sibelius', dorico: 'Dorico', tools: 'Outils', tip: 'Astuces', notice: 'Avis', hello: 'Bienvenue', feed: 'Fil' },
        toolsIndex: {
            kicker: 'Tools', title: 'Outils Musicaux',
            lead: 'Composition · Arrangement · Notation · Pratique · Apprentissage — Outils utilisés quotidiennement par les musiciens, gratuits dans votre navigateur. Sans connexion ni installation. Mobile compatible.',
            infoTitle: 'Pourquoi Muzia Tools?',
            info1: 'Aucune installation — tous les outils fonctionnent dans le navigateur.',
            info2: 'Publicités minimales — interfaces propres qui n\'interrompent pas le flux musical.',
            info3: 'Coréen et musique coréenne — Gugak / K-Pop / CCM / Classique.',
            info4: 'Ouvert / Rapide / Précis — Métronome ±1ms, accordeur ±2 cents.',
            comingSoon: 'Bientôt', open: 'Ouvrir →', commingSoonLabel: 'En cours'
        },
        cards: {
            metronome: { tag: 'Pratique', title: 'Métronome', desc: 'BPM 30~300, 11 mesures, accent, visuel' },
            tuner: { tag: 'Accordage', title: 'Accordeur Chromatique', desc: 'Microphone + 432/440/442Hz + 6 accordages alt' },
            bpmTap: { tag: 'Analyse', title: 'Compteur BPM', desc: 'Tapez au rythme → BPM auto. 25 genres' },
            chordProgression: { tag: 'Composition', title: 'Progression d\'Accords', desc: '12 tons × 32 progressions, 10 genres' },
            musicTheory: { tag: 'Apprentissage', title: 'Quiz Théorie Musicale', desc: '105 questions, 6 catégories' },
            pianoRoll: { tag: 'Composition', title: 'Piano Roll', desc: '16 pas × 24 touches, auto-save, URL' },
            abcNotation: { tag: 'Notation', title: 'Notation ABC', desc: '51 modèles + rendu en direct + lecture' },
            scoreEditor: { tag: 'Notation', title: 'Éditeur MusicXML', desc: 'Sibelius / Finale / Dorico compatible' },
            midiSequencer: { tag: 'DAW', title: 'Séquenceur MIDI', desc: '4 pistes + BPM maître + .mid I/O' },
            scaleDictionary: { tag: 'Référence', title: 'Dictionnaire de Gammes', desc: '16 gammes × 12 tons (Pyeongjo/Gyemyeonjo inclus)' },
            chordDictionary: { tag: 'Référence', title: 'Dictionnaire d\'Accords', desc: '30 accords × 12 fondamentales + voicings' },
            intervalTrainer: { tag: 'Apprentissage', title: 'Entraîneur d\'Intervalles', desc: 'Écoutez et identifiez' }
        },
        common: { backToTools: '← Outils', play: '▶ Lire', stop: '■ Arrêter', clear: 'Effacer', download: 'Télécharger', upload: 'Importer', share: '🔗 Partager', copied: '✓ Copié', next: 'Suivant →', previous: '← Préc', bpm: 'BPM', key: 'Tonalité', save: 'Enregistrer', loading: 'Chargement...' }
    },
    de: {
        nav: { home: 'Start', attendance: 'Anwesenheit', qna: 'Q&A', forum: 'Forum', music: 'Musik', violin: 'Violine', sibelius: 'Sibelius', dorico: 'Dorico', tools: 'Werkzeuge', tip: 'Tipps', notice: 'Mitteilungen', hello: 'Willkommen', feed: 'Feed' },
        toolsIndex: {
            kicker: 'Tools', title: 'Musik-Werkzeuge',
            lead: 'Komposition · Arrangement · Notation · Übung · Lernen — Werkzeuge für Musiker, kostenlos im Browser. Ohne Anmeldung oder Installation. Mobil-fähig.',
            infoTitle: 'Warum Muzia Tools?',
            info1: 'Keine Installation — alle Werkzeuge laufen im Browser (Web Audio API).',
            info2: 'Minimale Werbung — saubere Oberfläche, die den Musikfluss nicht unterbricht.',
            info3: 'Koreanisch- und koreanische Musik-freundlich — Gugak / K-Pop / CCM / Klassik.',
            info4: 'Offen / Schnell / Präzise — Metronom ±1ms, Stimmgerät ±2 Cent.',
            comingSoon: 'Bald verfügbar', open: 'Öffnen →', commingSoonLabel: 'In Arbeit'
        },
        cards: {
            metronome: { tag: 'Übung', title: 'Metronom', desc: 'BPM 30~300, 11 Taktarten, Akzent, visuell' },
            tuner: { tag: 'Stimmung', title: 'Chromatisches Stimmgerät', desc: 'Mikrofon + 432/440/442Hz + 6 alternative Stimmungen' },
            bpmTap: { tag: 'Analyse', title: 'BPM Tap Counter', desc: 'Im Takt klopfen → BPM automatisch. 25 Genres' },
            chordProgression: { tag: 'Komposition', title: 'Akkordfolge', desc: '12 Tonarten × 32 Folgen, 10 Genre-Filter' },
            musicTheory: { tag: 'Lernen', title: 'Musiktheorie-Quiz', desc: '105 Fragen in 6 Kategorien' },
            pianoRoll: { tag: 'Komposition', title: 'Piano Roll', desc: '16 Schritte × 24 Tasten, Autospeichern, URL' },
            abcNotation: { tag: 'Notation', title: 'ABC-Notation', desc: '51 Vorlagen + Live-Rendering + Wiedergabe' },
            scoreEditor: { tag: 'Notation', title: 'MusicXML-Editor', desc: 'Sibelius / Finale / Dorico kompatibel' },
            midiSequencer: { tag: 'DAW', title: 'MIDI-Sequenzer', desc: '4 Spuren + Master-BPM + .mid I/O' },
            scaleDictionary: { tag: 'Referenz', title: 'Tonleiter-Lexikon', desc: '16 Tonleitern × 12 Tonarten (inkl. Pyeongjo/Gyemyeonjo)' },
            chordDictionary: { tag: 'Referenz', title: 'Akkord-Lexikon', desc: '30 Akkorde × 12 Grundtöne + Voicings' },
            intervalTrainer: { tag: 'Lernen', title: 'Intervall-Trainer', desc: 'Hören und identifizieren' }
        },
        common: { backToTools: '← Werkzeuge', play: '▶ Abspielen', stop: '■ Stopp', clear: 'Löschen', download: 'Download', upload: 'Hochladen', share: '🔗 Teilen', copied: '✓ Kopiert', next: 'Weiter →', previous: '← Zurück', bpm: 'BPM', key: 'Tonart', save: 'Speichern', loading: 'Lädt...' }
    },
    pt: {
        nav: { home: 'Início', attendance: 'Presença', qna: 'Q&A', forum: 'Fórum', music: 'Música', violin: 'Violino', sibelius: 'Sibelius', dorico: 'Dorico', tools: 'Ferramentas', tip: 'Dicas', notice: 'Avisos', hello: 'Boas-vindas', feed: 'Feed' },
        toolsIndex: {
            kicker: 'Tools', title: 'Ferramentas Musicais',
            lead: 'Composição · Arranjo · Notação · Prática · Aprendizagem — Ferramentas que músicos usam diariamente, grátis no navegador. Sem login ou instalação. Compatível com celular.',
            infoTitle: 'Por que Muzia Tools?',
            info1: 'Sem instalação — todas as ferramentas funcionam no navegador.',
            info2: 'Anúncios mínimos — telas limpas que não interrompem o fluxo musical.',
            info3: 'Coreano e música coreana — Gugak / K-Pop / CCM / Clássica.',
            info4: 'Aberto / Rápido / Preciso — Metrônomo ±1ms, afinador ±2 cents.',
            comingSoon: 'Em breve', open: 'Abrir →', commingSoonLabel: 'Em progresso'
        },
        cards: {
            metronome: { tag: 'Prática', title: 'Metrônomo', desc: 'BPM 30~300, 11 compassos, acento, visual' },
            tuner: { tag: 'Afinação', title: 'Afinador Cromático', desc: 'Microfone + 432/440/442Hz + 6 afinações alt' },
            bpmTap: { tag: 'Análise', title: 'Contador BPM', desc: 'Toque ao ritmo → BPM auto. 25 gêneros' },
            chordProgression: { tag: 'Composição', title: 'Progressão de Acordes', desc: '12 tons × 32 progressões, 10 gêneros' },
            musicTheory: { tag: 'Aprendizagem', title: 'Teoria Musical', desc: '105 perguntas em 6 categorias' },
            pianoRoll: { tag: 'Composição', title: 'Piano Roll', desc: '16 passos × 24 teclas, salva, URL' },
            abcNotation: { tag: 'Notação', title: 'Notação ABC', desc: '51 templates + render ao vivo + reprodução' },
            scoreEditor: { tag: 'Notação', title: 'Editor MusicXML', desc: 'Compatível com Sibelius / Finale / Dorico' },
            midiSequencer: { tag: 'DAW', title: 'Sequenciador MIDI', desc: '4 trilhas + BPM mestre + .mid I/O' },
            scaleDictionary: { tag: 'Referência', title: 'Dicionário de Escalas', desc: '16 escalas × 12 tons (incl. Pyeongjo/Gyemyeonjo)' },
            chordDictionary: { tag: 'Referência', title: 'Dicionário de Acordes', desc: '30 acordes × 12 fundamentais + vozes' },
            intervalTrainer: { tag: 'Aprendizagem', title: 'Treinador de Intervalos', desc: 'Ouça e identifique' }
        },
        common: { backToTools: '← Ferramentas', play: '▶ Tocar', stop: '■ Parar', clear: 'Limpar', download: 'Baixar', upload: 'Enviar', share: '🔗 Compartilhar', copied: '✓ Copiado', next: 'Próximo →', previous: '← Anterior', bpm: 'BPM', key: 'Tom', save: 'Salvar', loading: 'Carregando...' }
    }
};
