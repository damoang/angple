function isLocalhost(hostname: string): boolean {
    const host = hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

function decodeAmpEntity(value: string): string {
    return value.replaceAll('&amp;', '&').trim();
}

type NormalizeUrlOptions = {
    baseOrigin?: string;
    enforceHttps?: boolean;
};

/**
 * URL 문자열을 브라우저/SSR 환경에서 일관되게 정규화한다.
 * - &amp; 디코딩
 * - protocol-relative(//) 지원
 * - 비 localhost 호스트의 http -> https 업그레이드(기본)
 */
export function normalizeWebUrl(rawUrl: string, options: NormalizeUrlOptions = {}): string {
    const { baseOrigin, enforceHttps = true } = options;
    const decoded = decodeAmpEntity(rawUrl);

    try {
        const fallbackOrigin = baseOrigin ?? 'https://damoang.net';
        const absolute = new URL(decoded, fallbackOrigin);

        if (enforceHttps && absolute.protocol === 'http:' && !isLocalhost(absolute.hostname)) {
            absolute.protocol = 'https:';
        }

        return absolute.toString();
    } catch {
        return decoded;
    }
}

/**
 * 같은 origin이면 상대경로(path+query+hash)로 변환한다.
 */
export function toRelativeIfSameOrigin(url: string, origin: string): string {
    try {
        const absolute = new URL(url, origin);
        if (absolute.origin === origin) {
            return `${absolute.pathname}${absolute.search}${absolute.hash}`;
        }
        return absolute.toString();
    } catch {
        return url;
    }
}

