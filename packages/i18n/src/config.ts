/**
 * i18n 기본 설정
 */

import type { I18nConfig, SupportedLocale } from './types.js';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from './locales.js';

/** 기본 i18n 설정 */
export const DEFAULT_I18N_CONFIG: I18nConfig = {
    defaultLocale: DEFAULT_LOCALE,
    supportedLocales: [...SUPPORTED_LOCALES],
    detection: {
        fromPath: true,
        fromCookie: true,
        fromHeader: true,
        fromNavigator: true
    },
    cookie: {
        name: 'angple_locale',
        maxAge: 60 * 60 * 24 * 365, // 1년
        path: '/',
        secure: true,
        sameSite: 'lax'
    },
    fallback: {
        locale: DEFAULT_LOCALE,
        showKey: false
    }
};

/** 쿠키 이름 상수 */
export const LOCALE_COOKIE_NAME = 'angple_locale';

/** 로컬 스토리지 키 */
export const LOCALE_STORAGE_KEY = 'angple_locale';

/**
 * i18n 설정 병합
 * @param customConfig - 사용자 정의 설정
 * @returns 병합된 설정
 */
export function mergeI18nConfig(
    customConfig: Partial<I18nConfig>
): I18nConfig {
    return {
        ...DEFAULT_I18N_CONFIG,
        ...customConfig,
        detection: {
            ...DEFAULT_I18N_CONFIG.detection,
            ...customConfig.detection
        },
        cookie: {
            ...DEFAULT_I18N_CONFIG.cookie,
            ...customConfig.cookie
        },
        fallback: {
            ...DEFAULT_I18N_CONFIG.fallback,
            ...customConfig.fallback
        }
    };
}

/**
 * URL 경로에서 로케일 추출
 * @param pathname - URL 경로 (예: "/ko/about")
 * @param supportedLocales - 지원 로케일 목록
 * @returns 추출된 로케일 또는 null
 */
export function extractLocaleFromPath(
    pathname: string,
    supportedLocales: readonly SupportedLocale[] = SUPPORTED_LOCALES
): SupportedLocale | null {
    const segments = pathname.split('/').filter(Boolean);
    const firstSegment = segments[0]?.toLowerCase();

    if (firstSegment && supportedLocales.includes(firstSegment as SupportedLocale)) {
        return firstSegment as SupportedLocale;
    }

    return null;
}

/**
 * 로케일이 포함된 경로 생성
 * @param pathname - 원본 경로
 * @param locale - 추가할 로케일
 * @param defaultLocale - 기본 로케일 (생략 가능)
 * @returns 로케일이 포함된 경로
 */
export function localizedPath(
    pathname: string,
    locale: SupportedLocale,
    defaultLocale: SupportedLocale = DEFAULT_LOCALE
): string {
    // 이미 로케일이 포함되어 있으면 교체
    const currentLocale = extractLocaleFromPath(pathname);
    let cleanPath = pathname;

    if (currentLocale) {
        cleanPath = pathname.replace(new RegExp(`^/${currentLocale}`), '');
    }

    // 기본 로케일은 경로에 포함하지 않음 (선택적)
    if (locale === defaultLocale) {
        return cleanPath || '/';
    }

    return `/${locale}${cleanPath || ''}`;
}
