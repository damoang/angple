/**
 * MySQL Database Connection
 * damoang g5 database connection
 */
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    host:
        process.env.DB_HOST ||
        'damoang-g5-prd.cluster-cduqes60oxt0.ap-northeast-2.rds.amazonaws.com',
    user: process.env.DB_USER || 'damoang',
    password: process.env.DB_PASSWORD || 'txkz89bip<V9kSil<7QUEPKj|Htn',
    database: process.env.DB_NAME || 'damoang',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export { pool };
export default pool;
