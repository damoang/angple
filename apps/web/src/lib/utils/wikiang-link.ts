/**
 * 나무위키 링크 옆 위키앙 배지 (8/7 하이브리드 승인)
 *
 * 컨테이너 안의 namu.wiki/w/ 링크를 스캔해, 문서 제목을 뽑아
 * /api/wikiang/exists 로 배치 확인한 뒤:
 *   - 위키앙에 있으면  「위키앙 문서 보기」
 *   - 없으면          「위키앙에 작성하기」  ← 막다른 길 대신 기여 유도
 * 두 경우 모두 wikiang.org/w/<제목> 으로 간다(없는 문서는 위키앙이 작성 UI 안내).
 *
 * 표면 2곳(본문 markdown.svelte · 댓글 comment-list)의 렌더 후 effect 에서 부른다.
 * 재렌더 중복 방지 = data-wikiang 마킹. 실패는 조용히(배지 생략) — 원문 영향 0.
 */
const BADGE_CLASS = 'wikiang-link';

function titleFromNamuHref(href: string): string | null {
    try {
        const u = new URL(href);
        if (!u.hostname.endsWith('namu.wiki')) return null;
        if (!u.pathname.startsWith('/w/')) return null;
        const t = decodeURIComponent(u.pathname.slice(3)).trim();
        // 앵커(#s-1)는 URL 해시라 pathname 에 없음. 하위 문서(슬래시 포함)는 그대로 둔다.
        return t.length > 0 && t.length <= 255 ? t : null;
    } catch {
        return null;
    }
}

export async function enhanceWikiangLinks(container: HTMLElement): Promise<void> {
    const anchors = container.querySelectorAll<HTMLAnchorElement>(
        'a[href*="namu.wiki/w/"]:not([data-wikiang])'
    );
    if (anchors.length === 0) return;

    const byTitle = new Map<string, HTMLAnchorElement[]>();
    anchors.forEach((a) => {
        a.dataset.wikiang = '1';
        const t = titleFromNamuHref(a.href);
        if (!t) return;
        const list = byTitle.get(t) ?? [];
        list.push(a);
        byTitle.set(t, list);
    });
    if (byTitle.size === 0) return;

    let exists = new Set<string>();
    try {
        const titles = [...byTitle.keys()].slice(0, 20);
        const res = await fetch(
            `/api/wikiang/exists?titles=${encodeURIComponent(titles.join('|'))}`
        );
        if (res.ok) exists = new Set<string>((await res.json()).exists ?? []);
    } catch {
        // 존재 확인 실패 → 전부 '작성하기' 로 표시 (fail-open, 링크 자체는 유효)
    }

    for (const [title, list] of byTitle) {
        const has = exists.has(title);
        for (const a of list) {
            // 이미 배지가 붙은 앵커(재호출 경합) 방지
            if (a.nextElementSibling?.classList?.contains(BADGE_CLASS)) continue;
            const badge = document.createElement('a');
            badge.className = BADGE_CLASS + (has ? '' : ` ${BADGE_CLASS}--new`);
            badge.href = `https://wikiang.org/w/${encodeURIComponent(title)}`;
            badge.target = '_blank';
            badge.rel = 'noopener noreferrer';
            badge.textContent = has ? '위키앙 문서 보기' : '위키앙에 작성하기';
            a.after(badge);
        }
    }
}
