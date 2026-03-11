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
