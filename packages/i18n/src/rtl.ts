/**
 * RTL (Right-to-Left) 지원 유틸리티
 * 아랍어, 히브리어, 페르시아어 등 RTL 언어 지원
 */

import type { RTLLocale, SupportedLocale } from './types.js';

/** RTL 언어 목록 */
export const RTL_LOCALES: readonly RTLLocale[] = ['ar', 'he', 'fa'] as const;

/**
 * 현재 로케일이 RTL인지 확인
 * @param locale - 확인할 로케일 코드
 * @returns RTL 여부
 */
export function isRTL(locale: string): boolean {
    return RTL_LOCALES.includes(locale as RTLLocale);
}

/**
 * 로케일에 따른 방향 반환
 * @param locale - 로케일 코드
 * @returns 'rtl' 또는 'ltr'
 */
export function getDirection(locale: string): 'rtl' | 'ltr' {
    return isRTL(locale) ? 'rtl' : 'ltr';
}

/**
 * HTML 문서의 방향 및 언어 속성 설정 (브라우저 전용)
 * @param locale - 설정할 로케일 코드
 */
export function setDocumentDirection(locale: string): void {
    if (typeof document === 'undefined') return;

    const direction = getDirection(locale);
    document.documentElement.dir = direction;
    document.documentElement.lang = locale;

    // RTL/LTR 클래스 토글
    document.documentElement.classList.remove('rtl', 'ltr');
    document.documentElement.classList.add(direction);
}

/**
 * RTL용 CSS 클래스 헬퍼
 * Tailwind CSS RTL 변형과 함께 사용
 * @param locale - 현재 로케일
 * @param ltrClass - LTR용 클래스
 * @param rtlClass - RTL용 클래스
 * @returns 적절한 클래스 문자열
 */
export function rtlClass(
    locale: string,
    ltrClass: string,
    rtlClass: string
): string {
    return isRTL(locale) ? rtlClass : ltrClass;
}

/**
 * RTL 방향에 따른 마진/패딩 변환
 * @example
 * rtlSpacing('ml-4') // LTR: 'ml-4', RTL: 'mr-4'
 * rtlSpacing('pr-2') // LTR: 'pr-2', RTL: 'pl-2'
 * @param spacing - Tailwind 스페이싱 클래스
 * @param locale - 현재 로케일
 * @returns 변환된 클래스
 */
export function rtlSpacing(spacing: string, locale: string): string {
    if (!isRTL(locale)) return spacing;

    // 좌우 방향 반전
    return spacing
        .replace(/\bml-/g, '__MR__')
        .replace(/\bmr-/g, 'ml-')
        .replace(/__MR__/g, 'mr-')
        .replace(/\bpl-/g, '__PR__')
        .replace(/\bpr-/g, 'pl-')
        .replace(/__PR__/g, 'pr-')
        .replace(/\bleft-/g, '__RIGHT__')
        .replace(/\bright-/g, 'left-')
        .replace(/__RIGHT__/g, 'right-')
        .replace(/\btext-left\b/g, '__TEXT_RIGHT__')
        .replace(/\btext-right\b/g, 'text-left')
        .replace(/__TEXT_RIGHT__/g, 'text-right');
}

/**
 * RTL 방향에 따른 flex/grid 정렬 변환
 * @example
 * rtlAlign('justify-start') // LTR: 'justify-start', RTL: 'justify-end'
 * @param align - Tailwind 정렬 클래스
 * @param locale - 현재 로케일
 * @returns 변환된 클래스
 */
export function rtlAlign(align: string, locale: string): string {
    if (!isRTL(locale)) return align;

    return align
        .replace(/\bjustify-start\b/g, '__JUSTIFY_END__')
        .replace(/\bjustify-end\b/g, 'justify-start')
        .replace(/__JUSTIFY_END__/g, 'justify-end')
        .replace(/\bitems-start\b/g, '__ITEMS_END__')
        .replace(/\bitems-end\b/g, 'items-start')
        .replace(/__ITEMS_END__/g, 'items-end');
}

/**
 * SVG 아이콘의 RTL 변환 스타일
 * 방향성 아이콘 (화살표 등)에 사용
 * @param locale - 현재 로케일
 * @returns CSS transform 스타일 객체
 */
export function rtlIconTransform(locale: string): Record<string, string> {
    if (!isRTL(locale)) return {};
    return { transform: 'scaleX(-1)' };
}

/**
 * RTL 인라인 스타일 생성
 * @param locale - 현재 로케일
 * @returns CSS 스타일 객체
 */
export function rtlStyles(locale: string): Record<string, string> {
    return {
        direction: getDirection(locale),
        textAlign: isRTL(locale) ? 'right' : 'left'
    };
}

/**
 * RTL 언어에서 숫자 형식 유지
 * 아랍어 등에서 숫자는 LTR로 유지해야 함
 * @param text - 원본 텍스트
 * @param locale - 현재 로케일
 * @returns 숫자 방향이 보정된 텍스트
 */
export function preserveNumberDirection(text: string, locale: string): string {
    if (!isRTL(locale)) return text;

    // 숫자 시퀀스를 LTR mark로 감싸기
    return text.replace(/(\d+)/g, '\u200E$1\u200E');
}

/**
 * Tailwind RTL 플러그인 클래스 헬퍼
 * tailwindcss-rtl 플러그인의 start/end 유틸리티 생성
 */
export const rtlTailwind = {
    /** ms-* (margin-inline-start) */
    marginStart: (size: string) => `ms-${size}`,
    /** me-* (margin-inline-end) */
    marginEnd: (size: string) => `me-${size}`,
    /** ps-* (padding-inline-start) */
    paddingStart: (size: string) => `ps-${size}`,
    /** pe-* (padding-inline-end) */
    paddingEnd: (size: string) => `pe-${size}`,
    /** start-* (inset-inline-start) */
    start: (size: string) => `start-${size}`,
    /** end-* (inset-inline-end) */
    end: (size: string) => `end-${size}`,
    /** text-start */
    textStart: 'text-start',
    /** text-end */
    textEnd: 'text-end',
    /** border-s-* (border-inline-start) */
    borderStart: (size: string) => `border-s-${size}`,
    /** border-e-* (border-inline-end) */
    borderEnd: (size: string) => `border-e-${size}`,
    /** rounded-s-* (border-start-radius) */
    roundedStart: (size: string) => `rounded-s-${size}`,
    /** rounded-e-* (border-end-radius) */
    roundedEnd: (size: string) => `rounded-e-${size}`
} as const;
