/**
 * OAuth 프로바이더 설정 로드
 * g5_config 테이블에서 소셜로그인 키 조회 (기존 PHP와 동일 DB)
 */
import pool from '$lib/server/db.js';
import type { RowDataPacket } from 'mysql2';

const SITE_URL = process.env.SITE_URL || 'https://damoang.net';

export interface OAuthKeys {
    naver_clientid: string;
    naver_secret: string;
    kakao_rest_key: string;
    kakao_client_secret: string;
    google_clientid: string;
    google_secret: string;
    facebook_appid: string;
    facebook_secret: string;
    twitter_key: string;
    twitter_secret: string;
    payco_clientid: string;
    payco_secret: string;
    apple_bundle_id: string;
    apple_team_id: string;
    apple_key_id: string;
    apple_key_file: string;
}

let cachedKeys: OAuthKeys | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5분

export async function getOAuthKeys(): Promise<OAuthKeys> {
    const now = Date.now();
    if (cachedKeys && now - cacheTimestamp < CACHE_TTL) {
        return cachedKeys;
    }

    const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT cf_naver_clientid, cf_naver_secret, cf_kakao_rest_key, cf_kakao_client_secret,
		        cf_google_clientid, cf_google_secret, cf_facebook_appid, cf_facebook_secret,
		        cf_twitter_key, cf_twitter_secret, cf_payco_clientid, cf_payco_secret,
		        cf_apple_bundle_id, cf_apple_team_id, cf_apple_key_id, cf_apple_key_file
		 FROM g5_config LIMIT 1`
    );

    if (!rows.length) {
        throw new Error('g5_config 테이블에서 설정을 찾을 수 없습니다');
    }

    const row = rows[0];
    cachedKeys = {
        naver_clientid: process.env.NAVER_CLIENT_ID || row.cf_naver_clientid || '',
        naver_secret: process.env.NAVER_CLIENT_SECRET || row.cf_naver_secret || '',
        kakao_rest_key: process.env.KAKAO_REST_KEY || row.cf_kakao_rest_key || '',
        kakao_client_secret: process.env.KAKAO_CLIENT_SECRET || row.cf_kakao_client_secret || '',
        google_clientid: process.env.GOOGLE_CLIENT_ID || row.cf_google_clientid || '',
        google_secret: process.env.GOOGLE_CLIENT_SECRET || row.cf_google_secret || '',
        facebook_appid: process.env.FACEBOOK_APP_ID || row.cf_facebook_appid || '',
        facebook_secret: process.env.FACEBOOK_SECRET || row.cf_facebook_secret || '',
        twitter_key: process.env.TWITTER_KEY || row.cf_twitter_key || '',
        twitter_secret: process.env.TWITTER_SECRET || row.cf_twitter_secret || '',
        payco_clientid: process.env.PAYCO_CLIENT_ID || row.cf_payco_clientid || '',
        payco_secret: process.env.PAYCO_SECRET || row.cf_payco_secret || '',
        apple_bundle_id: process.env.APPLE_BUNDLE_ID || row.cf_apple_bundle_id || '',
        apple_team_id: process.env.APPLE_TEAM_ID || row.cf_apple_team_id || '',
        apple_key_id: process.env.APPLE_KEY_ID || row.cf_apple_key_id || '',
        apple_key_file: process.env.APPLE_KEY_FILE || row.cf_apple_key_file || ''
    };
    cacheTimestamp = now;

    return cachedKeys;
}

/** PHP 호환 콜백 URL 생성 */
export function getCallbackUrl(provider: string): string {
    const providerLower = provider.toLowerCase();
    // Twitter, Payco는 파라미터 없는 콜백
    if (providerLower === 'twitter' || providerLower === 'payco') {
        return `${SITE_URL}/plugin/social/`;
    }
    // 나머지: ?hauth.done=Provider (첫 글자 대문자)
    const providerName = providerLower.charAt(0).toUpperCase() + providerLower.slice(1);
    return `${SITE_URL}/plugin/social/?hauth.done=${providerName}`;
}

export function getSiteUrl(): string {
    return SITE_URL;
}
