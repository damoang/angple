/**
 * PAYCO OAuth 프로바이더
 */
import { BaseOAuthProvider } from '../base-provider.js';
import { getCallbackUrl } from '../config.js';
import type { OAuthProviderConfig, OAuthUserProfile, SocialProvider } from '../types.js';

interface PaycoProfileResponse {
	header: {
		isSuccessful: boolean;
		resultCode: number;
		resultMessage: string;
	};
	data?: {
		member?: {
			idNo?: string;
			email?: string;
			name?: string;
			mobile?: string;
			birthdayMMdd?: string;
			profileImageUrl?: string;
			genderCode?: string;
		};
	};
}

export class PaycoProvider extends BaseOAuthProvider {
	readonly provider: SocialProvider = 'payco';
	readonly config: OAuthProviderConfig;

	constructor(clientId: string, clientSecret: string) {
		super();
		this.config = {
			clientId,
			clientSecret,
			authorizeUrl: 'https://id.payco.com/oauth2.0/authorize',
			tokenUrl: 'https://id.payco.com/oauth2.0/token',
			profileUrl: 'https://apis-payco.krp.toastoven.net/payco/friends/find_member_v2.json',
			scope: '',
			callbackUrl: getCallbackUrl('payco')
		};
	}

	/** PAYCO는 client_id를 헤더에 전달 */
	async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
		const response = await fetch(this.config.profileUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				client_id: this.config.clientId
			},
			body: `access_token=${accessToken}`
		});

		if (!response.ok) {
			throw new Error(`PAYCO 프로필 조회 실패 (${response.status})`);
		}

		const data = await response.json();
		return this.parseUserProfile(data);
	}

	parseUserProfile(data: unknown): OAuthUserProfile {
		const d = data as PaycoProfileResponse;
		const member = d.data?.member;
		return {
			provider: 'payco',
			identifier: member?.idNo || '',
			displayName: member?.name || '',
			email: member?.email || '',
			photoUrl: member?.profileImageUrl || '',
			profileUrl: ''
		};
	}
}
