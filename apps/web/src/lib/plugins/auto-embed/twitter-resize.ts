/**
 * X(트위터) 임베드 높이 자동 조정 (#13049)
 *
 * twitter.ts 는 widgets.js 없이 Tweet.html iframe 을 직접 삽입한다.
 * Tweet.html 은 렌더 후 실제 높이를 부모 창에 postMessage(twttr.private.resize)로
 * 알리는데, 이를 받는 리스너가 없어 컨테이너가 기본 높이(min 250px)에 머물고
 * 긴 트윗(이미지 포함 등)은 iframe 내부 스크롤로 잘려 보였다.
 * 전역 리스너 하나로 모든 트윗 iframe 의 실제 높이를 반영한다.
 */

const TWITTER_ORIGIN = 'https://platform.twitter.com';

let installed = false;

interface TwttrEmbedMessage {
    method?: string;
    params?: Array<{ height?: number }>;
}

export function initTwitterEmbedResize(): void {
    if (typeof window === 'undefined' || installed) return;
    installed = true;

    window.addEventListener('message', (event: MessageEvent) => {
        if (event.origin !== TWITTER_ORIGIN) return;
        const embed = (event.data as Record<string, unknown> | null)?.['twttr.embed'] as
            | TwttrEmbedMessage
            | undefined;
        if (!embed || embed.method !== 'twttr.private.resize') return;
        const height = embed.params?.[0]?.height;
        if (typeof height !== 'number' || height <= 0) return;

        const iframes = document.querySelectorAll<HTMLIFrameElement>(
            `iframe[src^="${TWITTER_ORIGIN}/embed/"]`
        );
        for (const frame of iframes) {
            if (frame.contentWindow !== event.source) continue;
            frame.style.height = `${height}px`;
            frame.style.minHeight = `${height}px`;
            // EmbedContainer CSS 가 --twitter-embed-height 변수를 읽는다.
            frame
                .closest<HTMLElement>('.embed-container')
                ?.style.setProperty('--twitter-embed-height', `${height}px`);
            break;
        }
    });
}
