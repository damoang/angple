import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
    const siteName = import.meta.env.VITE_SITE_NAME || 'Angple';

    return json(
        {
            name: `${siteName} 종합 커뮤니티`,
            short_name: siteName,
            description: '누구나 자유롭게 커뮤니티를 만들 수 있는 오픈소스 플랫폼',
            start_url: '/',
            display: 'standalone',
            background_color: '#ffffff',
            theme_color: '#1a1a1a',
            orientation: 'natural',
            categories: ['social', 'news'],
            icons: [
                {
                    src: '/icons/icon-192.png',
                    sizes: '192x192',
                    type: 'image/png'
                },
                {
                    src: '/icons/icon-512.png',
                    sizes: '512x512',
                    type: 'image/png'
                },
                {
                    src: '/icons/icon-512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'maskable'
                }
            ]
        },
        {
            headers: {
                'Cache-Control': 'public, max-age=86400'
            }
        }
    );
};
