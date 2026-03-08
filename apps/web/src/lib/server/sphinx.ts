/**
 * Sphinx Search Connection (SphinxQL)
 *
 * SphinxQL은 MySQL 프로토콜 호환이므로 mysql2를 그대로 사용.
 * 포트: 9306 (sphinx.conf의 listen = 9306:mysql41)
 */
import mysql from 'mysql2/promise';

const sphinxPool = mysql.createPool({
    host: process.env.SPHINX_HOST || '127.0.0.1',
    port: parseInt(process.env.SPHINX_PORT || '9306'),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 50,
    connectTimeout: 3_000
});

export { sphinxPool };
export default sphinxPool;
