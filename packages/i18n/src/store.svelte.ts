/**
 * i18n Translation Store for SvelteKit (Svelte 5 Rune)
 * Provides reactive translation functionality
 */

import type { SupportedLocale } from './types.js';
import { DEFAULT_LOCALE, isValidLocale, LOCALE_METADATA } from './locales.js';
import { LOCALE_STORAGE_KEY, LOCALE_COOKIE_NAME } from './config.js';
import { isRTL, setDocumentDirection } from './rtl.js';

// Message type - flat key-value structure
type Messages = Record<string, string>;

// All locale messages
const allMessages: Record<SupportedLocale, Messages> = {
    en: {},
    ko: {},
    ja: {},
    zh: {},
    es: {},
    ar: {},
    vi: {}
};

// Flag to check if messages are loaded
let messagesLoaded = false;

/**
 * Load all translation messages
 * Call this during app initialization
 */
export async function loadMessages(): Promise<void> {
    if (messagesLoaded) return;

    try {
        const [en, ko, ja, zh, es, ar, vi] = await Promise.all([
            import('@angple/i18n/messages/en.json').then((m) => m.default),
            import('@angple/i18n/messages/ko.json').then((m) => m.default),
            import('@angple/i18n/messages/ja.json').then((m) => m.default),
            import('@angple/i18n/messages/zh.json').then((m) => m.default),
            import('@angple/i18n/messages/es.json').then((m) => m.default),
            import('@angple/i18n/messages/ar.json').then((m) => m.default),
            import('@angple/i18n/messages/vi.json').then((m) => m.default)
        ]);

        allMessages.en = en;
        allMessages.ko = ko;
        allMessages.ja = ja;
        allMessages.zh = zh;
        allMessages.es = es;
        allMessages.ar = ar;
        allMessages.vi = vi;

        messagesLoaded = true;
    } catch (error) {
        console.error('Failed to load i18n messages:', error);
    }
}

/**
 * Load messages synchronously (for SSR)
 * Import messages directly without dynamic import
 */
export function loadMessagesSync(messages: Record<SupportedLocale, Messages>): void {
    Object.assign(allMessages, messages);
    messagesLoaded = true;
}

/**
 * Create i18n store
 */
function createI18nStore() {
    // Current locale state
    let locale = $state<SupportedLocale>(DEFAULT_LOCALE);

    // Get current messages
    const messages = $derived(allMessages[locale] || allMessages[DEFAULT_LOCALE]);

    // RTL state
    const rtl = $derived(isRTL(locale));

    // Direction
    const direction = $derived<'ltr' | 'rtl'>(rtl ? 'rtl' : 'ltr');

    // Locale metadata
    const metadata = $derived(LOCALE_METADATA[locale]);

    return {
        // Getters
        get locale() {
            return locale;
        },
        get messages() {
            return messages;
        },
        get isRTL() {
            return rtl;
        },
        get direction() {
            return direction;
        },
        get metadata() {
            return metadata;
        },

        /**
         * Set current locale
         */
        setLocale(newLocale: string): void {
            if (!isValidLocale(newLocale)) {
                console.warn(`Invalid locale: ${newLocale}, falling back to ${DEFAULT_LOCALE}`);
                locale = DEFAULT_LOCALE;
                return;
            }

            locale = newLocale;

            // Save to localStorage (browser only)
            if (typeof window !== 'undefined') {
                localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
                document.cookie = `${LOCALE_COOKIE_NAME}=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
                setDocumentDirection(newLocale);
            }
        },

        /**
         * Initialize locale from storage/cookie/header
         */
        init(initialLocale?: string): void {
            let detectedLocale = initialLocale;

            // Try localStorage
            if (!detectedLocale && typeof window !== 'undefined') {
                detectedLocale = localStorage.getItem(LOCALE_STORAGE_KEY) || undefined;
            }

            // Try cookie
            if (!detectedLocale && typeof document !== 'undefined') {
                const cookieMatch = document.cookie.match(
                    new RegExp(`${LOCALE_COOKIE_NAME}=([^;]+)`)
                );
                detectedLocale = cookieMatch?.[1];
            }

            // Try navigator language
            if (!detectedLocale && typeof navigator !== 'undefined') {
                const browserLang = navigator.language.split('-')[0];
                if (isValidLocale(browserLang)) {
                    detectedLocale = browserLang;
                }
            }

            // Set locale
            if (detectedLocale && isValidLocale(detectedLocale)) {
                locale = detectedLocale;
            }

            // Set document direction
            if (typeof document !== 'undefined') {
                setDocumentDirection(locale);
            }
        },

        /**
         * Translate a key with optional parameters
         * @param key Translation key (e.g., 'common_save', 'admin_themes_title')
         * @param params Optional parameters for interpolation
         * @returns Translated string
         */
        t(key: string, params?: Record<string, string | number>): string {
            let text = messages[key];

            // Fallback to English
            if (!text && locale !== DEFAULT_LOCALE) {
                text = allMessages[DEFAULT_LOCALE][key];
            }

            // Return key if not found
            if (!text) {
                return key;
            }

            // Interpolate parameters
            if (params) {
                Object.entries(params).forEach(([paramKey, value]) => {
                    text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(value));
                });
            }

            return text;
        }
    };
}

// Export singleton store
export const i18n = createI18nStore();

// Shorthand translation function
export function t(key: string, params?: Record<string, string | number>): string {
    return i18n.t(key, params);
}

// Export for type checking
export type I18nStore = ReturnType<typeof createI18nStore>;
