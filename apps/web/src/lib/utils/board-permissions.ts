import type { Board, BoardPermissions, DamoangUser } from '$lib/api/types.js';
import { getGradeName } from './grade.js';

export type PermissionAction =
    | 'can_list'
    | 'can_read'
    | 'can_write'
    | 'can_reply'
    | 'can_comment'
    | 'can_upload'
    | 'can_download';

type BoardPermissionTarget = Partial<
    Pick<
        Board,
        | 'list_level'
        | 'read_level'
        | 'write_level'
        | 'reply_level'
        | 'comment_level'
        | 'upload_level'
        | 'download_level'
        | 'permissions'
    >
>;

const ACTION_LEVEL_MAP: Record<PermissionAction, keyof BoardPermissionTarget> = {
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
    board: BoardPermissionTarget | undefined | null,
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
 * 자동 승급(매일 출석 7일)으로 도달하는 등급 — 앙님💛 (mb_level 3)
 */
const AUTO_PROMOTE_LEVEL = 3;

/**
 * 배지≠등급 착시 해소 문구 (hello/27814)
 * 닉네임 옆 숫자 배지(as_level, 활동 레벨)를 등급(mb_level)으로 오해하는 사례가 많다.
 */
export const BADGE_GRADE_NOTE = '닉네임 옆 숫자 배지는 활동 레벨이라 등급과는 달라요';

/**
 * 승급 경로 안내 문구. 자동 승급(출석 7일)으로 필요 등급에 도달 가능할 때만 반환.
 * mb_level(등급) 기준 — as_level(활동 레벨)을 넣지 말 것.
 */
export function getPromotionHint(requiredLevel: number, currentLevel: number): string | null {
    if (currentLevel >= requiredLevel) return null;
    if (requiredLevel > AUTO_PROMOTE_LEVEL || currentLevel >= AUTO_PROMOTE_LEVEL) return null;
    return '매일 출석 7일이면 자동으로 앙님💛 승급돼요!';
}

/**
 * 등급(mb_level) 부족 거부 안내 문구 생성.
 * 승급 경로(출석 7일 → 앙님💛)와 배지≠등급 구분을 함께 안내한다. (hello/27814)
 */
export function buildGradeDeniedMessage(
    actionName: string,
    requiredLevel: number,
    currentLevel: number
): string {
    const requiredGrade = getGradeName(requiredLevel);
    const promo = getPromotionHint(requiredLevel, currentLevel);
    if (promo) {
        return `${actionName}은(는) ${requiredGrade} 등급부터 가능해요. ${promo} (${BADGE_GRADE_NOTE})`;
    }
    return `${actionName}은(는) ${requiredGrade} 등급부터 가능해요. (현재 등급: ${getGradeName(currentLevel)} · ${BADGE_GRADE_NOTE})`;
}

/**
 * 권한 부족 시 안내 메시지 생성
 */
export function getPermissionMessage(
    board: BoardPermissionTarget | undefined | null,
    action: PermissionAction,
    user: DamoangUser | null
): string {
    const actionName = ACTION_NAMES[action];
    const levelKey = ACTION_LEVEL_MAP[action];
    const requiredLevel = (board?.[levelKey] as number) ?? 1;

    if (!user) {
        return `${actionName}을(를) 하려면 로그인이 필요합니다.`;
    }

    // 레벨(등급) 부족 사유 — 승급 경로와 배지≠등급 구분을 함께 안내
    return buildGradeDeniedMessage(actionName, requiredLevel, user.mb_level ?? 1);
}

/**
 * 해당 action에 필요한 레벨 반환
 */
export function getRequiredLevel(
    board: BoardPermissionTarget | undefined | null,
    action: PermissionAction
): number {
    const levelKey = ACTION_LEVEL_MAP[action];
    return (board?.[levelKey] as number) ?? 1;
}

/** 권한 안내 툴팁용 구조화 데이터 (등급명 포함) */
export interface RequirementHint {
    actionName: string;
    loggedIn: boolean;
    requiredLevel: number;
    requiredGrade: string;
    currentLevel: number | null;
    currentGrade: string | null;
}

/**
 * 글쓰기/댓글 비활성 시 호버 안내에 쓸 조건 데이터를 만든다.
 * 필요 등급명·현재 등급명을 함께 담아 친절한 안내가 가능하게 한다.
 */
export function getRequirementHint(
    board: BoardPermissionTarget | undefined | null,
    action: PermissionAction,
    user: DamoangUser | null
): RequirementHint {
    const requiredLevel = getRequiredLevel(board, action);
    const currentLevel = user?.mb_level ?? null;
    return {
        actionName: ACTION_NAMES[action],
        loggedIn: !!user,
        requiredLevel,
        requiredGrade: getGradeName(requiredLevel),
        currentLevel,
        currentGrade: currentLevel != null ? getGradeName(currentLevel) : null
    };
}

/**
 * 서버 permissions 객체에서 모든 권한을 한번에 확인
 */
export function getAllPermissions(
    board: BoardPermissionTarget | undefined | null,
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
