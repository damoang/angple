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
    mb_no: number;
    mb_name: string;
    mb_nick: string;
    mb_email: string;
    mb_level: number;
    mb_point: number;
    mb_today_login: string;
    mb_login_ip: string;
    mb_leave_date: string;
    mb_leave_reason: string;
    mb_intercept_date: string;
    mb_certify: string;
    mb_image_url: string;
    mb_image_updated_at: string | null;
    as_level: number;
    advertiser_end_date?: string | null;
    advertiser_status?: 'ongoing' | 'expired' | 'scheduled' | 'inactive' | null;
}

/** OAuth state 쿠키에 저장되는 데이터 */
export interface OAuthStateData {
    state: string;
    provider: SocialProvider;
    redirect: string;
    timestamp: number;
    /**
     * 추가 연결(link) 모드일 때 연결 대상 mb_id.
     * 서버 세션에서 직접 채워 넣으며, 클라이언트가 임의로 주입할 수 없음.
     * 콜백에서 `locals.user.id === linkTo` 를 재검증한다.
     */
    linkTo?: string;
    /**
     * 네이티브 앱 로그인 모드 (/auth/start?app=1).
     * 콜백 성공 시 웹 리다이렉트 대신 단명 app-login 코드를 발급해
     * damoang://oauth-callback 앱 스킴으로 복귀한다.
     */
    appMode?: boolean;
    /**
     * 앱 모드에서 "신규가입 명시적 허용" (/auth/start?app=1&signup=1).
     * 미설정(기본) + 매칭 실패 시 조용히 계정을 만들지 않고 앱에 error=no_account 로 복귀시킨다.
     * 사용자가 앱에서 "새로 시작"을 눌러 재시도할 때만 true 로 들어와 계정 생성을 허용한다.
     */
    allowSignup?: boolean;
    /**
     * 클라이언트가 error=no_account 응답을 이해하는지 여부 (/auth/start?...&nac=1).
     * 하위호환: 이 플래그를 보내지 않는 구버전 앱은 no_account 가드를 적용하지 않고
     * 기존(자동 임시계정 생성) 동작을 유지한다. 신규 앱만 no_account 안내를 받는다.
     */
    noAccountCapable?: boolean;
}
