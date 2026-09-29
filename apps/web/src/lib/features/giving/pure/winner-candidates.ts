/**
 * 주최자 지정형(큐레이션·직접 지정) 나눔의 「당첨자 지정」 후보 목록 헬퍼.
 *
 * 화면에는 「닉네임 (ID)」로 보여주고, 제출 값은 언제나 mb_id 그대로다.
 * 닉네임이 없으면 mb_id 만 보여준다.
 */

export interface WinnerCandidate {
    mb_id: string;
    nick: string;
}

/**
 * 백엔드 후보 목록(candidates)이 있으면 그것을, 없으면(구 응답) 참가자 mb_id 목록을
 * 닉네임 없이 후보로 쓴다. 빈 값·중복은 버린다.
 */
export function toWinnerCandidates(
    candidates: ReadonlyArray<{ mb_id: string; nick?: string | null }> | null | undefined,
    participants: ReadonlyArray<string> | null | undefined
): WinnerCandidate[] {
    const out: WinnerCandidate[] = [];
    const seen = new Set<string>();
    const src =
        candidates && candidates.length > 0
            ? candidates
            : (participants ?? []).map((id) => ({ mb_id: id, nick: '' }));
    for (const c of src) {
        const id = (c.mb_id ?? '').trim();
        if (!id || seen.has(id)) continue;
        seen.add(id);
        out.push({ mb_id: id, nick: (c.nick ?? '').trim() });
    }
    return out;
}

/** 「닉네임 (ID)」. 닉네임이 없거나 ID 와 같으면 ID 만. */
export function winnerCandidateLabel(c: WinnerCandidate): string {
    return c.nick && c.nick !== c.mb_id ? `${c.nick} (${c.mb_id})` : c.mb_id;
}

/**
 * 닉네임 또는 ID 일부로 거른다(대소문자 무시, 앞뒤 공백 무시).
 * 입력이 비었거나 이미 고른 후보의 라벨(「닉네임 (ID)」)과 정확히 같으면 전체를
 * 돌려준다 — 선택 직후 목록을 다시 열었을 때 한 명만 남지 않게.
 */
export function filterWinnerCandidates(
    list: ReadonlyArray<WinnerCandidate>,
    query: string
): WinnerCandidate[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...list];
    if (list.some((c) => c.nick && winnerCandidateLabel(c).toLowerCase() === q)) {
        return [...list];
    }
    return list.filter(
        (c) => c.mb_id.toLowerCase().includes(q) || c.nick.toLowerCase().includes(q)
    );
}

/**
 * 입력창 글자를 제출할 mb_id 로 바꾼다. 후보의 라벨·ID 와 정확히 같거나 닉네임이
 * 한 명과만 정확히 같으면 그 후보의 mb_id, 아니면 입력값 그대로(수동 ID 입력 —
 * 후보 여부는 기존대로 백엔드가 판정한다).
 */
export function resolveWinnerInput(list: ReadonlyArray<WinnerCandidate>, text: string): string {
    const t = text.trim();
    if (!t) return '';
    const byLabel = list.find((c) => c.mb_id === t || winnerCandidateLabel(c) === t);
    if (byLabel) return byLabel.mb_id;
    const byNick = list.filter((c) => c.nick && c.nick === t);
    return byNick.length === 1 ? byNick[0].mb_id : t;
}
