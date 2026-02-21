import type { Board, BoardPermissions, DamoangUser } from '$lib/api/types.js';

export type PermissionAction =
    | 'can_list'
    | 'can_read'
    | 'can_write'
    | 'can_reply'
    | 'can_comment'
    | 'can_upload'
    | 'can_download';

const ACTION_LEVEL_MAP: Record<PermissionAction, keyof Board> = {
    can_list: 'list_level',
    can_read: 'read_level',
    can_write: 'write_level',
    can_reply: 'reply_level',
    can_comment: 'comment_level',
    can_upload: 'upload_level',
    can_download: 'download_level'
};

const ACTION_NAMES: Record<PermissionAction, string> = {
    can_list: '목록 보기',
    can_read: '글 읽기',
    can_write: '글쓰기',
    can_reply: '답글 작성',
    can_comment: '댓글 작성',
    can_upload: '파일 업로드',
    can_download: '파일 다운로드'
};

/**
 * 서버 permissions 우선, 없으면 클라이언트 레벨 비교 폴백
 */
export function checkPermission(
    board: Board | undefined | null,
    action: PermissionAction,
    user: DamoangUser | null
): boolean {
    if (!user) return false;

    // 서버에서 계산된 권한 정보가 있으면 사용
    if (board?.permissions) {
        return board.permissions[action];
    }

    // 하위호환: 클라이언트에서 레벨 비교
    const userLevel = user.mb_level ?? 1;
    const levelKey = ACTION_LEVEL_MAP[action];
    const requiredLevel = (board?.[levelKey] as number) ?? 1;
    return userLevel >= requiredLevel;
}

/**
 * 권한 부족 시 안내 메시지 생성
 */
export function getPermissionMessage(
    board: Board | undefined | null,
    action: PermissionAction,
    user: DamoangUser | null
): string {
    const actionName = ACTION_NAMES[action];
    const levelKey = ACTION_LEVEL_MAP[action];
    const requiredLevel = (board?.[levelKey] as number) ?? 1;

    if (!user) {
        return `${actionName}을(를) 하려면 로그인이 필요합니다.`;
    }

    return `${actionName} 권한이 없습니다. 레벨 ${requiredLevel} 이상이 필요합니다. (현재 레벨: ${user.mb_level ?? 1})`;
}

/**
 * 해당 action에 필요한 레벨 반환
 */
export function getRequiredLevel(
    board: Board | undefined | null,
    action: PermissionAction
): number {
    const levelKey = ACTION_LEVEL_MAP[action];
    return (board?.[levelKey] as number) ?? 1;
}

/**
 * 서버 permissions 객체에서 모든 권한을 한번에 확인
 */
export function getAllPermissions(
    board: Board | undefined | null,
    user: DamoangUser | null
): BoardPermissions {
    return {
        can_list: checkPermission(board, 'can_list', user),
        can_read: checkPermission(board, 'can_read', user),
        can_write: checkPermission(board, 'can_write', user),
        can_reply: checkPermission(board, 'can_reply', user),
        can_comment: checkPermission(board, 'can_comment', user),
        can_upload: checkPermission(board, 'can_upload', user),
        can_download: checkPermission(board, 'can_download', user)
    };
}
