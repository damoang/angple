/**
 * Admin 사이트 설정 타입 정의
 */

import type { OAuthProvider } from '$lib/api/types.js';

/** OAuth 프로바이더별 설정 */
export interface OAuthProviderConfig {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    /** 프로바이더별 추가 필드 (예: Apple의 teamId, keyId) */
    extra?: Record<string, string>;
}

/** OAuth 프로바이더 메타 정보 (UI용) */
export interface OAuthProviderMeta {
    id: OAuthProvider;
    name: string;
    color: string;
    consoleUrl: string;
    fields: { key: string; label: string; placeholder: string }[];
    extraFields?: { key: string; label: string; placeholder: string }[];
}

/** 일반 설정 */
export interface GeneralSettings {
    siteName: string;
    siteDescription: string;
}

/** OAuth 설정 */
export type OAuthSettings = Record<OAuthProvider, OAuthProviderConfig>;

/** 분석 설정 */
export interface AnalyticsSettings {
    ga4MeasurementId: string;
}

/** API 키 서비스별 설정 */
export interface ApiKeyServiceConfig {
    enabled: boolean;
    [key: string]: unknown;
}

/** API 키 설정 */
export interface ApiKeysSettings {
    openai: { apiKey: string; enabled: boolean };
    anthropic: { apiKey: string; enabled: boolean };
    googleMaps: { apiKey: string; enabled: boolean };
    aws: { accessKeyId: string; secretAccessKey: string; region: string; enabled: boolean };
    smtp: { host: string; port: number; username: string; password: string; enabled: boolean };
    pushNotification: { fcmServerKey: string; enabled: boolean };
}

/** API 키 서비스 메타 정보 (UI용) */
export interface ApiKeyServiceMeta {
    id: keyof ApiKeysSettings;
    name: string;
    description: string;
    consoleUrl: string;
    fields: {
        key: string;
        label: string;
        placeholder: string;
        type?: 'text' | 'password' | 'number';
    }[];
}

/** 사이트 전체 설정 */
export interface SiteSettings {
    general: GeneralSettings;
    oauth: OAuthSettings;
    analytics: AnalyticsSettings;
    apiKeys: ApiKeysSettings;
}

/** 기본 OAuth 프로바이더 설정 */
function defaultOAuthProvider(): OAuthProviderConfig {
    return { enabled: false, clientId: '', clientSecret: '' };
}

/** 기본 사이트 설정 */
export const DEFAULT_SITE_SETTINGS: SiteSettings = {
    general: {
        siteName: '',
        siteDescription: ''
    },
    oauth: {
        google: defaultOAuthProvider(),
        kakao: defaultOAuthProvider(),
        naver: defaultOAuthProvider(),
        apple: { ...defaultOAuthProvider(), extra: { teamId: '', keyId: '' } },
        facebook: defaultOAuthProvider(),
        twitter: defaultOAuthProvider(),
        payco: defaultOAuthProvider()
    },
    analytics: {
        ga4MeasurementId: ''
    },
    apiKeys: {
        openai: { apiKey: '', enabled: false },
        anthropic: { apiKey: '', enabled: false },
        googleMaps: { apiKey: '', enabled: false },
        aws: { accessKeyId: '', secretAccessKey: '', region: 'ap-northeast-2', enabled: false },
        smtp: { host: '', port: 587, username: '', password: '', enabled: false },
        pushNotification: { fcmServerKey: '', enabled: false }
    }
};

/** OAuth 프로바이더 메타 목록 */
export const OAUTH_PROVIDER_META: OAuthProviderMeta[] = [
    {
        id: 'google',
        name: 'Google',
        color: '#4285F4',
        consoleUrl: 'https://console.cloud.google.com/apis/credentials',
        fields: [
            { key: 'clientId', label: 'Client ID', placeholder: 'xxxx.apps.googleusercontent.com' },
            { key: 'clientSecret', label: 'Client Secret', placeholder: 'GOCSPX-xxxx' }
        ]
    },
    {
        id: 'kakao',
        name: 'Kakao',
        color: '#FEE500',
        consoleUrl: 'https://developers.kakao.com/console/app',
        fields: [
            { key: 'clientId', label: 'REST API Key', placeholder: 'Kakao REST API Key' },
            { key: 'clientSecret', label: 'Client Secret', placeholder: 'Kakao Client Secret' }
        ]
    },
    {
        id: 'naver',
        name: 'Naver',
        color: '#03C75A',
        consoleUrl: 'https://developers.naver.com/apps',
        fields: [
            { key: 'clientId', label: 'Client ID', placeholder: 'Naver Client ID' },
            { key: 'clientSecret', label: 'Client Secret', placeholder: 'Naver Client Secret' }
        ]
    },
    {
        id: 'apple',
        name: 'Apple',
        color: '#000000',
        consoleUrl: 'https://developer.apple.com/account/resources/identifiers/list/serviceId',
        fields: [
            { key: 'clientId', label: 'Service ID', placeholder: 'com.example.service' },
            {
                key: 'clientSecret',
                label: 'Private Key (PEM)',
                placeholder: '-----BEGIN PRIVATE KEY-----'
            }
        ],
        extraFields: [
            { key: 'teamId', label: 'Team ID', placeholder: 'ABCDE12345' },
            { key: 'keyId', label: 'Key ID', placeholder: 'FGHIJ67890' }
        ]
    },
    {
        id: 'facebook',
        name: 'Facebook',
        color: '#1877F2',
        consoleUrl: 'https://developers.facebook.com/apps',
        fields: [
            { key: 'clientId', label: 'App ID', placeholder: 'Facebook App ID' },
            { key: 'clientSecret', label: 'App Secret', placeholder: 'Facebook App Secret' }
        ]
    },
    {
        id: 'twitter',
        name: 'X (Twitter)',
        color: '#000000',
        consoleUrl: 'https://developer.x.com/en/portal/dashboard',
        fields: [
            { key: 'clientId', label: 'Client ID', placeholder: 'Twitter OAuth 2.0 Client ID' },
            { key: 'clientSecret', label: 'Client Secret', placeholder: 'Twitter Client Secret' }
        ]
    },
    {
        id: 'payco',
        name: 'PAYCO',
        color: '#E42529',
        consoleUrl: 'https://developers.payco.com',
        fields: [
            { key: 'clientId', label: 'Client ID', placeholder: 'PAYCO Client ID' },
            { key: 'clientSecret', label: 'Client Secret', placeholder: 'PAYCO Client Secret' }
        ]
    }
];

/** API 키 서비스 메타 목록 */
export const API_KEY_SERVICE_META: ApiKeyServiceMeta[] = [
    {
        id: 'openai',
        name: 'OpenAI',
        description: 'GPT, DALL-E 등 AI 서비스',
        consoleUrl: 'https://platform.openai.com/api-keys',
        fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'sk-...', type: 'password' }]
    },
    {
        id: 'anthropic',
        name: 'Anthropic',
        description: 'Claude AI 서비스',
        consoleUrl: 'https://console.anthropic.com/settings/keys',
        fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'sk-ant-...', type: 'password' }]
    },
    {
        id: 'googleMaps',
        name: 'Google Maps',
        description: '지도 및 위치 서비스',
        consoleUrl: 'https://console.cloud.google.com/apis/credentials',
        fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'AIza...', type: 'password' }]
    },
    {
        id: 'aws',
        name: 'AWS',
        description: 'S3, SES 등 클라우드 서비스',
        consoleUrl: 'https://console.aws.amazon.com/iam/home#/security_credentials',
        fields: [
            { key: 'accessKeyId', label: 'Access Key ID', placeholder: 'AKIA...' },
            {
                key: 'secretAccessKey',
                label: 'Secret Access Key',
                placeholder: '...',
                type: 'password'
            },
            { key: 'region', label: 'Region', placeholder: 'ap-northeast-2' }
        ]
    },
    {
        id: 'smtp',
        name: 'SMTP',
        description: '이메일 발송 서비스',
        consoleUrl: '',
        fields: [
            { key: 'host', label: 'Host', placeholder: 'smtp.gmail.com' },
            { key: 'port', label: 'Port', placeholder: '587', type: 'number' },
            { key: 'username', label: 'Username', placeholder: 'user@example.com' },
            { key: 'password', label: 'Password', placeholder: '...', type: 'password' }
        ]
    },
    {
        id: 'pushNotification',
        name: 'Push Notification',
        description: 'FCM 푸시 알림',
        consoleUrl: 'https://console.firebase.google.com',
        fields: [
            { key: 'fcmServerKey', label: 'FCM Server Key', placeholder: '...', type: 'password' }
        ]
    }
];
