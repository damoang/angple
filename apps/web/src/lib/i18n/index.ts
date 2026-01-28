/**
 * i18n initialization for Web app
 */

import { initI18n, initLocale, t as translate, setDocumentDirection, getDirection, getLocale } from '@angple/i18n';
import type { SupportedLocale } from '@angple/i18n';

// Import all message files
import en from '@angple/i18n/messages/en.json';
import ko from '@angple/i18n/messages/ko.json';
import ja from '@angple/i18n/messages/ja.json';
import zh from '@angple/i18n/messages/zh.json';
import es from '@angple/i18n/messages/es.json';
import ar from '@angple/i18n/messages/ar.json';
import vi from '@angple/i18n/messages/vi.json';

// All messages
const messages: Record<SupportedLocale, Record<string, string>> = {
    en,
    ko,
    ja,
    zh,
    es,
    ar,
    vi
};

// Initialize i18n immediately at module load (for SSR support)
initI18n(messages, 'ko');

// Initialize flag for client-side locale detection
let clientInitialized = false;

/**
 * Initialize i18n system for client-side locale detection
 * Call this once in +layout.svelte onMount
 */
export function setupI18n(): void {
    if (clientInitialized) return;

    // Detect and set locale from localStorage/cookie/navigator
    initLocale();

    // Set document direction based on current locale
    const locale = getLocale();
    setDocumentDirection(locale);

    clientInitialized = true;
}

/**
 * Update document direction when locale changes
 */
export function updateDirection(): void {
    const locale = getLocale();
    setDocumentDirection(locale);
}

// Re-export translate function
export { translate as t };

// Re-export other utilities
export {
    getLocale,
    setLocale,
    isCurrentRTL,
    getCurrentDirection,
    getLocaleInfo,
    SUPPORTED_LOCALES,
    LOCALE_METADATA,
    setDocumentDirection
} from '@angple/i18n';
