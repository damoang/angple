/**
 * Sphinx Search Connection (SphinxQL)
 *
 * SphinxQL은 MySQL 프로토콜 호환이므로 mysql2를 그대로 사용.
 * 포트: 9306 (sphinx.conf의 listen = 9306:mysql41)
 *
 * `database` 더미 값 (SPHINX_DATABASE, default 'Manticore'):
 *   Manticore 25 의 mysql 프로토콜 구현이 stricter — connection 시 database
 *   미지정이면 ER_NO_DB_ERROR 반환 (Sphinx 2.2.11 은 lenient). Manticore 는
 *   값 자체 무시하므로 임의 문자열 OK. Sphinx 9306 도 같은 옵션 허용 (역호환).
 */
import mysql from 'mysql2/promise';

const sphinxPool = mysql.createPool({
    host: process.env.SPHINX_HOST || '127.0.0.1',
    port: parseInt(process.env.SPHINX_PORT || '9306'),
    database: process.env.SPHINX_DATABASE || 'Manticore',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 50,
    connectTimeout: 3_000
});

export { sphinxPool };
export default sphinxPool;
