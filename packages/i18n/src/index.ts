/**
 * @angple/i18n
 * Angple 국제화 시스템
 *
 * @example
 * ```typescript
 * import { isRTL, getLocaleMetadata, SUPPORTED_LOCALES } from '@angple/i18n';
 *
 * // RTL 확인
 * if (isRTL('ar')) {
 *   console.log('아랍어는 RTL입니다');
 * }
 *
 * // 언어 메타데이터 조회
 * const meta = getLocaleMetadata('ko');
 * console.log(meta.name); // '한국어'
 * ```
 */

// Types
export type {
    SupportedLocale,
    RTLLocale,
    LocaleMetadata,
    TranslationNamespaces,
    CommonTranslations,
    AdminTranslations,
    InstallTranslations,
    AuthTranslations,
    BoardTranslations,
    ThemeTranslations,
    PluginTranslations,
    ErrorTranslations,
    I18nConfig
} from './types.js';

// RTL utilities
export {
    RTL_LOCALES,
    isRTL,
    getDirection,
    setDocumentDirection,
    rtlClass,
    rtlSpacing,
    rtlAlign,
    rtlIconTransform,
    rtlStyles,
    preserveNumberDirection,
    rtlTailwind
} from './rtl.js';

// Locale utilities
export {
    SUPPORTED_LOCALES,
    DEFAULT_LOCALE,
    LOCALE_METADATA,
    isValidLocale,
    getLocaleMetadata,
    detectLocaleFromHeader,
    getLanguageOptions
} from './locales.js';

// Config utilities
export {
    DEFAULT_I18N_CONFIG,
    LOCALE_COOKIE_NAME,
    LOCALE_STORAGE_KEY,
    mergeI18nConfig,
    extractLocaleFromPath,
    localizedPath
} from './config.js';
