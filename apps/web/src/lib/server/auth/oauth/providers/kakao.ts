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

    constructor(clientId: string, clientSecret: string, origin?: string) {
        super();
        // 카카오 client_secret 유효성 검사: hex 패턴이 아니면 빈 문자열로 처리
        // (g5_config에 콜백 URL이 잘못 저장된 경우 방어)
        const validSecret = /^[a-zA-Z0-9]{16,}$/.test(clientSecret) ? clientSecret : '';
        this.config = {
            clientId,
            clientSecret: validSecret,
            authorizeUrl: 'https://kauth.kakao.com/oauth/authorize',
            tokenUrl: 'https://kauth.kakao.com/oauth/token',
            profileUrl: 'https://kapi.kakao.com/v2/user/me',
            scope: 'profile_nickname profile_image account_email',
            callbackUrl: getCallbackUrl('kakao', origin)
        };
    }

    /** 카카오는 client_secret이 선택사항 — 비어있으면 제외 */
    override async exchangeCode(code: string): Promise<import('../types.js').OAuthTokenResponse> {
        const params: Record<string, string> = {
            grant_type: 'authorization_code',
            client_id: this.config.clientId,
            code,
            redirect_uri: this.config.callbackUrl
        };
        if (this.config.clientSecret) {
            params.client_secret = this.config.clientSecret;
        }

        const response = await fetch(this.config.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(params).toString()
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`토큰 교환 실패 (${response.status}): ${errorText}`);
        }

        return response.json();
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
