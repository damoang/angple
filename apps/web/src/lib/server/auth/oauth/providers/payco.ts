/**
 * PAYCO OAuth 프로바이더
 *
 * PAYCO는 2단계 프로필 조회가 필요:
 * 1. getIdNoByFriendsToken.json → idNo 획득
 * 2. find_member_v2.json → idNo로 회원 프로필 조회
 */
import { BaseOAuthProvider } from '../base-provider.js';
import { getCallbackUrl } from '../config.js';
import type { OAuthProviderConfig, OAuthUserProfile, SocialProvider } from '../types.js';

interface PaycoIdNoResponse {
    header: {
        isSuccessful: boolean;
        resultCode: number;
        resultMessage: string;
    };
    idNo?: string;
}

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

    private static readonly ID_NO_URL =
        'https://apis3.krp.toastoven.net/payco/friends/getIdNoByFriendsToken.json';

    constructor(clientId: string, clientSecret: string, origin?: string) {
        super();
        this.config = {
            clientId,
            clientSecret,
            authorizeUrl: 'https://id.payco.com/oauth2.0/authorize',
            tokenUrl: 'https://id.payco.com/oauth2.0/token',
            profileUrl: 'https://apis-payco.krp.toastoven.net/payco/friends/find_member_v2.json',
            scope: '',
            callbackUrl: getCallbackUrl('payco', origin)
        };
    }

    /** PAYCO는 serviceProviderCode=FRIENDS 필수 */
    override getAuthorizationUrl(state: string): string {
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: this.config.clientId,
            redirect_uri: this.config.callbackUrl,
            state,
            serviceProviderCode: 'FRIENDS',
            userLocale: 'ko_KR'
        });
        return `${this.config.authorizeUrl}?${params.toString()}`;
    }

    /**
     * Step 1: access_token으로 idNo 획득
     * PHP: check_valid_access_token() → getIdNoByFriendsToken.json
     */
    private async getIdNo(accessToken: string): Promise<string> {
        const response = await fetch(PaycoProvider.ID_NO_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                client_id: this.config.clientId,
                access_token: accessToken
            },
            body: JSON.stringify({
                client_id: this.config.clientId,
                access_token: accessToken
            })
        });

        if (!response.ok) {
            throw new Error(`PAYCO idNo 조회 실패 (${response.status})`);
        }

        const data: PaycoIdNoResponse = await response.json();

        if (!data.header?.isSuccessful || !data.idNo) {
            throw new Error(`PAYCO idNo 응답 오류: ${data.header?.resultMessage || 'idNo 없음'}`);
        }

        return data.idNo;
    }

    /**
     * Step 2: idNo로 회원 프로필 조회
     * PHP: getUserProfile() → find_member_v2.json (idNo, MemberProfile 파라미터 필수)
     */
    async getUserProfile(accessToken: string): Promise<OAuthUserProfile> {
        // Step 1: idNo 획득
        const idNo = await this.getIdNo(accessToken);

        // Step 2: idNo로 프로필 조회
        const body = new URLSearchParams({
            client_id: this.config.clientId,
            access_token: accessToken,
            idNo,
            MemberProfile: 'idNo,id,name,email,mobile,birthdayMMdd,profileImageUrl,genderCode'
        });

        const response = await fetch(this.config.profileUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                client_id: this.config.clientId,
                access_token: accessToken,
                Authorization: `Bearer ${accessToken}`
            },
            body: body.toString()
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

        if (!member?.idNo) {
            throw new Error(`PAYCO 프로필에 idNo가 없습니다: ${JSON.stringify(d.header)}`);
        }

        return {
            provider: 'payco',
            identifier: member.idNo,
            displayName: member.name || '',
            email: member.email || '',
            photoUrl: member.profileImageUrl || '',
            profileUrl: ''
        };
    }
}
