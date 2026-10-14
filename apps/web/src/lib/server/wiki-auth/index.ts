import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '$env/dynamic/private';
import { error, type Cookies } from '@sveltejs/kit';
import type { RowDataPacket, ResultSetHeader } from 'mysql2';
import { pool } from '$lib/server/db';
import { getRedis } from '$lib/server/redis';

export const SESSION_COOKIE = '__Host-wikiang_session';
export const STATE_COOKIE = '__Host-wikiang_oauth';
const TTL = 7 * 86400;
const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const random = () => randomBytes(32).toString('base64url');
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export interface WikiUser {
    id: number;
    nickname: string;
}
interface UserRow extends RowDataPacket {
    id: number;
    display_name: string;
    is_active: number;
}

export function isWikiangSite(url: URL): boolean {
    return (
        ['wikiang.org', 'www.wikiang.org', 'wikiang.com', 'www.wikiang.com'].includes(
            url.hostname
        ) ||
        (env.WIKIANG_SITE === 'true' && url.hostname === '127.0.0.1' && url.port === '43120')
    );
}
export function authConfigured(): boolean {
    return Boolean(env.WIKIANG_GOOGLE_CLIENT_ID && env.WIKIANG_GOOGLE_CLIENT_SECRET);
}
export function callbackUrl(url: URL): string {
    return url.hostname === '127.0.0.1' && env.WIKIANG_SITE === 'true'
        ? 'http://127.0.0.1:43120/wiki-auth/callback'
        : 'https://wikiang.org/wiki-auth/callback';
}
export function cookieName(base: string, url: URL): string {
    return url.protocol === 'https:' ? base : base.replace('__Host-', '');
}
export function cookieOptions(url: URL, maxAge: number) {
    return {
        path: '/',
        httpOnly: true,
        secure: url.protocol === 'https:',
        sameSite: 'lax' as const,
        maxAge
    };
}
export function safeReturnPath(value: string | null): string {
    if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\x00-\x20]/.test(value))
        return '/';
    try {
        const parsed = new URL(value, 'https://wikiang.org');
        if (
            parsed.origin !== 'https://wikiang.org' ||
            /^\/(?:wiki-auth|auth|login|api)(?:\/|$)/.test(parsed.pathname)
        )
            return '/';
        return parsed.pathname + parsed.search + parsed.hash;
    } catch {
        return '/';
    }
}
export function equalToken(a: string, b: string): boolean {
    const left = Buffer.from(a),
        right = Buffer.from(b);
    return left.length === right.length && timingSafeEqual(left, right);
}
export async function readSession(
    cookies: Cookies,
    url: URL
): Promise<{ user: WikiUser; csrf: string } | null> {
    const token = cookies.get(cookieName(SESSION_COOKIE, url));
    if (!token || !/^[\w-]{43}$/.test(token)) return null;
    const raw = await getRedis().get('wikiang:auth:session:' + digest(token));
    if (!raw) return null;
    const session = JSON.parse(raw) as { userId: number; csrf: string };
    const [rows] = await pool.query<UserRow[]>(
        'SELECT id, display_name, is_active FROM wikiang_users WHERE id=?',
        [session.userId]
    );
    if (!rows[0]?.is_active) return null;
    return { user: { id: rows[0].id, nickname: rows[0].display_name }, csrf: session.csrf };
}
export async function destroySession(cookies: Cookies, url: URL) {
    const name = cookieName(SESSION_COOKIE, url);
    const token = cookies.get(name);
    if (token) await getRedis().del('wikiang:auth:session:' + digest(token));
    cookies.delete(name, { path: '/' });
}
export async function createSession(userId: number, cookies: Cookies, url: URL) {
    await destroySession(cookies, url);
    const token = random();
    await getRedis().set(
        'wikiang:auth:session:' + digest(token),
        JSON.stringify({ userId, csrf: random() }),
        'EX',
        TTL
    );
    cookies.set(cookieName(SESSION_COOKIE, url), token, cookieOptions(url, TTL));
}
export async function beginGoogle(cookies: Cookies, url: URL): Promise<string> {
    if (!authConfigured())
        error(503, '구글 로그인 설정을 준비 중입니다. 문서는 계속 읽고 편집할 수 있습니다.');
    const state = random(),
        nonce = random(),
        verifier = random();
    const old = cookies.get(cookieName(STATE_COOKIE, url));
    if (old) await getRedis().del('wikiang:auth:state:' + digest(old));
    await getRedis().set(
        'wikiang:auth:state:' + digest(state),
        JSON.stringify({
            nonce,
            verifier,
            returnTo: safeReturnPath(url.searchParams.get('returnTo'))
        }),
        'EX',
        600
    );
    cookies.set(cookieName(STATE_COOKIE, url), state, cookieOptions(url, 600));
    const params = new URLSearchParams({
        client_id: env.WIKIANG_GOOGLE_CLIENT_ID!,
        redirect_uri: callbackUrl(url),
        response_type: 'code',
        scope: 'openid',
        state,
        nonce,
        code_challenge_method: 'S256',
        code_challenge: createHash('sha256').update(verifier).digest('base64url'),
        prompt: 'select_account'
    });
    return 'https://accounts.google.com/o/oauth2/v2/auth?' + params;
}
export async function verifyGoogleToken(token: string, nonce: string): Promise<string> {
    const { payload } = await jwtVerify(token, jwks, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: env.WIKIANG_GOOGLE_CLIENT_ID,
        algorithms: ['RS256'],
        requiredClaims: ['exp', 'iat', 'sub', 'nonce']
    });
    if (
        payload.nonce !== nonce ||
        !payload.sub ||
        payload.sub.length > 255 ||
        (payload.azp !== undefined && payload.azp !== env.WIKIANG_GOOGLE_CLIENT_ID)
    )
        throw new Error('Invalid Google identity');
    return payload.sub;
}
export async function finishGoogle(cookies: Cookies, url: URL): Promise<string> {
    if (!authConfigured()) error(503, '구글 로그인 설정을 준비 중입니다.');
    const state = url.searchParams.get('state') || '';
    const name = cookieName(STATE_COOKIE, url);
    const stored = cookies.get(name) || '';
    cookies.delete(name, { path: '/' });
    if (!/^[\w-]{43}$/.test(state) || !equalToken(state, stored))
        throw new Error('Invalid OAuth state');
    // Atomically consume state; callbacks cannot be replayed, including cancelled attempts.
    const raw = await getRedis().eval(
        "local v=redis.call('GET',KEYS[1]); redis.call('DEL',KEYS[1]); return v",
        1,
        'wikiang:auth:state:' + digest(state)
    );
    if (typeof raw !== 'string') throw new Error('Expired OAuth state');
    const flow = JSON.parse(raw) as { nonce: string; verifier: string; returnTo: string };
    const code = url.searchParams.get('code');
    if (url.searchParams.has('error') || !code || code.length > 4096)
        throw new Error('Google login cancelled');
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(10000),
        body: new URLSearchParams({
            client_id: env.WIKIANG_GOOGLE_CLIENT_ID!,
            client_secret: env.WIKIANG_GOOGLE_CLIENT_SECRET!,
            redirect_uri: callbackUrl(url),
            grant_type: 'authorization_code',
            code,
            code_verifier: flow.verifier
        })
    });
    if (!response.ok) throw new Error('Google exchange failed');
    const token: unknown = await response.json();
    if (
        !token ||
        typeof token !== 'object' ||
        !('id_token' in token) ||
        typeof token.id_token !== 'string'
    )
        throw new Error('Missing Google identity');
    const subject = await verifyGoogleToken(token.id_token, flow.nonce);
    const userId = await findOrCreateUser(subject);
    await createSession(userId, cookies, url);
    return safeReturnPath(flow.returnTo);
}
export async function findOrCreateUser(subject: string): Promise<number> {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        // Unique Google subject is the only account key. Never match email or legacy membership.
        await connection.query(
            'INSERT IGNORE INTO wikiang_google_accounts (google_sub) VALUES (?)',
            [subject]
        );
        const [accounts] = await connection.query<(RowDataPacket & { user_id: number | null })[]>(
            'SELECT user_id FROM wikiang_google_accounts WHERE google_sub=? FOR UPDATE',
            [subject]
        );
        let id = accounts[0].user_id;
        if (!id) {
            const suffix = randomBytes(8).toString('hex');
            const [insert] = await connection.query<ResultSetHeader>(
                "INSERT INTO wikiang_users (username, display_name, provider, provider_id, source_system, is_verified) VALUES (?, ?, 'google', ?, 'new', 1)",
                ['wiki_' + suffix, '위키회원-' + suffix.slice(0, 8), subject]
            );
            id = insert.insertId;
            await connection.query(
                'UPDATE wikiang_google_accounts SET user_id=? WHERE google_sub=?',
                [id, subject]
            );
        }
        const [users] = await connection.query<UserRow[]>(
            'SELECT id, display_name, is_active FROM wikiang_users WHERE id=?',
            [id]
        );
        if (!users[0]?.is_active) throw new Error('Inactive Wikiang account');
        await connection.query('UPDATE wikiang_users SET last_login_at=NOW() WHERE id=?', [id]);
        await connection.commit();
        return id;
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}
