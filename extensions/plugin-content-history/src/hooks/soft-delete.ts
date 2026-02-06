/**
 * 소프트 삭제 훅
 *
 * before_post_delete 필터에 등록되어 실제 삭제를 가로채고
 * deleted_at 필드를 설정하는 소프트 삭제로 변환합니다.
 */

import type { HookManager } from '@angple/hook-system';
import type { PluginLogger } from '@angple/plugin-engine';

interface DeleteContext {
    postId: string | number;
    userId: string;
    reason?: string;
    /** true면 소프트 삭제로 처리됨 */
    softDeleted?: boolean;
    /** 삭제를 진행할지 여부 (false면 실제 삭제 중단) */
    proceed: boolean;
}

/**
 * 소프트 삭제 훅 설정
 */
export function setupSoftDelete(hooks: HookManager, logger: PluginLogger): void {
    hooks.addFilter(
        'before_post_delete',
        (context: DeleteContext): DeleteContext => {
            logger.info(`소프트 삭제 처리: postId=${context.postId}`);

            // 실제 삭제를 중단하고 소프트 삭제로 표시
            return {
                ...context,
                softDeleted: true,
                proceed: false // 실제 삭제 중단
            };
        },
        1
    ); // 최우선 실행
}
