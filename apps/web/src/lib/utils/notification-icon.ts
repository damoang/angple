/**
 * 알림 종류 → lucide 아이콘.
 *
 * 색·이모지·이름은 `notification-type.ts` 가 단일 근원이다. 여기는 컴포넌트 참조만
 * 담당한다 — 아이콘 임포트를 순수 모듈에 섞으면 단위 테스트가 svelte 변환에 묶인다.
 *
 * ⛔ 드롭다운(`notification-dropdown.svelte`)과 알림함(`routes/notifications`)이
 *    **같은 함수를 import** 해야 한다. 예전에는 두 곳에 switch 문이 복붙돼 있어서
 *    한쪽만 고치면 같은 알림이 화면마다 다른 아이콘으로 보였다(bug/13242 작업 중 발견).
 */
import AtSign from '@lucide/svelte/icons/at-sign';
import FileText from '@lucide/svelte/icons/file-text';
import Heart from '@lucide/svelte/icons/heart';
import Info from '@lucide/svelte/icons/info';
import Layers from '@lucide/svelte/icons/layers';
import Mail from '@lucide/svelte/icons/mail';
import MessageSquare from '@lucide/svelte/icons/message-square';
import Newspaper from '@lucide/svelte/icons/newspaper';
import Reply from '@lucide/svelte/icons/reply';
import Star from '@lucide/svelte/icons/star';
import UserPlus from '@lucide/svelte/icons/user-plus';

export function getNotificationIcon(type: string) {
    switch (type) {
        case 'comment':
            return MessageSquare;
        case 'reply':
            return Reply;
        case 'mention':
            return AtSign;
        case 'like':
        case 'like_comment':
            return Heart;
        case 'memo':
            return Mail;
        case 'subscribe':
            return FileText;
        case 'follow':
            return UserPlus;
        case 'digest':
            return Newspaper;
        case 'levelup':
            return Star;
        // 여러 종류가 섞인 묶음 — 겹친 모양으로 "여러 개"를 나타낸다 (bug/13332).
        // ⛔ Bell 은 알림 종 버튼이 이미 쓰고 있어 헷갈린다.
        case 'merged_post':
        case 'merged_comment':
        case 'merged':
            return Layers;
        default:
            return Info;
    }
}
