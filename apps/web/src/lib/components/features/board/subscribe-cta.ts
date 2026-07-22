/**
 * 소모임 구독 CTA 문구 유틸 (순수 로직)
 *
 * board-subscribe-button.svelte 의 prominent(소모임) 변형에서 사용.
 * 구독을 "멤버십"처럼 보이게 하는 라벨/구독자수 표기를 순수 함수로 분리해 테스트한다.
 */

/** 소모임 게시판 여부 — group_id 가 'group' 인 게시판만 CTA 강화 대상 */
export function isGroupBoard(groupId: string | null | undefined): boolean {
    return groupId === 'group';
}

/** 구독자수를 "멤버 N명" 형태로 표기. 음수/비유한수는 0으로 방어. */
export function formatMemberCount(count: number): string {
    const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
    return `멤버 ${n.toLocaleString('ko-KR')}명`;
}

/** 구독 여부에 따른 CTA 라벨 */
export function subscribeCtaLabel(isSubscribed: boolean): string {
    return isSubscribed ? '멤버' : '소모임 구독';
}

/**
 * prominent 버튼 title(툴팁) 문구.
 * 구독 중이면 멤버로서 상태를, 아니면 가입 유도를 보여준다.
 */
export function subscribeCtaTitle(
    boardTitle: string,
    isSubscribed: boolean,
    subscriberCount: number
): string {
    const memberText = formatMemberCount(subscriberCount);
    if (isSubscribed) {
        return `'${boardTitle}' 멤버 (${memberText}) — 클릭하여 알림 설정`;
    }
    return `'${boardTitle}' 소모임 멤버가 되어 새 글을 받아보세요 (${memberText})`;
}
