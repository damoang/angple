/**
 * 이모티콘 API 클라이언트
 */

import type { EmoticonPack, EmoticonItem } from './types';

/**
 * 브라우저에서는 상대 경로 사용 (nginx/Vite 프록시를 통해 백엔드로 전달)
 * SSR에서는 내부 URL 사용
 */
const PLUGIN_API =
    typeof window !== 'undefined'
        ? '/api/plugins/emoticon'
        : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8082'}/api/plugins/emoticon`;

/**
 * 활성 팩 목록 조회
 */
export async function fetchPacks(): Promise<EmoticonPack[]> {
    const res = await fetch(`${PLUGIN_API}/packs`);
    if (!res.ok) throw new Error('팩 목록 조회 실패');
    const data = await res.json();
    return data.packs;
}

/**
 * 팩 내 아이템 목록 조회
 */
export async function fetchPackItems(slug: string): Promise<EmoticonItem[]> {
    const res = await fetch(`${PLUGIN_API}/packs/${encodeURIComponent(slug)}/items`);
    if (!res.ok) throw new Error('아이템 목록 조회 실패');
    const data = await res.json();
    return data.items;
}

/**
 * 이모티콘 이미지 URL 생성
 */
export function getImageUrl(filename: string): string {
    return `${PLUGIN_API}/image/${encodeURIComponent(filename)}`;
}

/**
 * 이모티콘 썸네일 URL 생성
 */
export function getThumbUrl(filename: string): string {
    return `${PLUGIN_API}/thumb/${encodeURIComponent(filename)}`;
}

/**
 * 이모티콘 코드 생성 (에디터 삽입용)
 */
export function buildEmoticonCode(filename: string, width: number = 50): string {
    return `{emo:${filename}:${width}}`;
}

/**
 * API 베이스 URL 반환
 */
export function getApiBaseUrl(): string {
    return PLUGIN_API;
}
