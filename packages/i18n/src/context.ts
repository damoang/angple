/**
 * i18n Context for SvelteKit
 * Simple, non-reactive translation utility
 */

import type { SupportedLocale } from './types.js';
import { DEFAULT_LOCALE, isValidLocale, LOCALE_METADATA } from './locales.js';
import { LOCALE_STORAGE_KEY, LOCALE_COOKIE_NAME } from './config.js';
import { isRTL, getDirection, setDocumentDirection } from './rtl.js';

// Message type - flat key-value structure
type Messages = Record<string, string>;

// i18n state
interface I18nState {
    locale: SupportedLocale;
    messages: Record<SupportedLocale, Messages>;
    initialized: boolean;
}

// Global state
const state: I18nState = {
    locale: DEFAULT_LOCALE,
    messages: {
        en: {},
        ko: {},
        ja: {},
        zh: {},
        es: {},
        ar: {},
        vi: {}
    },
    initialized: false
};

/**
 * Initialize i18n with all messages
 */
export function initI18n(
    messages: Record<SupportedLocale, Messages>,
    initialLocale?: SupportedLocale
): void {
    state.messages = messages;
    state.initialized = true;

    if (initialLocale && isValidLocale(initialLocale)) {
        state.locale = initialLocale;
    }
}

/**
 * Get current locale
 */
export function getLocale(): SupportedLocale {
    return state.locale;
}

/**
 * Set current locale
 */
export function setLocale(newLocale: string): void {
    if (!isValidLocale(newLocale)) {
        console.warn(`Invalid locale: ${newLocale}, falling back to ${DEFAULT_LOCALE}`);
        state.locale = DEFAULT_LOCALE;
        return;
    }

    state.locale = newLocale;

    // Save to localStorage (browser only)
    if (typeof window !== 'undefined') {
        localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
        document.cookie = `${LOCALE_COOKIE_NAME}=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
        setDocumentDirection(newLocale);
    }
}

/**
 * Detect locale from storage/cookie/navigator
 */
export function detectLocale(): SupportedLocale {
    if (typeof window === 'undefined') {
        return DEFAULT_LOCALE;
    }

    // Try localStorage
    const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (storedLocale && isValidLocale(storedLocale)) {
        return storedLocale;
    }

    // Try cookie
    const cookieMatch = document.cookie.match(new RegExp(`${LOCALE_COOKIE_NAME}=([^;]+)`));
    const cookieLocale = cookieMatch?.[1];
    if (cookieLocale && isValidLocale(cookieLocale)) {
        return cookieLocale;
    }

    // Try navigator language
    const browserLang = navigator.language.split('-')[0];
    if (isValidLocale(browserLang)) {
        return browserLang;
    }

    return DEFAULT_LOCALE;
}

/**
 * Initialize locale from detection
 */
export function initLocale(): void {
    const detectedLocale = detectLocale();
    setLocale(detectedLocale);
}

/**
 * Translate a key with optional parameters
 */
export function t(key: string, params?: Record<string, string | number>): string {
    const currentMessages = state.messages[state.locale] || state.messages[DEFAULT_LOCALE];
    let text = currentMessages[key];

    // Fallback to English
    if (!text && state.locale !== DEFAULT_LOCALE) {
        text = state.messages[DEFAULT_LOCALE][key];
    }

    // Return key if not found
    if (!text) {
        if (!state.initialized) {
            console.warn('i18n not initialized. Call initI18n() first.');
        }
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

/**
 * Check if current locale is RTL
 */
export function isCurrentRTL(): boolean {
    return isRTL(state.locale);
}

/**
 * Get current direction
 */
export function getCurrentDirection(): 'ltr' | 'rtl' {
    return getDirection(state.locale);
}

/**
 * Get current locale metadata
 */
export function getLocaleInfo() {
    return LOCALE_METADATA[state.locale];
}

// Re-export locale metadata
export { LOCALE_METADATA, SUPPORTED_LOCALES, DEFAULT_LOCALE } from './locales.js';
