/**
 * 지원 언어 메타데이터
 */

import type { LocaleMetadata, SupportedLocale } from './types.js';

/** 지원 언어 목록 */
export const SUPPORTED_LOCALES: readonly SupportedLocale[] = [
    'en',
    'ko',
    'ja',
    'zh',
    'es',
    'ar',
    'vi'
] as const;

/** 기본 언어 */
export const DEFAULT_LOCALE: SupportedLocale = 'en';

/** 언어별 메타데이터 */
export const LOCALE_METADATA: Record<SupportedLocale, LocaleMetadata> = {
    en: {
        code: 'en',
        name: 'English',
        englishName: 'English',
        flag: '🇺🇸',
        isRTL: false,
        region: 'US'
    },
    ko: {
        code: 'ko',
        name: '한국어',
        englishName: 'Korean',
        flag: '🇰🇷',
        isRTL: false,
        region: 'KR'
    },
    ja: {
        code: 'ja',
        name: '日本語',
        englishName: 'Japanese',
        flag: '🇯🇵',
        isRTL: false,
        region: 'JP'
    },
    zh: {
        code: 'zh',
        name: '中文',
        englishName: 'Chinese',
        flag: '🇨🇳',
        isRTL: false,
        region: 'CN'
    },
    es: {
        code: 'es',
        name: 'Español',
        englishName: 'Spanish',
        flag: '🇪🇸',
        isRTL: false,
        region: 'ES'
    },
    ar: {
        code: 'ar',
        name: 'العربية',
        englishName: 'Arabic',
        flag: '🇸🇦',
        isRTL: true,
        region: 'SA'
    },
    vi: {
        code: 'vi',
        name: 'Tiếng Việt',
        englishName: 'Vietnamese',
        flag: '🇻🇳',
        isRTL: false,
        region: 'VN'
    }
} as const;

/**
 * 로케일 코드가 유효한지 확인
 * @param locale - 확인할 로케일 코드
 * @returns 유효 여부
 */
export function isValidLocale(locale: string): locale is SupportedLocale {
    return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

/**
 * 로케일 메타데이터 조회
 * @param locale - 로케일 코드
 * @returns 메타데이터 또는 기본 언어 메타데이터
 */
export function getLocaleMetadata(locale: string): LocaleMetadata {
    if (isValidLocale(locale)) {
        return LOCALE_METADATA[locale];
    }
    return LOCALE_METADATA[DEFAULT_LOCALE];
}

/**
 * 브라우저 언어 설정에서 지원 언어 찾기
 * @param acceptLanguage - Accept-Language 헤더 또는 navigator.language
 * @returns 매칭된 로케일 또는 기본 언어
 */
export function detectLocaleFromHeader(acceptLanguage: string): SupportedLocale {
    // Accept-Language 파싱 (예: "ko-KR,ko;q=0.9,en;q=0.8")
    const languages = acceptLanguage
        .split(',')
        .map((lang) => {
            const [code, quality] = lang.trim().split(';q=');
            return {
                code: code.split('-')[0].toLowerCase(), // "ko-KR" -> "ko"
                quality: quality ? parseFloat(quality) : 1
            };
        })
        .sort((a, b) => b.quality - a.quality);

    // 지원 언어와 매칭
    for (const { code } of languages) {
        if (isValidLocale(code)) {
            return code;
        }
    }

    return DEFAULT_LOCALE;
}

/**
 * 설치 시 언어 선택 옵션 목록
 * 네이티브 이름과 영어 이름을 모두 표시
 */
export function getLanguageOptions(): Array<{
    code: SupportedLocale;
    label: string;
    flag: string;
    isRTL: boolean;
}> {
    return SUPPORTED_LOCALES.map((code) => {
        const meta = LOCALE_METADATA[code];
        return {
            code,
            label:
                meta.name === meta.englishName
                    ? meta.name
                    : `${meta.name} (${meta.englishName})`,
            flag: meta.flag,
            isRTL: meta.isRTL
        };
    });
}
