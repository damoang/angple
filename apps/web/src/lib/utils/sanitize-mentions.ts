/**
 * 글 등록 시 관리자 멘션을 일반 텍스트로 치환하는 방어 로직
 * Tiptap Mention 노드: <span data-type="mention" data-id="adminId">@닉네임</span> → 닉네임
 */

const MENTION_PATTERN =
    /<span[^>]*data-type="mention"[^>]*data-id="([^"]+)"[^>]*>@?([^<]*)<\/span>/g;

/**
 * HTML 콘텐츠에서 관리자 멘션 노드를 일반 텍스트로 치환
 */
export async function stripAdminMentions(html: string): Promise<string> {
    // 멘션 노드에서 ID 추출
    const ids = new Set<string>();
    let match;
    const regex = new RegExp(MENTION_PATTERN.source, 'g');
    while ((match = regex.exec(html)) !== null) {
        ids.add(match[1]);
    }

    if (ids.size === 0) return html;

    try {
        const res = await fetch('/api/members/check-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: [...ids] })
        });

        if (!res.ok) return html;

        const { adminIds } = await res.json();
        if (!adminIds || adminIds.length === 0) return html;

        const adminSet = new Set<string>(adminIds);

        return html.replace(
            new RegExp(MENTION_PATTERN.source, 'g'),
            (fullMatch: string, id: string, label: string) => {
                if (adminSet.has(id)) {
                    return label; // @ 제거, span 제거 → 일반 텍스트만
                }
                return fullMatch;
            }
        );
    } catch {
        return html; // 실패 시 원본 유지
    }
}
