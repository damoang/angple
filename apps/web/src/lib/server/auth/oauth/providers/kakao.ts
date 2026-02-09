/**
 * 카카오 OAuth 프로바이더
 */
import { BaseOAuthProvider } from '../base-provider.js';
import { getCallbackUrl } from '../config.js';
import type { OAuthProviderConfig, OAuthUserProfile, SocialProvider } from '../types.js';

interface KakaoProfileResponse {
    id: number;
    properties?: {
        nickname?: string;
        thumbnail_image?: string;
        profile_image?: string;
    };
    kakao_account?: {
        email?: string;
        profile?: {
            nickname?: string;
            thumbnail_image_url?: string;
        };
    };
}

export class KakaoProvider extends BaseOAuthProvider {
    readonly provider: SocialProvider = 'kakao';
    readonly config: OAuthProviderConfig;

    constructor(clientId: string, clientSecret: string) {
        super();
        this.config = {
            clientId,
            clientSecret,
            authorizeUrl: 'https://kauth.kakao.com/oauth/authorize',
            tokenUrl: 'https://kauth.kakao.com/oauth/token',
            profileUrl: 'https://kapi.kakao.com/v2/user/me',
            scope: 'account_email',
            callbackUrl: getCallbackUrl('kakao')
        };
    }

    parseUserProfile(data: unknown): OAuthUserProfile {
        const d = data as KakaoProfileResponse;
        return {
            provider: 'kakao',
            identifier: String(d.id),
            displayName: d.properties?.nickname || d.kakao_account?.profile?.nickname || '',
            email: d.kakao_account?.email || '',
            photoUrl:
                d.properties?.thumbnail_image ||
                d.kakao_account?.profile?.thumbnail_image_url ||
                '',
            profileUrl: ''
        };
    }
}
