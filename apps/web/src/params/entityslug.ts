import type { ParamMatcher } from '@sveltejs/kit';

/**
 * 앙티티 작품 페이지 slug 매처.
 * ⚠️ /angtt/{숫자}는 angtt "게시판 글"(gnuboard g5_write_angtt, [boardId]/[postId])이므로,
 * 작품 페이지(/angtt/{slug})는 **비숫자 slug만** 매칭시켜 게시판 글 URL을 섀도잉하지 않게 한다.
 * → /angtt/7297 = 게시판 글(폴스루), /angtt/호프 = 작품 페이지.
 * ⛔ 엔티티 slug는 절대 순수 숫자로 만들지 말 것(예: "1987" 영화 → "movie-1987" 등).
 */
export const match: ParamMatcher = (param) => {
    return param.length > 0 && !/^\d+$/.test(param);
};
