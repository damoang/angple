import { isWikiangLookup, wikiangDocumentUrl, wikiSourceTitle } from './wikiang-source';

const BADGE_CLASS = 'wikiang-link';

/** 원문 링크를 유지하고, 공개 조회가 성공한 제목에만 외부 위키 참고 링크를 붙인다. */
export async function enhanceWikiangLinks(container: HTMLElement): Promise<void> {
    const byTitle = new Map<string, HTMLAnchorElement[]>();
    for (const anchor of container.querySelectorAll<HTMLAnchorElement>(
        'a[href]:not([data-wikiang])'
    )) {
        if (anchor.classList.contains(BADGE_CLASS)) continue;
        const title = wikiSourceTitle(anchor.href);
        if (!title || (!byTitle.has(title) && byTitle.size >= 20)) continue;
        anchor.dataset.wikiang = 'pending';
        const list = byTitle.get(title) ?? [];
        list.push(anchor);
        byTitle.set(title, list);
    }
    if (!byTitle.size) return;
    const titles = [...byTitle.keys()];
    try {
        const query = new URLSearchParams();
        for (const title of titles) query.append('title', title);
        const response = await fetch(`/api/wikiang/exists?${query}`);
        if (!response.ok) throw new Error('lookup unavailable');
        const data: unknown = await response.json();
        if (!isWikiangLookup(data, titles)) throw new Error('invalid lookup');
        const paths = new Map(data.pages.map((page) => [page.title, page.path]));
        for (const [title, anchors] of byTitle) {
            const path = paths.get(title);
            const href = path ? wikiangDocumentUrl(path) : null;
            for (const anchor of anchors) {
                if (!container.contains(anchor) || wikiSourceTitle(anchor.href) !== title) {
                    delete anchor.dataset.wikiang;
                    continue;
                }
                anchor.dataset.wikiang = '1';
                if (anchor.nextElementSibling?.classList.contains(BADGE_CLASS)) continue;
                const badge = document.createElement('a');
                badge.className = BADGE_CLASS;
                badge.href =
                    href ?? `https://wikiang.org/Special:Search?q=${encodeURIComponent(title)}`;
                badge.target = '_blank';
                badge.rel = 'noopener noreferrer';
                badge.textContent = href ? '위키앙 문서 보기' : '위키앙에서 검색';
                anchor.after(badge);
            }
        }
    } catch {
        // 장애·부분 응답에서는 배지를 생략한다. 다음 렌더에서 재시도할 수 있다.
        for (const anchors of byTitle.values()) {
            for (const anchor of anchors) delete anchor.dataset.wikiang;
        }
    }
}
