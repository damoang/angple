/**
 * Instagram 임베드 높이 자동 조정 — twitter-resize.ts(#13049)와 동일 패턴.
 *
 * instagram.ts 는 embed.js 없이 /embed/captioned/ iframe 을 직접 삽입한다.
 * 이 iframe 은 렌더 후 실제 높이를 부모 창에 JSON 문자열
 * `{"type":"MEASURE","details":{"height":N}}` postMessage 로 알리는데,
 * 받는 리스너가 없어 min-height 400px 에 머물고 긴 게시물·릴스는
 * 내부 스크롤로 잘려 보였다(X 는 되는데 인스타는 안 되던 이유).
 * 전역 리스너 하나로 모든 인스타 iframe 의 실제 높이를 반영한다.
 */

const INSTAGRAM_ORIGIN = 'https://www.instagram.com';

let installed = false;

export function initInstagramEmbedResize(): void {
    if (typeof window === 'undefined' || installed) return;
    installed = true;

    window.addEventListener('message', (event: MessageEvent) => {
        if (event.origin !== INSTAGRAM_ORIGIN) return;
        // 인스타는 데이터를 JSON "문자열"로 보낸다 (트위터의 객체와 다름)
        let parsed: { type?: string; details?: { height?: number } } | null = null;
        if (typeof event.data === 'string') {
            try {
                parsed = JSON.parse(event.data);
            } catch {
                return;
            }
        }
        if (!parsed || parsed.type !== 'MEASURE') return;
        const height = parsed.details?.height;
        if (typeof height !== 'number' || height <= 0) return;

        const iframes = document.querySelectorAll<HTMLIFrameElement>(
            `iframe[src^="${INSTAGRAM_ORIGIN}/"]`
        );
        for (const frame of iframes) {
            if (frame.contentWindow !== event.source) continue;
            frame.style.height = `${height}px`;
            frame.style.minHeight = `${height}px`;
            // 표면별 CSS(embed-container·comment-list)가 이 변수를 읽는다.
            frame
                .closest<HTMLElement>('.embed-container')
                ?.style.setProperty('--instagram-embed-height', `${height}px`);
            break;
        }
    });
}
