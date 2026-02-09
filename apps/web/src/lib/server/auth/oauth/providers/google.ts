/**
 * Google OAuth 프로바이더
 */
import { BaseOAuthProvider } from '../base-provider.js';
import { getCallbackUrl } from '../config.js';
import type { OAuthProviderConfig, OAuthUserProfile, SocialProvider } from '../types.js';

interface GoogleProfileResponse {
    sub: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
    email?: string;
    email_verified?: boolean;
}

export class GoogleProvider extends BaseOAuthProvider {
    readonly provider: SocialProvider = 'google';
    readonly config: OAuthProviderConfig;

    constructor(clientId: string, clientSecret: string) {
        super();
        this.config = {
            clientId,
            clientSecret,
            authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
            tokenUrl: 'https://oauth2.googleapis.com/token',
            profileUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
            scope: 'openid profile email',
            callbackUrl: getCallbackUrl('google')
        };
    }

    getAuthorizationUrl(state: string): string {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.config.clientId,
            redirect_uri: this.config.callbackUrl,
            state,
            scope: this.config.scope,
            access_type: 'offline',
            prompt: 'select_account'
        });

        return `${this.config.authorizeUrl}?${params.toString()}`;
    }

    parseUserProfile(data: unknown): OAuthUserProfile {
        const d = data as GoogleProfileResponse;
        return {
            provider: 'google',
            identifier: d.sub,
            displayName: d.name || '',
            email: d.email || '',
            photoUrl: d.picture || '',
            profileUrl: ''
        };
    }
}
