/**
 * 플랫폼 변환기 통합 모듈
 */

import type { PlatformConverter, AffiliatePlatform } from '../types';
import { coupangConverter } from './coupang';
import { aliexpressConverter } from './aliexpress';
import { amazonConverter } from './amazon';
import { kkdayConverter } from './kkday';
import { linkpriceConverter } from './linkprice';

/** 플랫폼 변환기 목록 (우선순위 순서) */
export const converters: PlatformConverter[] = [
    coupangConverter,
    aliexpressConverter,
    amazonConverter,
    kkdayConverter,
    linkpriceConverter // 마지막 (가장 넓은 범위)
];

/** 플랫폼별 변환기 맵 */
export const converterMap: Record<AffiliatePlatform, PlatformConverter> = {
    coupang: coupangConverter,
    aliexpress: aliexpressConverter,
    amazon: amazonConverter,
    kkday: kkdayConverter,
    linkprice: linkpriceConverter
};

/**
 * URL에 맞는 변환기 찾기
 */
export function findConverter(url: string): PlatformConverter | null {
    for (const converter of converters) {
        if (converter.matches(url)) {
            return converter;
        }
    }
    return null;
}

/**
 * 특정 플랫폼의 변환기 가져오기
 */
export function getConverter(platform: AffiliatePlatform): PlatformConverter {
    return converterMap[platform];
}

export { coupangConverter, aliexpressConverter, amazonConverter, kkdayConverter, linkpriceConverter };
