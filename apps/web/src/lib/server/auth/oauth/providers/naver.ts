/**
 * 네이버 OAuth 프로바이더
 */
import { BaseOAuthProvider } from '../base-provider.js';
import { getCallbackUrl } from '../config.js';
import type { OAuthProviderConfig, OAuthUserProfile, SocialProvider } from '../types.js';

interface NaverProfileResponse {
	response: {
		id: string;
		nickname?: string;
		email?: string;
		profile_image?: string;
		name?: string;
	};
}

export class NaverProvider extends BaseOAuthProvider {
	readonly provider: SocialProvider = 'naver';
	readonly config: OAuthProviderConfig;

	constructor(clientId: string, clientSecret: string) {
		super();
		this.config = {
			clientId,
			clientSecret,
			authorizeUrl: 'https://nid.naver.com/oauth2.0/authorize',
			tokenUrl: 'https://nid.naver.com/oauth2.0/token',
			profileUrl: 'https://openapi.naver.com/v1/nid/me',
			scope: '',
			callbackUrl: getCallbackUrl('naver')
		};
	}

	parseUserProfile(data: unknown): OAuthUserProfile {
		const { response: r } = data as NaverProfileResponse;
		return {
			provider: 'naver',
			identifier: r.id,
			displayName: r.nickname || r.name || '',
			email: r.email || '',
			photoUrl: r.profile_image || '',
			profileUrl: ''
		};
	}
}
