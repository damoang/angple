/**
 * OAuth2 프로바이더 베이스 클래스
 * 공통 로직: 인가 URL 생성, 코드 교환, 프로필 조회
 */
import type {
    OAuthProviderConfig,
    OAuthTokenResponse,
    OAuthUserProfile,
    SocialProvider
} from './types.js';

export abstract class BaseOAuthProvider {
    abstract readonly provider: SocialProvider;
    abstract readonly config: OAuthProviderConfig;

    /** 인가 URL 생성 */
    getAuthorizationUrl(state: string): string {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.config.clientId,
            redirect_uri: this.config.callbackUrl,
            state,
            scope: this.config.scope
        });

        return `${this.config.authorizeUrl}?${params.toString()}`;
    }

    /** 인증 코드 → 액세스 토큰 교환 */
    async exchangeCode(code: string): Promise<OAuthTokenResponse> {
        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            code,
            redirect_uri: this.config.callbackUrl
        });

        const response = await fetch(this.config.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`토큰 교환 실패 (${response.status}): ${errorText}`);
        }

        return response.json();
    }

    /** 프로바이더별 프로필 파싱 (각 프로바이더에서 구현) */
    abstract parseUserProfile(data: unknown): OAuthUserProfile;

    /** 액세스 토큰으로 사용자 프로필 조회 */
    async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
        const response = await fetch(this.config.profileUrl, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            throw new Error(`프로필 조회 실패 (${response.status})`);
        }

        const data = await response.json();
        return this.parseUserProfile(data);
    }
}
