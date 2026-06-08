/**
 * tag-nav(상단 빠른 이동) 메뉴 타입 + 기본값.
 *
 * 단일 출처(single source of truth): tag-nav.svelte 의 런타임 폴백과 admin
 * 편집기의 "기본값 불러오기" 가 동일 목록을 공유하도록 여기로 분리한다.
 * widget.json 의 settings.menus.default 도 이 목록과 동일하게 유지한다.
 */
export interface TagNavMenu {
    key: string;
    text: string;
    url: string;
    show: boolean;
}

export const DEFAULT_TAG_NAV_MENUS: TagNavMenu[] = [
    { key: 'explore', text: '모아보기', url: '/explore', show: true },
    { key: 'empathy', text: '공감글', url: '/empathy', show: true },
    { key: 'group', text: '소모임', url: '/groups', show: true },
    { key: 'free', text: '자유게시판', url: '/free', show: true },
    { key: 'qa', text: '질문답변', url: '/qa', show: true },
    { key: 'new', text: '새소식', url: '/new', show: true },
    { key: 'economy', text: '알뜰구매', url: '/economy', show: true },
    { key: 'promotion', text: '직접홍보', url: '/promotion', show: true },
    { key: 'lecture', text: '강좌팁', url: '/lecture', show: true },
    { key: 'tutorial', text: '사용기', url: '/tutorial', show: true },
    { key: 'message', text: '마음메시지', url: '/message', show: true },
    { key: 'giving', text: '나눔', url: '/giving', show: true },
    { key: 'angmap', text: '앙지도', url: '/angmap', show: true },
    { key: 'angtt', text: '앙티티', url: '/angtt', show: true }
];
