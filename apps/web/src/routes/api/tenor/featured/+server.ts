/**
 * trending/featured GIF API 프록시 (KLIPY — Tenor 호환 v2 엔드포인트)
 * KLIPY_API_KEY를 서버 사이드에서만 사용하여 클라이언트 노출 방지.
 * Tenor API 종료(2026-06-30)에 따라 KLIPY(api.klipy.com)로 이관.
 */
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

const GIF_API_URL = 'https://api.klipy.com/v2/featured';

export const GET: RequestHandler = async ({ url }) => {
    const apiKey = env.KLIPY_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ results: [], next: '' }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const pos = url.searchParams.get('pos') || '';

    const params = new URLSearchParams({
        key: apiKey,
        limit: '20',
        media_filter: 'gif,tinygif',
        locale: 'ko_KR'
    });
    if (pos) params.set('pos', pos);

    try {
        const res = await fetch(`${GIF_API_URL}?${params.toString()}`);
        if (!res.ok) {
            return new Response(JSON.stringify({ results: [], next: '' }), {
                status: res.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const data = await res.json();
        const results = (data.results ?? []).map((item: Record<string, unknown>) => {
            const media = item.media_formats as Record<string, { url: string; dims?: number[] }>;
            const gif = media?.gif;
            const tinygif = media?.tinygif;
            return {
                id: item.id,
                title: item.title || '',
                url: gif?.url || '',
                preview_url: tinygif?.url || gif?.url || '',
                width: gif?.dims?.[0] || 0,
                height: gif?.dims?.[1] || 0
            };
        });

        return new Response(JSON.stringify({ results, next: data.next || '' }), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=300'
            }
        });
    } catch {
        return new Response(JSON.stringify({ results: [], next: '' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
