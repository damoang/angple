const EXEMPT_BOARDS = new Set(['verification', 'promotion', 'overseas']);

export function isCertificationExemptBoard(boardId: string | null | undefined): boolean {
    return EXEMPT_BOARDS.has((boardId || '').trim());
}

export function requiresCertificationForBoard(boardId: string | null | undefined): boolean {
    return !isCertificationExemptBoard(boardId);
}

export function isCertifiedUser(user: { mb_certify?: string | null } | null | undefined): boolean {
    return !!user?.mb_certify;
}

export function canUseCertifiedAction(
    user: { mb_certify?: string | null } | null | undefined,
    boardId: string | null | undefined
): boolean {
    return isCertificationExemptBoard(boardId) || isCertifiedUser(user);
}

/**
 * 쪽지 발송 가능 여부 — 실명인증(mb_certify) 또는 mb_level 5+ (유료 광고주 등급·관리자).
 * mb_level(등급, XP as_level 아님)=5 는 결제 기간에만 부여되므로 강등 시 권한 자동 소멸.
 * 쪽지 전용 게이트 — 글쓰기·댓글 등 다른 실명 행위엔 canUseCertifiedAction 을 그대로 쓴다.
 */
export function canSendMessage(
    user: { mb_certify?: string | null; mb_level?: number } | null | undefined
): boolean {
    return isCertifiedUser(user) || (user?.mb_level ?? 0) >= 5;
}

export function getCertificationBlockedMessage(boardId?: string | null): string {
    if (isCertificationExemptBoard(boardId)) {
        return '';
    }
    return '실명인증이 필요합니다.';
}

export function goToCertification(): void {
    if (typeof window !== 'undefined') {
        window.location.href = '/register/cert';
    }
}
