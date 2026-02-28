/**
 * MySQL Database Connection
 *
 * 환경변수 필수:
 *   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
 *   (.env 또는 Docker 환경변수로 설정)
 */
import mysql from 'mysql2/promise';
import { env } from '$env/dynamic/private';

const pool = mysql.createPool({
    host: env.DB_HOST || 'localhost',
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'angple',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+09:00'
});

export { pool };
export default pool;
