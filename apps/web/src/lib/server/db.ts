/**
 * MySQL Database Connection
 *
 * 환경변수 필수:
 *   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
 *   (.env 또는 Docker 환경변수로 설정)
 */
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'angple',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export { pool };
export default pool;
