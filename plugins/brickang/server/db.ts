/**
 * brickang DB 헬퍼.
 *
 * angple-web 의 공용 mysql2 풀(`$lib/server/db`)을 그대로 재사용한다.
 * brickang 전용 풀은 만들지 않는다 — 동일 damoang DB 를 사용하므로 connection limit 공유가 더 안전.
 */
import { pool, readPool } from '$lib/server/db';

export { pool, readPool };
export default pool;
