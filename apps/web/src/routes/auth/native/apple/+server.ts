/**
 * 네이티브 앱 Apple 로그인 엔드포인트
 * POST /auth/native/apple
 *
 * 네이티브 앱(expo-apple-authentication)이 발급받은 Apple identityToken 을 검증하고,
 * 회원을 해석해 단명 app-login 코드를 반환한다. 앱은 이 코드를 /api/v2/auth/app-exchange
 * 로 교환해 v2 토큰쌍을 얻는다. 웹 OAuth 콜백(app 모드)과 동일한 회원해석 규칙을 따른다.
 *
 * Apple sub 은 동일 Apple Developer 팀에서 web/native 가 같으므로, 기존 웹에서 Apple 로
 * 연결한 계정(g5_member_social_profiles.identifier=sub)이 그대로 매칭된다.
 */
import { json, type RequestHandler } from '@sveltejs/kit';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '$env/dynamic/private';
import { getOAuthKeys } from '$lib/server/auth/oauth/config.js';
import { findSocialProfile, upsertSocialProfile } from '$lib/server/auth/oauth/social-profile.js';
import { getMemberById, findMemberByEmail, isMemberActive } from '$lib/server/auth/oauth/member.js';
import {
    generateSocialMbId,
    isMbIdTaken,
    isNicknameTaken,
    createMember,
    findExistingTempAccount
} from '$lib/server/auth/register.js';
import { generateAppLoginCode } from '$lib/server/auth/jwt.js';
import type { OAuthUserProfile } from '$lib/server/auth/oauth/types.js';

const APPLE_ISSUER = 'https://appleid.apple.com';
// Apple 공개키(JWKS)는 회전되므로 원격 세트로 검증(jose 가 캐시/회전 처리)
const appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

interface AppleIdToken {
    sub: string;
    email?: string;
    email_verified?: string | boolean;
}

function buildTempNickname(): string {
    const rand = crypto.randomUUID().replace(/-/g, '').slice(0, 6);
    return `tmp_apple_${rand}`.slice(0, 20);
}

async function generateUniqueTempNickname(): Promise<string> {
    for (let i = 0; i < 20; i++) {
        const candidate = buildTempNickname();
        if (!(await isNicknameTaken(candidate))) {
            return candidate;
        }
    }
    throw new Error('임시 닉네임 생성 실패');
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
    let body: { identityToken?: string; email?: string };
    try {
        body = await request.json();
    } catch {
        return json({ success: false, error: 'invalid_body' }, { status: 400 });
    }

    const identityToken = body.identityToken;
    if (!identityToken) {
        return json({ success: false, error: 'missing_token' }, { status: 400 });
    }

    // 1. Apple identityToken 검증 (서명 + iss + aud)
    // 네이티브 앱 토큰의 aud 는 앱 번들ID(net.damoang.app)이고, 웹 OAuth 의 client_id 는
    // Services ID 일 수 있어 서로 다르다. 앱 번들ID(env 우선, 기본 net.damoang.app)와
    // 설정된 apple_bundle_id 둘 다 유효 aud 로 허용한다.
    const keys = await getOAuthKeys();
    const appBundleId = env.APPLE_APP_BUNDLE_ID || 'net.damoang.app';
    const audiences = [appBundleId, keys.apple_bundle_id].filter(Boolean);

    let payload: AppleIdToken;
    try {
        const verified = await jwtVerify(identityToken, appleJwks, {
            issuer: APPLE_ISSUER,
            audience: audiences
        });
        payload = verified.payload as unknown as AppleIdToken;
    } catch {
        return json({ success: false, error: 'invalid_token' }, { status: 401 });
    }

    const identifier = payload.sub;
    if (!identifier) {
        return json({ success: false, error: 'invalid_token' }, { status: 401 });
    }
    // 이메일은 최초 로그인 토큰에만 포함될 수 있음. 토큰 → 앱 전달값 순으로 사용.
    const email = payload.email || body.email || '';

    const profile: OAuthUserProfile = {
        provider: 'apple',
        identifier,
        displayName: '',
        email,
        photoUrl: '',
        profileUrl: ''
    };

    try {
        // 2. 회원 해석 (웹 콜백 app 모드와 동일 규칙)
        const existingProfile = await findSocialProfile('apple', identifier);
        let mbId: string | null = existingProfile?.mb_id ?? null;

        if (!mbId && email) {
            const byEmail = await findMemberByEmail(email);
            if (byEmail) {
                mbId = byEmail.mb_id;
            }
        }

        // 3. 신규: 임시 계정 즉시 생성 (앱 흐름 — /register 로 보내면 앱 복귀가 끊김)
        if (!mbId) {
            const baseMbId = generateSocialMbId('apple', identifier);
            const existingTemp = await findExistingTempAccount(baseMbId);
            if (existingTemp) {
                mbId = existingTemp.mb_id;
            } else {
                const nickname = await generateUniqueTempNickname();
                mbId = baseMbId;
                if (await isMbIdTaken(mbId)) {
                    mbId = `${mbId}_${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`;
                }
                await createMember({
                    mb_id: mbId,
                    mb_nick: nickname,
                    mb_email: email,
                    mb_name: nickname,
                    mb_ip: getClientAddress(),
                    skipNickLock: true
                });
            }
        }

        // 4. 회원 활성 확인
        const member = await getMemberById(mbId);
        if (!member || !isMemberActive(member)) {
            return json({ success: false, error: 'account_inactive' }, { status: 403 });
        }

        // 5. 소셜 프로필 갱신 + app-login 코드 발급
        await upsertSocialProfile(mbId, 'apple', profile);
        const code = await generateAppLoginCode({
            mb_id: member.mb_id,
            mb_nick: member.mb_nick,
            mb_level: Number(member.mb_level ?? 1),
            mb_email: member.mb_email || ''
        });

        return json({ success: true, code });
    } catch (err) {
        console.error('[Native Apple]', err instanceof Error ? err.message : 'unknown');
        return json({ success: false, error: 'server_error' }, { status: 500 });
    }
};
