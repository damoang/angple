/**
 * Apple OAuth 프로바이더
 * Apple은 response_mode=form_post 사용 → POST 콜백 필요
 * client_secret은 JWT로 동적 생성
 */
import { SignJWT, importPKCS8 } from 'jose';
import { BaseOAuthProvider } from '../base-provider.js';
import { getCallbackUrl } from '../config.js';
import type {
    OAuthProviderConfig,
    OAuthTokenResponse,
    OAuthUserProfile,
    SocialProvider
} from '../types.js';
import { readFileSync } from 'fs';

interface AppleIdTokenPayload {
    sub: string;
    email?: string;
}

export class AppleProvider extends BaseOAuthProvider {
    readonly provider: SocialProvider = 'apple';
    readonly config: OAuthProviderConfig;
    private teamId: string;
    private keyId: string;
    private keyFile: string;

    constructor(bundleId: string, teamId: string, keyId: string, keyFile: string) {
        super();
        this.teamId = teamId;
        this.keyId = keyId;
        this.keyFile = keyFile;
        this.config = {
            clientId: bundleId,
            clientSecret: '', // 동적 생성
            authorizeUrl: 'https://appleid.apple.com/auth/authorize',
            tokenUrl: 'https://appleid.apple.com/auth/token',
            profileUrl: '', // Apple은 id_token에서 추출
            scope: 'name email',
            callbackUrl: getCallbackUrl('apple')
        };
    }

    /** Apple client_secret JWT 생성 */
    private async generateClientSecret(): Promise<string> {
        let keyContent: string;
        try {
            keyContent = readFileSync(this.keyFile, 'utf-8');
        } catch {
            throw new Error(`Apple 키 파일을 읽을 수 없습니다: ${this.keyFile}`);
        }

        const privateKey = await importPKCS8(keyContent, 'ES256');

        return new SignJWT({})
            .setProtectedHeader({ alg: 'ES256', kid: this.keyId })
            .setIssuer(this.teamId)
            .setAudience('https://appleid.apple.com')
            .setSubject(this.config.clientId)
            .setIssuedAt()
            .setExpirationTime('5m')
            .sign(privateKey);
    }

    getAuthorizationUrl(state: string): string {
        const params = new URLSearchParams({
            response_type: 'code',
            response_mode: 'form_post',
            client_id: this.config.clientId,
            redirect_uri: this.config.callbackUrl,
            state,
            scope: this.config.scope
        });

        return `${this.config.authorizeUrl}?${params.toString()}`;
    }

    async exchangeCode(code: string): Promise<OAuthTokenResponse> {
        const clientSecret = await this.generateClientSecret();

        const body = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: this.config.clientId,
            client_secret: clientSecret,
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
            throw new Error(`Apple 토큰 교환 실패 (${response.status}): ${errorText}`);
        }

        return response.json();
    }

    /** Apple은 id_token에서 사용자 정보 추출 */
    async getUserProfile(accessToken: string, idToken?: string): Promise<OAuthUserProfile> {
        if (!idToken) {
            throw new Error('Apple id_token이 필요합니다');
        }

        // id_token JWT 디코딩 (서명 검증은 Apple 토큰 교환 시 이미 완료)
        const parts = idToken.split('.');
        const payload = JSON.parse(
            Buffer.from(parts[1], 'base64url').toString()
        ) as AppleIdTokenPayload;

        return this.parseUserProfile(payload);
    }

    parseUserProfile(data: unknown): OAuthUserProfile {
        const d = data as AppleIdTokenPayload;
        return {
            provider: 'apple',
            identifier: d.sub,
            displayName: '',
            email: d.email || '',
            photoUrl: '',
            profileUrl: ''
        };
    }
}
