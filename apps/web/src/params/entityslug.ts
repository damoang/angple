import type { ParamMatcher } from '@sveltejs/kit';

/**
 * 앙티티 작품 페이지 slug 매처.
 *
 * ⚠️ /angtt/{숫자}는 angtt "게시판 글"(gnuboard g5_write_angtt, [boardId]/[postId])이므로,
 * 작품 페이지(/angtt/{slug})는 **비숫자 slug만** 매칭시켜 게시판 글 URL을 섀도잉하지 않게 한다.
 * → /angtt/7297 = 게시판 글(폴스루), /angtt/호프 = 작품 페이지.
 * ⛔ 엔티티 slug는 절대 순수 숫자로 만들지 말 것(예: "1987" 영화 → "movie-1987" 등).
 *
 * ⛔ 그리고 [boardId] 아래의 **정적 하위 라우트 이름도 반드시 제외**해야 한다.
 * SvelteKit 라우트 우선순위상 /angtt/[slug=entityslug] 가 /[boardId]/write 보다 앞서므로,
 * 여기서 걸러내지 않으면 /angtt/write 가 작품 페이지로 잡혀 **글쓰기가 404** 가 된다.
 * (2026-07-20 실장애: 앙TT 게시판 글쓰기 버튼 → "페이지를 찾을 수 없습니다")
 *
 * 👉 apps/web/src/routes/[boardId]/ 아래에 정적 디렉터리를 새로 만들면
 *    그 이름을 RESERVED 에 반드시 추가해야 한다.
 *    이 일치 여부는 entityslug.test.ts 가 실제 디렉터리를 읽어 검사하므로,
 *    빠뜨리면 사람이 기억하지 못해도 **CI 가 먼저 실패한다**.
 */
export const RESERVED = new Set(['write']);

export const match: ParamMatcher = (param) => {
    if (param.length === 0) return false;
    if (/^\d+$/.test(param)) return false;
    if (RESERVED.has(param.toLowerCase())) return false;
    return true;
};
