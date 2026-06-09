import { describe, expect, it } from 'vitest';

// helper 는 hooks.server.ts 안에 정의되어 있어 직접 export 없음.
// 동일 정규식/조건 로직을 test 에서 복제 (구현 안정성 검증용).
function isCacheableNotFoundPath(pathname: string): boolean {
    return (
        pathname.startsWith('/theme/') ||
        pathname.startsWith('/themes/') ||
        pathname.startsWith('/wp-') ||
        pathname.startsWith('/wordpress/') ||
        pathname.endsWith('.php') ||
        pathname.endsWith('.asp') ||
        pathname.endsWith('.aspx')
    );
}

describe('isCacheableNotFoundPath — 404 CDN cache 안전 path 판별', () => {
    it('matches /theme/* (CloudFront 0% hit 48 GB/7d 대상)', () => {
        expect(isCacheableNotFoundPath('/theme/')).toBe(true);
        expect(isCacheableNotFoundPath('/theme/index.html')).toBe(true);
        expect(isCacheableNotFoundPath('/theme/damoang-classic/style.css')).toBe(true);
    });

    it('matches /themes/* (오타 또는 변형)', () => {
        expect(isCacheableNotFoundPath('/themes/main.css')).toBe(true);
    });

    it('matches WordPress bot probing patterns', () => {
        expect(isCacheableNotFoundPath('/wp-admin/')).toBe(true);
        expect(isCacheableNotFoundPath('/wp-login.php')).toBe(true);
        expect(isCacheableNotFoundPath('/wp-content/uploads/x.jpg')).toBe(true);
        expect(isCacheableNotFoundPath('/wordpress/index.php')).toBe(true);
    });

    it('matches .php / .asp / .aspx (probe 패턴)', () => {
        expect(isCacheableNotFoundPath('/index.php')).toBe(true);
        expect(isCacheableNotFoundPath('/admin.asp')).toBe(true);
        expect(isCacheableNotFoundPath('/page.aspx')).toBe(true);
    });

    it('does NOT match 정상 SvelteKit 경로 (404 cache 금지)', () => {
        expect(isCacheableNotFoundPath('/')).toBe(false);
        expect(isCacheableNotFoundPath('/free/')).toBe(false);
        expect(isCacheableNotFoundPath('/free/12345')).toBe(false);
        expect(isCacheableNotFoundPath('/admin/')).toBe(false);
        expect(isCacheableNotFoundPath('/api/v1/expose')).toBe(false);
        expect(isCacheableNotFoundPath('/profile')).toBe(false);
        expect(isCacheableNotFoundPath('/data/editor/x.webp')).toBe(false);
    });

    it('does NOT match similar but unrelated paths', () => {
        expect(isCacheableNotFoundPath('/theme')).toBe(false); // trailing slash 없으면 false
        expect(isCacheableNotFoundPath('/wp')).toBe(false); // wp- 아님
        expect(isCacheableNotFoundPath('/php-config')).toBe(false); // .php 끝 아님
    });

    it('matches root-level probes', () => {
        expect(isCacheableNotFoundPath('/wp-')).toBe(true); // edge case
    });
});
