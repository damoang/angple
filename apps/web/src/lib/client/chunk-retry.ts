/**
 * 청크 로드 실패 시 **재시도 1회** 여부를 정한다.
 *
 * ## ⛔ 왜 재시도인가 — 근본 원인을 못 좁혔기 때문이다
 *
 * 2026-09-30 코드 분할(#2327) 반영 후 라우트 청크 로드 실패가 늘었다(사람 기준 재로드율 2.2%→약 4%).
 * 가설 넷을 세우고 **넷 다 측정으로 기각**했다:
 *   · 구 HTML 전이(404) — 실패 URL 이 전부 현 릴리스, 3시간째 감쇠 없음
 *   · 봇 오염 — 제외해도 비율 동일
 *   · 엣지 캐시 콜드 — ICN 148개 데운 뒤에도 그대로(Smart Tiered Cache 는 이미 on)
 *   · CSS 모드 혼용 — `Unable to preload CSS` **0건**. 실패는 전부 JS 모듈 import
 *
 * 세그먼트도 깔끔하지 않다 — iOS 157/1k · 데스크탑 Firefox 181/1k 인데
 * 「모바일이라서」도(Android Chrome 25.6) 「엔진이라서」도(macOS Safari 23.8) 아니다.
 *
 * ⭐ **그런데 확정된 사실이 하나 있다 — 일회성이다.**
 * 1명당 1.1~1.4건 · 복구가 실제로 성공 · 실패 URL 을 직접 받아보면 200·ACAO `*`.
 * 즉 **잠시 뒤 다시 받으면 성공하는 실패**다. 그러면 원인을 몰라도 재시도가 맞는 대응이다.
 *
 * ## ⛔ 하방이 막혀 있다
 *
 * 재시도가 실패하면 **기존과 동일하게** 전체 재로드로 위임한다.
 * 최악이 현 상태와 같고 대가는 재로드 전 지연뿐이다.
 *
 * 설계서: /home/angple/docs/2026-09-30-chunk-retry-sprint.html
 */

/** 재시도까지 기다리는 시간. 즉시 재시도는 같은 순간 실패를 다시 만날 수 있다. */
export const CHUNK_RETRY_DELAY_MS = 400;

/** ⛔ 오래 켜둔 탭에서 무한 증식하지 않게 상한을 둔다 */
const MAX_TRACKED = 50;

const tracked = new Set<string>();

/**
 * 이번 청크 실패를 재시도할지 정한다. **같은 URL 은 한 번만** true 를 돌려준다.
 *
 * @param targetUrl 도달하지 못한 목표 URL (`event.url.href`)
 * @param currentUrl 지금 보고 있는 URL (`location.href`)
 * @returns true = 재시도 · false = 기존 경로로 위임(전체 재로드)
 */
export function shouldRetryChunk(targetUrl: string, currentUrl: string): boolean {
    if (!targetUrl) return false;
    // ⛔ 목표가 현재와 같으면 goto 가 no-op 이다 — 초기 로드나 재로드 중 실패한 경우다.
    //    그때는 재시도할 방법이 없으니 바로 위임한다.
    if (targetUrl === currentUrl) return false;
    if (tracked.has(targetUrl)) return false;
    if (tracked.size >= MAX_TRACKED) tracked.clear();
    tracked.add(targetUrl);
    return true;
}

/** 시험용 — 상태를 비운다 */
export function __resetChunkRetryState(): void {
    tracked.clear();
}

/** 시험용 — 추적 중인 개수 */
export function __trackedCount(): number {
    return tracked.size;
}
