/**
 * i18n initialization for Admin app
 */

import { initI18n, initLocale, t as translate } from '@angple/i18n';
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

// Initialize flag
let initialized = false;

/**
 * Initialize i18n system
 * Call this once in +layout.svelte
 */
export function setupI18n(): void {
    if (initialized) return;

    initI18n(messages);
    initLocale();
    initialized = true;
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
    LOCALE_METADATA
} from '@angple/i18n';
