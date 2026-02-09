/**
 * Twitter (X) OAuth 2.0 프로바이더
 * OAuth 2.0 with PKCE
 */
import { BaseOAuthProvider } from '../base-provider.js';
import { getCallbackUrl } from '../config.js';
import type { OAuthProviderConfig, OAuthTokenResponse, OAuthUserProfile, SocialProvider } from '../types.js';

interface TwitterProfileResponse {
	data: {
		id: string;
		name?: string;
		username?: string;
		profile_image_url?: string;
	};
}

export class TwitterProvider extends BaseOAuthProvider {
	readonly provider: SocialProvider = 'twitter';
	readonly config: OAuthProviderConfig;

	constructor(clientId: string, clientSecret: string) {
		super();
		this.config = {
			clientId,
			clientSecret,
			authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
			tokenUrl: 'https://api.twitter.com/2/oauth2/token',
			profileUrl: 'https://api.twitter.com/2/users/me?user.fields=profile_image_url',
			scope: 'users.read tweet.read',
			callbackUrl: getCallbackUrl('twitter')
		};
	}

	/** PKCE code_verifier 생성 */
	private generateCodeVerifier(): string {
		const bytes = new Uint8Array(32);
		crypto.getRandomValues(bytes);
		return btoa(String.fromCharCode(...bytes))
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=/g, '');
	}

	/** PKCE code_challenge 생성 */
	private async generateCodeChallenge(verifier: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(verifier);
		const digest = await crypto.subtle.digest('SHA-256', data);
		return btoa(String.fromCharCode(...new Uint8Array(digest)))
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=/g, '');
	}

	/** code_verifier를 state에 포함시켜 반환 */
	async getAuthorizationUrlWithPKCE(state: string): Promise<{ url: string; codeVerifier: string }> {
		const codeVerifier = this.generateCodeVerifier();
		const codeChallenge = await this.generateCodeChallenge(codeVerifier);

		const params = new URLSearchParams({
			response_type: 'code',
			client_id: this.config.clientId,
			redirect_uri: this.config.callbackUrl,
			state,
			scope: this.config.scope,
			code_challenge: codeChallenge,
			code_challenge_method: 'S256'
		});

		return {
			url: `${this.config.authorizeUrl}?${params.toString()}`,
			codeVerifier
		};
	}

	getAuthorizationUrl(state: string): string {
		// PKCE 미사용 fallback (실제로는 getAuthorizationUrlWithPKCE 사용)
		const params = new URLSearchParams({
			response_type: 'code',
			client_id: this.config.clientId,
			redirect_uri: this.config.callbackUrl,
			state,
			scope: this.config.scope
		});
		return `${this.config.authorizeUrl}?${params.toString()}`;
	}

	async exchangeCode(code: string, codeVerifier?: string): Promise<OAuthTokenResponse> {
		const body = new URLSearchParams({
			grant_type: 'authorization_code',
			client_id: this.config.clientId,
			code,
			redirect_uri: this.config.callbackUrl
		});

		if (codeVerifier) {
			body.set('code_verifier', codeVerifier);
		}

		// Twitter는 Basic Auth 사용
		const credentials = btoa(`${this.config.clientId}:${this.config.clientSecret}`);

		const response = await fetch(this.config.tokenUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Authorization: `Basic ${credentials}`
			},
			body: body.toString()
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Twitter 토큰 교환 실패 (${response.status}): ${errorText}`);
		}

		return response.json();
	}

	parseUserProfile(data: unknown): OAuthUserProfile {
		const { data: d } = data as TwitterProfileResponse;
		return {
			provider: 'twitter',
			identifier: d.id,
			displayName: d.name || d.username || '',
			email: '',
			photoUrl: d.profile_image_url || '',
			profileUrl: d.username ? `https://x.com/${d.username}` : ''
		};
	}
}
