/**
 * 회원 등급명 유틸리티
 * mb_level 숫자를 등급명으로 변환
 */

export const GRADE_NAMES: Record<number, string> = {
    1: '앙님💔',
    2: '앙님❤️',
    3: '앙님💛',
    4: '앙님💙',
    5: '광고앙💚',
    6: '운영자',
    7: '운영자',
    8: '관리자',
    9: '관리자',
    10: '최고관리자'
};

export function getGradeName(level: number): string {
    return GRADE_NAMES[level] ?? `Lv.${level}`;
}
