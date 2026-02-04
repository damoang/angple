/**
 * 콘텐츠 필터 훅
 *
 * 소프트 삭제된 게시물의 콘텐츠를 "[삭제된 게시물입니다]"로 대체합니다.
 * 관리자에게는 원본 + 삭제 표시를 보여줍니다.
 */

import type { HookManager } from '@angple/hook-system';
import type { PluginLogger } from '@angple/plugin-engine';

interface PostContent {
    id: string | number;
    title: string;
    content: string;
    deletedAt?: string;
    /** 현재 사용자 역할 */
    viewerRole?: 'admin' | 'author' | 'user' | 'guest';
}

interface SettingsAccessor {
    get(key: string): unknown;
}

/**
 * 콘텐츠 필터 훅 설정
 */
export function setupContentFilter(
    hooks: HookManager,
    settings: SettingsAccessor,
    logger: PluginLogger
): void {
    hooks.addFilter('post_content', (post: PostContent): PostContent => {
        // 삭제되지 않은 게시물은 그대로 통과
        if (!post.deletedAt) return post;

        const visibility = settings.get('history_visibility') as string;
        const viewerRole = post.viewerRole ?? 'guest';

        // 관리자는 항상 원본 볼 수 있음
        if (viewerRole === 'admin') {
            return {
                ...post,
                title: `[삭제됨] ${post.title}`,
                // 원본 콘텐츠 유지
            };
        }

        // 작성자 + 관리자 모드에서 작성자인 경우
        if (visibility === 'author_admins' && viewerRole === 'author') {
            return {
                ...post,
                title: `[삭제됨] ${post.title}`,
            };
        }

        // 일반 사용자 → 콘텐츠 숨김
        return {
            ...post,
            title: '[삭제된 게시물입니다]',
            content: '<p class="text-muted-foreground italic">이 게시물은 삭제되었습니다.</p>'
        };
    }, 5);
}
