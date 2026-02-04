/**
 * 수정 이력 추적 훅
 *
 * after_post_update 액션에 등록되어 게시물 수정 시 이전 버전을 저장합니다.
 */

import type { HookManager } from '@angple/hook-system';
import type { PluginLogger } from '@angple/plugin-engine';

/** 수정 이력 항목 */
export interface HistoryEntry {
    version: number;
    title: string;
    content: string;
    editedBy: string;
    editedAt: string;
    changeType: 'create' | 'update' | 'soft_delete' | 'restore';
}

/** 인메모리 이력 저장소 (추후 DB 연동) */
const historyStore: Map<string, HistoryEntry[]> = new Map();

/**
 * 수정 이력 추적 훅 설정
 */
export function setupHistoryTrack(
    hooks: HookManager,
    maxVersions: number,
    logger: PluginLogger
): void {
    hooks.addAction('after_post_update', (context: {
        postId: string | number;
        previousTitle: string;
        previousContent: string;
        newTitle: string;
        newContent: string;
        userId: string;
        changeType?: 'create' | 'update' | 'soft_delete' | 'restore';
    }) => {
        const postKey = String(context.postId);
        const entries = historyStore.get(postKey) ?? [];

        const newEntry: HistoryEntry = {
            version: entries.length + 1,
            title: context.previousTitle,
            content: context.previousContent,
            editedBy: context.userId,
            editedAt: new Date().toISOString(),
            changeType: context.changeType ?? 'update'
        };

        entries.push(newEntry);

        // 최대 버전 수 초과 시 오래된 것 제거
        while (entries.length > maxVersions) {
            entries.shift();
        }

        historyStore.set(postKey, entries);
        logger.info(`이력 저장: postId=${postKey}, version=${newEntry.version}`);
    }, 10);
}

/**
 * 게시물의 수정 이력 조회
 */
export function getPostHistory(postId: string | number): HistoryEntry[] {
    return historyStore.get(String(postId)) ?? [];
}

/**
 * 이력 저장소 접근 (테스트/API용)
 */
export function getHistoryStore(): Map<string, HistoryEntry[]> {
    return historyStore;
}
