/**
 * 벽돌깨기 순위 규칙 — 브라우저와 서버가 같이 읽는다.
 *
 * 순위에 받는 판 길이 상한: 서버가 끝난 판을 처음부터 다시 돌리므로, 가장 무거운 판(공 여러 개·최고 속력)의
 * 재생 시간이 한 요청에 쓰기 알맞은 범위에 들도록 판 길이를 묶는다. 게임 자체(엔진 MAX_TICKS)는 그대로이고,
 * 이보다 긴 판은 끝까지 즐길 수 있지만 순위에는 올리지 않는다.
 */
import { TICK_HZ } from './engine';

/** 순위 판 길이 상한 — 20분 */
export const BREAKOUT_RANKED_MAX_TICKS = 20 * 60 * TICK_HZ;
/** 화면에 쓰는 상한(분) */
export const BREAKOUT_RANKED_MAX_MINUTES = 20;
