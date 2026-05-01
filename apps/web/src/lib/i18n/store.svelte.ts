import { browser } from '$app/environment';
import { MESSAGES, LANGS, LANG_HTML_CODE, type Lang, type Messages } from './messages';

const STORAGE_KEY = 'muzia.lang.v2';

function detectInitial(): Lang {
    if (!browser) return 'ko';
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved && (LANGS as string[]).includes(saved)) return saved as Lang;
    } catch {}
    // 브라우저 언어 감지
    const navLang = (navigator.language || '').toLowerCase();
    if (navLang.startsWith('ko')) return 'ko';
    if (navLang.startsWith('en')) return 'en';
    if (navLang.startsWith('ja')) return 'ja';
    if (navLang.startsWith('zh')) return 'zh';
    if (navLang.startsWith('es')) return 'es';
    if (navLang.startsWith('fr')) return 'fr';
    if (navLang.startsWith('de')) return 'de';
    if (navLang.startsWith('pt')) return 'pt';
    return 'ko';
}

let lang = $state<Lang>(detectInitial());

export function getLang(): Lang {
    return lang;
}

export function setLang(next: Lang) {
    if (!(LANGS as string[]).includes(next)) return;
    lang = next;
    if (browser) {
        try { localStorage.setItem(STORAGE_KEY, next); } catch {}
        try { document.documentElement.lang = LANG_HTML_CODE[next]; } catch {}
    }
}

export function toggleLang() {
    const idx = LANGS.indexOf(lang);
    setLang(LANGS[(idx + 1) % LANGS.length]);
}

export function t(): Messages {
    return MESSAGES[lang];
}

export function tLang(targetLang: Lang): Messages {
    return MESSAGES[targetLang];
}

export { LANGS };
export type { Lang, Messages };
