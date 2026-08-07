/**
 * 멘션 클릭을 data-id(mb_id)로 보정한다 (bug/13396).
 *
 * TipTap 멘션 스팬은 정확한 mb_id 를 data-id 로 들고 있는데, 렌더 후처리
 * (highlightMentions)가 스팬 **안의 텍스트**를 닉네임 기반 /member/<nick> 링크로
 * 다시 감싼다. 닉네임에 보이지 않는 문자(U+2800 등)가 있으면 정규식이 중간에서
 * 끊겨 존재하지 않는 주소가 되고 "회원을 찾을 수 없습니다"가 뜬다.
 *
 * 여기서는 스팬이 이미 아는 mb_id 로 href 를 덮어쓴다 — 닉네임이 어떻든 정확하다.
 * 위키앙 배지와 같은 렌더 후 보정 패턴 · 두 표면(본문/댓글) 각각에서 호출된다.
 */
export function fixMentionLinks(container: HTMLElement): void {
    const spans = container.querySelectorAll<HTMLElement>(
        'span.mention[data-id]:not([data-mfix])'
    );
    spans.forEach((sp) => {
        sp.dataset.mfix = '1';
        const id = sp.dataset.id;
        if (!id) return;
        const href = `/member/${encodeURIComponent(id)}`;
        const inner = sp.querySelectorAll<HTMLAnchorElement>('a');
        if (inner.length > 0) {
            inner.forEach((a) => (a.href = href));
        } else {
            // 안에 링크가 없으면 스팬 자체를 클릭 가능하게
            const a = document.createElement('a');
            a.href = href;
            a.className = 'mention-link';
            while (sp.firstChild) a.appendChild(sp.firstChild);
            sp.appendChild(a);
        }
    });
}
