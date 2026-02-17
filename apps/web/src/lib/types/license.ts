/**
 * 라이선스 키 시스템 타입 정의
 *
 * 프리미엄 플러그인/테마의 라이선스 관리
 */

export type LicenseStatus = 'active' | 'expired' | 'revoked' | 'suspended';
export type LicenseType = 'plugin' | 'theme' | 'bundle';
export type LicenseTier = 'personal' | 'professional' | 'enterprise';

export interface LicenseKey {
    id: number;
    key: string;
    userId: number;
    userEmail: string;
    productId: number;
    productName: string;
    productType: LicenseType;
    tier: LicenseTier;
    status: LicenseStatus;
    maxDomains: number;
    activatedDomains: string[];
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
    orderId?: number;
}

export interface LicenseVerifyRequest {
    key: string;
    domain: string;
    productId: string;
}

export interface LicenseVerifyResponse {
    valid: boolean;
    status: LicenseStatus;
    tier: LicenseTier;
    expiresAt: string;
    productName: string;
    error?: string;
}

export interface LicenseCreateRequest {
    userId: number;
    productId: number;
    tier: LicenseTier;
    maxDomains: number;
    durationDays: number;
    orderId?: number;
}

/** 라이선스 티어별 메타 정보 */
export interface LicenseTierMeta {
    id: LicenseTier;
    name: string;
    maxDomains: number;
    features: string[];
}

export const LICENSE_TIER_META: LicenseTierMeta[] = [
    {
        id: 'personal',
        name: '개인',
        maxDomains: 1,
        features: ['단일 도메인', '기본 지원', '1년 업데이트']
    },
    {
        id: 'professional',
        name: '프로페셔널',
        maxDomains: 5,
        features: ['5개 도메인', '우선 지원', '1년 업데이트', '개발환경 무제한']
    },
    {
        id: 'enterprise',
        name: '엔터프라이즈',
        maxDomains: -1,
        features: ['무제한 도메인', '전담 지원', '영구 업데이트', '소스코드 접근']
    }
];

export function getLicenseStatusLabel(status: LicenseStatus): string {
    const labels: Record<LicenseStatus, string> = {
        active: '활성',
        expired: '만료',
        revoked: '해지',
        suspended: '정지'
    };
    return labels[status] || status;
}

export function getLicenseStatusColor(status: LicenseStatus): string {
    const colors: Record<LicenseStatus, string> = {
        active: 'text-green-600',
        expired: 'text-amber-600',
        revoked: 'text-red-600',
        suspended: 'text-orange-600'
    };
    return colors[status] || 'text-gray-600';
}
