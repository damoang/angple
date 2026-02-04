/**
 * Content History Plugin
 *
 * 소프트 삭제 + 수정 이력 추적 플러그인
 * ExtensionContext를 통해 초기화됩니다.
 */

import type { ExtensionContext } from '@angple/plugin-engine';
import { setupSoftDelete } from './hooks/soft-delete';
import { setupContentFilter } from './hooks/content-filter';
import { setupHistoryTrack } from './hooks/history-track';

/**
 * 플러그인 초기화
 */
export function activate(context: ExtensionContext): void {
    const { hooks, settings, logger } = context;

    logger.info('Content History 플러그인 초기화 시작');

    // 소프트 삭제 훅 등록
    if (settings.get('enable_soft_delete')) {
        setupSoftDelete(hooks, logger);
        logger.info('소프트 삭제 훅 등록 완료');
    }

    // 콘텐츠 필터 훅 등록 (삭제된 게시물 표시 처리)
    setupContentFilter(hooks, settings, logger);

    // 수정 이력 추적 훅 등록
    const maxVersions = (settings.get('max_versions') as number) ?? 10;
    setupHistoryTrack(hooks, maxVersions, logger);

    logger.info('Content History 플러그인 초기화 완료');
}

/**
 * 플러그인 비활성화
 */
export function deactivate(): void {
    // 훅은 plugin-engine이 자동으로 제거
    console.log('[Content History] 플러그인 비활성화');
}
