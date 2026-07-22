/**
 * 나눔 게임 방식 정의 — 백엔드 domain/giving/method.go 와 값 일치 필수.
 */

export type GivingMethod = 'lowest_unique' | 'random' | 'ladder' | 'curation' | 'host_pick';

export const GIVING_METHODS: GivingMethod[] = [
    'lowest_unique',
    'random',
    'ladder',
    'curation',
    'host_pick'
];

export const DEFAULT_METHOD: GivingMethod = 'lowest_unique';

interface MethodInfo {
    label: string;
    /** 개설 폼 설명 */
    desc: string;
    /** 참가 시 포인트 소모 여부 */
    paid: boolean;
    /** 당첨자를 주최자가 직접 지명 */
    hostDesignated: boolean;
    /** 지명 시 사유 필수 */
    requiresReason: boolean;
}

export const METHOD_INFO: Record<GivingMethod, MethodInfo> = {
    lowest_unique: {
        label: '최저 유일 번호',
        desc: '포인트로 번호를 구매하고, 아무도 안 고른 번호 중 가장 낮은 번호 보유자가 당첨됩니다.',
        paid: true,
        hostDesignated: false,
        requiresReason: false
    },
    random: {
        label: '랜덤 추첨',
        desc: '무료로 응모하면 서버가 공개 시드로 무작위 당첨자를 뽑습니다. (검증 가능)',
        paid: false,
        hostDesignated: false,
        requiresReason: false
    },
    ladder: {
        label: '사다리타기',
        desc: '무료 참가. 서버가 시드로 사다리 결과를 확정하고, 애니메이션으로 재생합니다.',
        paid: false,
        hostDesignated: false,
        requiresReason: false
    },
    curation: {
        label: '댓글 큐레이션',
        desc: '무료. 댓글로 사연을 남기면 주최자가 읽고 선정합니다. (선정 사유 공개 필수)',
        paid: false,
        hostDesignated: true,
        requiresReason: true
    },
    host_pick: {
        label: '주최자 직접 지명',
        desc: '무료. 주최자가 참가자 중에서 재량으로 당첨자를 지정합니다. (사유 선택)',
        paid: false,
        hostDesignated: true,
        requiresReason: false
    }
};

export function methodLabel(m: string): string {
    return (METHOD_INFO as Record<string, MethodInfo>)[m]?.label ?? m;
}

export function isValidMethod(m: string): m is GivingMethod {
    return GIVING_METHODS.includes(m as GivingMethod);
}

/** 번호형(단가·최대번호 입력 필요) 방식 여부 */
export function isNumberMethod(m: string): boolean {
    return m === 'lowest_unique';
}

/** 정원(N) 입력이 의미있는 방식 여부 */
export function usesCapacity(m: string): boolean {
    return m === 'random' || m === 'ladder';
}
