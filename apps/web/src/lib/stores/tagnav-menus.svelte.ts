/**
 * 상단 tag-nav 메뉴 스토어 (SSR 주입).
 *
 * +layout.server.ts 가 menus 테이블(show_in_tagnav)에서 로드한 tag-nav 메뉴를
 * +layout.svelte 에서 이 스토어에 넣고, tag-nav.svelte 가 소비한다.
 * null 이면(로드 실패/빈 목록/데이터 전용 요청) tag-nav 가 하드코딩 폴백을 쓴다.
 */
import type { TagNavMenu } from '$lib/components/ui/tag-nav/default-menus';

class TagNavMenusStore {
    menus = $state<TagNavMenu[] | null>(null);

    /** SSR 레이아웃 데이터로 초기화. 빈 배열/null 은 null 로 정규화(폴백 유도). */
    init(menus: TagNavMenu[] | null | undefined): void {
        this.menus = menus && menus.length > 0 ? menus : null;
    }
}

export const tagNavMenusStore = new TagNavMenusStore();
