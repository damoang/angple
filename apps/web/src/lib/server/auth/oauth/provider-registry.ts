/**
 * OAuth 프로바이더 레지스트리
 * 프로바이더 이름으로 인스턴스 생성
 */
import type { BaseOAuthProvider } from './base-provider.js';
import type { SocialProvider } from './types.js';
import { getOAuthKeys } from './config.js';
import { NaverProvider } from './providers/naver.js';
import { KakaoProvider } from './providers/kakao.js';
import { GoogleProvider } from './providers/google.js';
import { FacebookProvider } from './providers/facebook.js';
import { AppleProvider } from './providers/apple.js';
import { TwitterProvider } from './providers/twitter.js';
import { PaycoProvider } from './providers/payco.js';

export async function getProvider(provider: SocialProvider): Promise<BaseOAuthProvider> {
    const keys = await getOAuthKeys();

    switch (provider) {
        case 'naver':
            return new NaverProvider(keys.naver_clientid, keys.naver_secret);
        case 'kakao':
            return new KakaoProvider(keys.kakao_rest_key, keys.kakao_client_secret);
        case 'google':
            return new GoogleProvider(keys.google_clientid, keys.google_secret);
        case 'facebook':
            return new FacebookProvider(keys.facebook_appid, keys.facebook_secret);
        case 'apple':
            return new AppleProvider(
                keys.apple_bundle_id,
                keys.apple_team_id,
                keys.apple_key_id,
                keys.apple_key_file
            );
        case 'twitter':
            return new TwitterProvider(keys.twitter_key, keys.twitter_secret);
        case 'payco':
            return new PaycoProvider(keys.payco_clientid, keys.payco_secret);
        default:
            throw new Error(`지원하지 않는 프로바이더: ${provider}`);
    }
}

const VALID_PROVIDERS: Set<string> = new Set([
    'naver',
    'kakao',
    'google',
    'facebook',
    'apple',
    'twitter',
    'payco'
]);

export function isValidProvider(provider: string): provider is SocialProvider {
    return VALID_PROVIDERS.has(provider.toLowerCase());
}

/** hauth.done 파라미터에서 프로바이더 이름 추출 (대소문자 정규화) */
export function normalizeProviderName(name: string): SocialProvider | null {
    const lower = name.toLowerCase();
    if (VALID_PROVIDERS.has(lower)) {
        return lower as SocialProvider;
    }
    return null;
}
