/**
 * MySQL Database Connection
 *
 * 환경변수 필수:
 *   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
 *   (.env 또는 Docker 환경변수로 설정)
 *
 * Read Replica (선택):
 *   DB_READ_HOST — 설정 시 SELECT 전용 readPool 생성
 *   Aurora: cluster-ro- endpoint 사용
 *   미설정 시 writer pool을 readPool로 fallback (비용 0)
 */
import mysql from 'mysql2/promise';
import { env } from '$env/dynamic/private';

const pool = mysql.createPool({
    host: env.DB_HOST || 'localhost',
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'angple',
    waitForConnections: true,
    connectionLimit: 200,
    queueLimit: 500,
    timezone: '+09:00',
    connectTimeout: 5_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30_000,
    idleTimeout: 60_000
});

/**
 * Read Replica pool (SELECT 전용)
 * DB_READ_HOST가 없으면 writer pool 재사용 (비용 0)
 */
const readPool: mysql.Pool = env.DB_READ_HOST
    ? mysql.createPool({
          host: env.DB_READ_HOST,
          port: parseInt(env.DB_READ_PORT || env.DB_PORT || '3306', 10),
          user: env.DB_READ_USER || env.DB_USER || 'root',
          password: env.DB_READ_PASSWORD || env.DB_PASSWORD || '',
          database: env.DB_NAME || 'angple',
          waitForConnections: true,
          connectionLimit: 400,
          queueLimit: 1000,
          timezone: '+09:00',
          connectTimeout: 5_000,
          enableKeepAlive: true,
          keepAliveInitialDelay: 30_000,
          idleTimeout: 60_000
      })
    : pool;

export { pool, readPool };
export default pool;
