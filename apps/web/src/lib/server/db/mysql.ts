import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
    if (!pool) {
        pool = mysql.createPool({
            host: process.env.ATTENDANCE_DB_HOST || process.env.DB_HOST || 'mysql',
            port: parseInt(process.env.ATTENDANCE_DB_PORT || process.env.DB_PORT || '3306'),
            user: process.env.ATTENDANCE_DB_USER || process.env.DB_USER || 'muzia_api',
            password: process.env.ATTENDANCE_DB_PASSWORD || process.env.DB_PASSWORD || '',
            database: process.env.ATTENDANCE_DB_NAME || process.env.DB_NAME || 'newcomposer',
            waitForConnections: true,
            connectionLimit: 5,
            charset: 'utf8mb4'
        });
    }
    return pool;
}

/** KST (UTC+9) 기준 날짜/시간 */
export function getKSTDate(): string {
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    return now.toISOString().slice(0, 10);
}

export function getKSTYesterday(): string {
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000 - 86400000);
    return now.toISOString().slice(0, 10);
}

export function getKSTNow(): Date {
    return new Date(Date.now() + 9 * 60 * 60 * 1000);
}

export function getKSTDatetime(): string {
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    return now.toISOString().slice(0, 19).replace('T', ' ');
}

/** sql_mode 비활성화된 커넥션 획득 (그누보드 INSERT/UPDATE용) */
export async function getConnection() {
    const p = getPool();
    const conn = await p.getConnection();
    await conn.query("SET sql_mode = ''");
    return conn;
}
