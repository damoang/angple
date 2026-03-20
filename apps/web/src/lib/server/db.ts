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

const DB_LOG_PREFIX = '[DB]';

const pool = mysql.createPool({
    host: env.DB_HOST || 'localhost',
    port: parseInt(env.DB_PORT || '3306', 10),
    user: env.DB_USER || 'root',
    password: env.DB_PASSWORD || '',
    database: env.DB_NAME || 'angple',
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 500,
    maxPreparedStatements: 0,
    timezone: '+09:00',
    connectTimeout: 5_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30_000,
    idleTimeout: 60_000
});
// RDS 시스템 timezone이 UTC이므로, 세션 timezone을 KST로 설정하여 NOW() 등이 KST를 반환하도록 함
pool.on('connection', (connection: { query: (sql: string) => void }) => {
    connection.query("SET time_zone = '+09:00'");
});

/**
 * Read Replica pool (SELECT 전용)
 * DB_READ_HOST가 없으면 writer pool 재사용 (비용 0)
 */
const _readPool: mysql.Pool | null = env.DB_READ_HOST
    ? mysql.createPool({
          host: env.DB_READ_HOST,
          port: parseInt(env.DB_READ_PORT || env.DB_PORT || '3306', 10),
          user: env.DB_READ_USER || env.DB_USER || 'root',
          password: env.DB_READ_PASSWORD || env.DB_PASSWORD || '',
          database: env.DB_NAME || 'angple',
          waitForConnections: true,
          connectionLimit: 30,
          queueLimit: 1000,
          maxPreparedStatements: 0,
          timezone: '+09:00',
          connectTimeout: 5_000,
          enableKeepAlive: true,
          keepAliveInitialDelay: 30_000,
          idleTimeout: 60_000
      })
    : null;

if (_readPool) {
    _readPool.on('connection', (connection: { query: (sql: string) => void }) => {
        connection.query("SET time_zone = '+09:00'");
    });
}

const readPool: mysql.Pool = _readPool ?? pool;

type DbError = Error & {
    code?: string;
    errno?: number | string;
    sqlState?: string;
    sqlMessage?: string;
};

/**
 * 서버 시작 시 DB 연결 가능 여부를 1회 점검하고 로그를 남긴다.
 * 실패해도 프로세스를 종료하지는 않는다.
 */
async function verifyDbConnection(): Promise<void> {
    const host = env.DB_HOST || 'localhost';
    const port = parseInt(env.DB_PORT || '3306', 10);
    const dbName = env.DB_NAME || 'angple';

    try {
        const conn = await pool.getConnection();
        try {
            await conn.query('SELECT 1');
            console.info(`${DB_LOG_PREFIX} Connected (writer): ${host}:${port}/${dbName}`);
        } finally {
            conn.release();
        }

        if (_readPool) {
            const readHost = env.DB_READ_HOST || host;
            const readPort = parseInt(env.DB_READ_PORT || env.DB_PORT || '3306', 10);
            const readConn = await _readPool.getConnection();
            try {
                await readConn.query('SELECT 1');
                console.info(
                    `${DB_LOG_PREFIX} Connected (reader): ${readHost}:${readPort}/${dbName}`
                );
            } finally {
                readConn.release();
            }
        }
    } catch (error) {
        const err = error as DbError;
        console.error(`${DB_LOG_PREFIX} Connection failed: ${host}:${port}/${dbName}`, {
            code: err.code,
            errno: err.errno,
            sqlState: err.sqlState,
            sqlMessage: err.sqlMessage,
            message: err.message
        });
    }
}

void verifyDbConnection();

export { pool, readPool };
export default pool;
