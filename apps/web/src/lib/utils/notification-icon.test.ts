/**
 * 알림 종류 → 아이콘 매핑.
 *
 * 아이콘 컴포넌트(.svelte)를 서버 테스트에서 컴파일하지 않도록 이름 문자열로 대신한다.
 * 여기서 보는 것은 「어떤 종류가 어떤 아이콘으로 가는가」뿐이다.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@lucide/svelte/icons/at-sign', () => ({ default: 'AtSign' }));
vi.mock('@lucide/svelte/icons/file-text', () => ({ default: 'FileText' }));
vi.mock('@lucide/svelte/icons/heart', () => ({ default: 'Heart' }));
vi.mock('@lucide/svelte/icons/info', () => ({ default: 'Info' }));
vi.mock('@lucide/svelte/icons/layers', () => ({ default: 'Layers' }));
vi.mock('@lucide/svelte/icons/mail', () => ({ default: 'Mail' }));
vi.mock('@lucide/svelte/icons/message-square', () => ({ default: 'MessageSquare' }));
vi.mock('@lucide/svelte/icons/newspaper', () => ({ default: 'Newspaper' }));
vi.mock('@lucide/svelte/icons/reply', () => ({ default: 'Reply' }));
vi.mock('@lucide/svelte/icons/star', () => ({ default: 'Star' }));
vi.mock('@lucide/svelte/icons/tag', () => ({ default: 'Tag' }));
vi.mock('@lucide/svelte/icons/user-plus', () => ({ default: 'UserPlus' }));

const { getNotificationIcon } = await import('./notification-icon');

describe('getNotificationIcon', () => {
    it('키워드 알림은 태그 아이콘', () => {
        expect(getNotificationIcon('keyword')).toBe('Tag');
    });

    it('키워드 알림은 구독·팔로우 새 글, 모르는 타입과 다른 아이콘', () => {
        const keyword = getNotificationIcon('keyword');
        expect(keyword).not.toBe(getNotificationIcon('subscribe'));
        expect(keyword).not.toBe(getNotificationIcon('follow'));
        expect(keyword).not.toBe(getNotificationIcon('what_is_this'));
    });

    it('기존 매핑은 그대로다', () => {
        expect(getNotificationIcon('comment')).toBe('MessageSquare');
        expect(getNotificationIcon('subscribe')).toBe('FileText');
        expect(getNotificationIcon('follow')).toBe('UserPlus');
        expect(getNotificationIcon('what_is_this')).toBe('Info');
    });
});
