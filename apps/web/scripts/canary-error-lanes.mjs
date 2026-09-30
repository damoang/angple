/**
 * 카나리 브라우저 검사의 오류 분류 — **레인 2개**.
 *
 * ⛔ 왜 레인을 나누는가: split(코드 분할)은 두 번 실패했고 **원인이 서로 다르다.**
 *   1차 b82ce66b 2026-06-28(#1685) → 58c10665 **6/29**(#1691) 롤백
 *       TypeError: Cannot read properties of undefined (reading '$set')
 *       Failed to hydrate: HierarchyRequestError
 *       ⭐ `?_v=`(자산복구) 적용 상태에서도 재현 → 단순 캐시 아님
 *   2차 3b8a7a45 2026-09-28(#2303) → 3beefee1 9/29(#2305) 롤백
 *       CORS 모드 혼용 → 청크 로드 실패 → 복구 리로드 무한루프
 *
 * 🔴 기존 검사(#2307)는 **청크 레인만** 봤다. 6월 지문은 정규식에 없었고,
 *    게다가 `pageerror` 도 「텍스트에 `_app/immutable/` 가 있어야」 기록되는 필터를 통과해야 했다.
 *    `Cannot read properties of undefined (reading '$set')` 에는 그 문자열이 **없다** →
 *    정규식에 추가해도 조용히 버려진다. 그래서 **스택·소스 URL 로** 「우리 것」을 판별한다.
 *
 * 두 레인을 구별해 보고해야 한다 — 9월 것과 6월 것은 고칠 곳이 다르다.
 */

/** 2차(9월) 지문: 청크·모듈 로딩·CORS */
export const CHUNK_RE =
    /(failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|chunkloaderror|blocked by CORS policy|net::ERR_|failed to load resource)/i;

/** 1차(6월) 지문 중 **Svelte/SvelteKit 고유** — 서드파티가 낼 수 없어 출처 확인이 불필요하다 */
export const SVELTE_RE =
    /(reading '\$set'|\.\$set is not a function|failed to hydrate|hydration_mismatch)/i;

/**
 * 1차 지문 중 **일반 DOM 오류** — 광고·위젯 스크립트도 낼 수 있으므로 출처가 우리일 때만 센다.
 * (`HierarchyRequestError` 는 appendChild 로 잘못된 노드를 넣을 때 나는 표준 오류다)
 */
export const DOM_RE = /hierarchyrequesterror/i;

/** 우리 자산에서 났는지 — 메시지엔 URL 이 없을 수 있어 스택·소스 URL 을 함께 본다 */
export const OURS_RE = /(_app\/immutable\/|static\.damoang\.net)/;

/**
 * @returns {'chunk'|'hydrate'|null} 레인, 또는 판정 대상이 아님
 */
export function classify(message, stack = '', sourceUrl = '') {
    const m = String(message ?? '');
    if (!m) return null;
    const ctx = `${m}\n${stack ?? ''}\n${sourceUrl ?? ''}`;
    // ⛔ 청크 레인은 출처 확인을 유지한다 — 서드파티(turnstile·광고) CORS 경고가 섞이면
    //    9/29 처럼 「CORS 차단」 오탐으로 승격이 막힌다.
    if (CHUNK_RE.test(m)) return OURS_RE.test(ctx) ? 'chunk' : null;
    if (SVELTE_RE.test(m)) return 'hydrate';
    if (DOM_RE.test(m)) return OURS_RE.test(ctx) ? 'hydrate' : null;
    return null;
}
