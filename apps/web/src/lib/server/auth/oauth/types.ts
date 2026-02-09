/**
 * OAuth 소셜로그인 타입 정의
 */

export type SocialProvider =
    | 'naver'
    | 'kakao'
    | 'google'
    | 'facebook'
    | 'apple'
    | 'twitter'
    | 'payco';

export interface OAuthProviderConfig {
    clientId: string;
    clientSecret: string;
    authorizeUrl: string;
    tokenUrl: string;
    profileUrl: string;
    scope: string;
    /** 콜백 URL (PHP 호환: /plugin/social/?hauth.done=Provider) */
    callbackUrl: string;
}

export interface OAuthTokenResponse {
    access_token: string;
    token_type?: string;
    refresh_token?: string;
    expires_in?: number;
    /** Apple id_token */
    id_token?: string;
}

export interface OAuthUserProfile {
    provider: SocialProvider;
    identifier: string;
    displayName: string;
    email: string;
    photoUrl: string;
    profileUrl: string;
}

/** g5_member_social_profiles 테이블 행 */
export interface SocialProfileRow {
    mp_no: number;
    mb_id: string;
    provider: string;
    object_sha: string;
    identifier: string;
    profileurl: string;
    photourl: string;
    displayname: string;
    description: string;
    mp_register_day: string;
    mp_latest_day: string;
}

/** g5_member 테이블 주요 필드 */
export interface MemberRow {
    mb_id: string;
    mb_name: string;
    mb_nick: string;
    mb_email: string;
    mb_level: number;
    mb_point: number;
    mb_today_login: string;
    mb_login_ip: string;
    mb_leave_date: string;
    mb_intercept_date: string;
}

/** OAuth state 쿠키에 저장되는 데이터 */
export interface OAuthStateData {
    state: string;
    provider: SocialProvider;
    redirect: string;
    timestamp: number;
}
