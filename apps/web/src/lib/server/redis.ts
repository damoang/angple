/**
 * Redis Client (ioredis)
 *
 * 환경변수:
 *   REDIS_HOST (기본: localhost)
 *   REDIS_PORT (기본: 6379)
 *   REDIS_PASSWORD (선택)
 */
import Redis from 'ioredis';
import { env } from '$env/dynamic/private';

const REDIS_HOST = env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(env.REDIS_PORT || '6379', 10);
const REDIS_PASSWORD = env.REDIS_PASSWORD || undefined;

let redisClient: Redis | null = null;

/**
 * Redis 클라이언트 싱글톤
 */
export function getRedis(): Redis {
    if (!redisClient) {
        redisClient = new Redis({
            host: REDIS_HOST,
            port: REDIS_PORT,
            password: REDIS_PASSWORD,
            maxRetriesPerRequest: 3,
            retryStrategy(times) {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            lazyConnect: true
        });

        redisClient.on('error', (err) => {
            console.error('[Redis] Connection error:', err.message);
        });

        redisClient.on('connect', () => {
            console.log('[Redis] Connected to', REDIS_HOST, REDIS_PORT);
        });
    }
    return redisClient;
}

/**
 * Redis 연결 종료 (graceful shutdown용)
 */
export async function closeRedis(): Promise<void> {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
    }
}

export default getRedis;
