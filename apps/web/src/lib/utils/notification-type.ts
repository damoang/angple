/**
 * 알림 종류 표시 규칙 (bug/13242).
 *
 * ## 제보
 *
 * > 알림이 올 때 이 메시지가 댓글인지, 본문에 대한 좋아요인지, 아니면 댓글에 대한
 * > 좋아요인지 알아 보기가 어렵습니다. 알림 폭에 비해 아이디의 길이 등이 가변적이라
 * > **뒷문자열이 잘려서** 생기는 문제같은데요. 각 알림 앞에 접두어를 달면…
 *
 * ## 왜 앞에 붙여야 하는가
 *
 * 알림 제목은 `{닉네임}님이 회원님의 글에 댓글을 남겼습니다` 꼴이고 화면은 이것을
 * `line-clamp-1` 로 자른다. 즉 **종류를 알려주는 부분이 가장 먼저 사라진다.**
 * 닉네임이 길수록 정확히 종류만 없어진다 — 제보자 캡처가 그 상태였다.
 *
 * 그래서 종류 표식을 **문자열 맨 앞**에 둔다. 잘림은 뒤에서 일어나므로 앞은 항상 살아남는다.
 *
 * ## 이모지 두 글자 = [대상][동작]
 *
 * 사용자 결정(2026-08-05). 첫 글자만 보면 **글에 관한 일인지 댓글에 관한 일인지**
 * 바로 알 수 있다.
 *
 * | | 대상 | 동작 |
 * |---|---|---|
 * | 📄 글 | 💬 댓글 | ❤️ 공감 · ✍️ 작성 · ↩️ 답글 |
 *
 * ⛔ 색으로만 구분하지 말 것. 처음 설계에서 글 공감 ❤️ / 댓글 공감 💙 로 색만 달리
 *    했는데, 흑백 폴백에서는 같은 하트가 되어 구분이 사라진다. 모양이 달라야 한다.
 */

/** 백엔드 `mapNotificationType` 이 내려주는 값과 1:1 로 맞춘다. */
export type NotificationType =
    | 'comment'
    | 'reply'
    | 'like'
    | 'like_comment'
    | 'mention'
    | 'memo'
    | 'subscribe'
    | 'follow'
    | 'digest'
    | 'levelup'
    // 여러 종류가 한 줄로 묶인 알림. 대상(글/댓글)만 구분해 준다 — bug/13332
    | 'merged_post'
    | 'merged_comment'
    | 'merged'
    | 'system';

interface NotificationTypeMeta {
    /** 제목 앞에 붙는 표식 */
    emoji: string;
    /** 아이콘 색 (Tailwind) */
    color: string;
    /** 스크린리더·title 용 한글 이름. 이모지는 읽히지 않으므로 이쪽이 본문이다. */
    label: string;
}

const META: Record<NotificationType, NotificationTypeMeta> = {
    comment: { emoji: '📄💬', color: 'text-blue-500', label: '내 글에 댓글' },
    reply: { emoji: '💬↩️', color: 'text-green-500', label: '내 댓글에 답글' },
    like: { emoji: '📄❤️', color: 'text-red-500', label: '글 공감' },
    like_comment: { emoji: '💬❤️', color: 'text-rose-400', label: '댓글 공감' },
    mention: { emoji: '📣', color: 'text-purple-500', label: '멘션' },
    memo: { emoji: '✉️', color: 'text-orange-500', label: '쪽지' },
    subscribe: { emoji: '📄✍️', color: 'text-sky-600', label: '구독 게시판 새 글' },
    follow: { emoji: '👤✍️', color: 'text-teal-600', label: '팔로우한 분의 새 글' },
    digest: { emoji: '📰', color: 'text-amber-600', label: '새 글 요약' },
    levelup: { emoji: '⭐', color: 'text-yellow-500', label: '레벨업' },
    // 여러 종류가 섞인 묶음 — bug/13332
    //
    // ⛔ 처음엔 "개수가 제목에 있으니 표식은 필요 없다"고 판단해 회색으로 뒀는데, 그게 바로
    //    제보의 원인이었다. 「알림 묶어 보기」가 기본 켬이라 사실상 모든 알림이 같은 회색
    //    느낌표가 됐고, 제보자는 "댓글과 답글 구분이 어려워서 번거롭다"고 적었다.
    //    개수는 제목에 있어도, 목록을 훑을 때 눈이 먼저 닿는 건 왼쪽 아이콘이다.
    //
    //    한 종류뿐인 묶음은 백엔드가 정확한 종류로 내려주므로 여기 오지 않는다.
    //    여기는 진짜로 섞인 경우다 — 대상(글/댓글)만이라도 알려준다.
    merged_post: { emoji: '📄🔔', color: 'text-indigo-500', label: '내 글에 여러 반응' },
    merged_comment: { emoji: '💬🔔', color: 'text-violet-500', label: '내 댓글에 여러 반응' },
    // 옛 백엔드가 내려보내던 값 — be 배포 전에도 화면이 깨지지 않도록 남긴다.
    merged: { emoji: '🔔', color: 'text-muted-foreground', label: '여러 반응' },
    system: { emoji: '', color: 'text-muted-foreground', label: '알림' }
};

function meta(type: string): NotificationTypeMeta {
    // ⛔ 모르는 타입은 반드시 조용히 폴백해야 한다. 백엔드가 새 종류를 추가했을 때
    //    프론트가 먼저 배포돼 있어도(또는 그 반대여도) 알림함이 깨지면 안 된다.
    return META[type as NotificationType] ?? META.system;
}

/** 제목 앞에 붙일 표식. 없으면 빈 문자열. */
export function getNotificationEmoji(type: string): string {
    return meta(type).emoji;
}

/** 아이콘 색 (Tailwind 클래스) */
export function getNotificationColor(type: string): string {
    return meta(type).color;
}

/** 사람이 읽는 종류 이름 — title 속성과 스크린리더용 */
export function getNotificationLabel(type: string): string {
    return meta(type).label;
}
