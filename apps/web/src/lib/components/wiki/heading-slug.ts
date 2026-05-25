/**
 * 위키 목차(TOC) ↔ 본문 헤딩 앵커 공용 유틸.
 * TOC 링크와 렌더된 헤딩 element 의 id 가 동일 slug 로 매칭되어야 스크롤이 동작한다.
 */

export interface TocItem {
    level: number; // 2~4
    text: string;
    slug: string;
}

/** 제목 텍스트 → 앵커 id (한글 포함). 중복은 호출측에서 -2, -3 처리. */
export function slugify(text: string): string {
    return (
        text
            .trim()
            .toLowerCase()
            // 문자/숫자(유니코드, 한글 포함) 외 → 하이픈
            .replace(/[^\p{L}\p{N}]+/gu, '-')
            .replace(/^-+|-+$/g, '') || 'section'
    );
}

/**
 * 마크다운 원문에서 h2~h4 헤딩 추출 (코드펜스 내부 제외). slug 중복 방지.
 */
export function parseMarkdownHeadings(md: string): TocItem[] {
    if (!md) return [];
    const items: TocItem[] = [];
    const seen = new Map<string, number>();
    let inFence = false;

    for (const line of md.split('\n')) {
        if (/^\s*(```|~~~)/.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;

        const m = /^\s{0,3}(#{2,4})\s+(.+?)\s*#*\s*$/.exec(line);
        if (!m) continue;

        const level = m[1].length;
        const text = m[2].trim();
        let slug = slugify(text);
        const n = seen.get(slug) ?? 0;
        seen.set(slug, n + 1);
        if (n > 0) slug = `${slug}-${n + 1}`;

        items.push({ level, text, slug });
    }
    return items;
}
