/**
 * trending/featured GIF API 프록시 (KLIPY)
 * KLIPY_API_KEY를 서버 사이드에서만 사용하여 클라이언트 노출 방지.
 * Tenor API 종료(2026-06-30)에 따라 KLIPY(api.klipy.com)로 이관.
 *
 * KLIPY 계약: GET https://api.klipy.com/api/v1/{KEY}/gifs/trending?per_page=&page=&customer_id=
 * 키는 경로(path)에 포함, 응답은 data.data[] 에 항목, 각 항목은 file.{hd|md|sm|xs}.{gif|webp|mp4}.{url,width,height}.
 * 클라이언트 응답 형태({ results:[{id,title,url,preview_url,width,height}], next })는 기존 그대로 유지.
 */
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

const KLIPY_BASE = 'https://api.klipy.com/api/v1';
// KLIPY 분석/식별용 customer_id (개인정보 아님, 고정값). 추후 사용자별 식별이 필요하면 교체.
const CUSTOMER_ID = 'damoang-web';
const PER_PAGE = 20;

interface KlipyGif {
    url?: string;
    width?: number;
    height?: number;
}
interface KlipyFileSize {
    gif?: KlipyGif;
}
interface KlipyItem {
    id?: number | string;
    title?: string;
    file?: Record<string, KlipyFileSize>;
}

// 지정한 사이즈 우선순위로 gif 포맷을 고른다 (없으면 다음 사이즈로 폴백).
function pickGif(
    file: Record<string, KlipyFileSize> | undefined,
    sizes: string[]
): KlipyGif | null {
    if (!file) return null;
    for (const s of sizes) {
        const g = file[s]?.gif;
        if (g?.url) return g;
    }
    return null;
}

export const GET: RequestHandler = async ({ url }) => {
    const apiKey = env.KLIPY_API_KEY;
    if (!apiKey) {
        return new Response(JSON.stringify({ results: [], next: '' }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // 기존 클라이언트는 페이지 커서를 pos 로 전달 → KLIPY 의 page 번호로 매핑.
    const pos = url.searchParams.get('pos') || '';
    const page = pos && /^\d+$/.test(pos) ? Number(pos) : 1;

    const params = new URLSearchParams({
        per_page: String(PER_PAGE),
        page: String(page),
        customer_id: CUSTOMER_ID
    });
    const endpoint = `${KLIPY_BASE}/${apiKey}/gifs/trending?${params.toString()}`;

    try {
        const res = await fetch(endpoint);
        if (!res.ok) {
            return new Response(JSON.stringify({ results: [], next: '' }), {
                status: res.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const json = await res.json();
        if (!json?.result) {
            return new Response(JSON.stringify({ results: [], next: '' }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const payload = json.data ?? {};
        const items: KlipyItem[] = Array.isArray(payload.data) ? payload.data : [];

        const results = items
            .map((item) => {
                const main = pickGif(item.file, ['md', 'hd', 'sm', 'xs']);
                const preview = pickGif(item.file, ['sm', 'xs', 'md', 'hd']);
                return {
                    id: item.id,
                    title: item.title || '',
                    url: main?.url || '',
                    preview_url: preview?.url || main?.url || '',
                    width: main?.width || 0,
                    height: main?.height || 0
                };
            })
            .filter((r) => r.url);

        const currentPage = Number(payload.current_page) || page;
        const hasNext =
            typeof payload.has_next === 'boolean' ? payload.has_next : items.length >= PER_PAGE;
        const next = hasNext ? String(currentPage + 1) : '';

        return new Response(JSON.stringify({ results, next }), {
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
