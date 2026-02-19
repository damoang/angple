/**
 * @angple/plugin-mention
 * @멘션 파싱 및 알림 시스템 플러그인
 *
 * 이 플러그인은 댓글 내용에서 @username 패턴을 감지하여
 * 사용자 프로필 링크로 변환하고, 멘션된 사용자에게 알림을 보냅니다.
 */

export { parseMentions, MENTION_REGEX } from './hooks/parse-mentions';
export { sendMentionNotification } from './hooks/send-notification';
