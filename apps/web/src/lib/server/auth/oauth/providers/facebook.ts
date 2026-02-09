/**
 * Facebook OAuth 프로바이더
 */
import { BaseOAuthProvider } from '../base-provider.js';
import { getCallbackUrl } from '../config.js';
import type { OAuthProviderConfig, OAuthUserProfile, SocialProvider } from '../types.js';

interface FacebookProfileResponse {
    id: string;
    name?: string;
    email?: string;
    picture?: {
        data?: {
            url?: string;
        };
    };
}

export class FacebookProvider extends BaseOAuthProvider {
    readonly provider: SocialProvider = 'facebook';
    readonly config: OAuthProviderConfig;

    constructor(clientId: string, clientSecret: string) {
        super();
        this.config = {
            clientId,
            clientSecret,
            authorizeUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
            tokenUrl: 'https://graph.facebook.com/v19.0/oauth/access_token',
            profileUrl:
                'https://graph.facebook.com/v19.0/me?fields=id,name,email,picture.type(large)',
            scope: 'email public_profile',
            callbackUrl: getCallbackUrl('facebook')
        };
    }

    parseUserProfile(data: unknown): OAuthUserProfile {
        const d = data as FacebookProfileResponse;
        return {
            provider: 'facebook',
            identifier: d.id,
            displayName: d.name || '',
            email: d.email || '',
            photoUrl: d.picture?.data?.url || '',
            profileUrl: `https://www.facebook.com/${d.id}`
        };
    }
}
