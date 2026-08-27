/**
 * ⛔ 2026-08-27 긴급 잠금 — 계정 복구 경로를 닫는다.
 *
 * 왜: `inspectSocialMbIdOccupant` 가 `generateSocialMbId` **해시만** 보고
 *     "당신의 이전 계정입니다"라고 안내한다. 그 계정이 정말 이 소셜 신원에
 *     묶여 있는지(`g5_member_social_profiles`) 확인하지 않는다.
 *
 *     해시는 `adler32(md5(identifier))` 인데, md5 를 **hex 문자열 32자**로
 *     받아 adler32 를 건다. 도달 가능한 값이 2^32 의 1/87 이하로 접혀
 *     서로 다른 사람의 신원이 같은 mb_id 로 충돌한다(실측: 충돌 그룹 410개).
 *
 *     실사고 확인 — kakao 신원 5049479848 과 3427320197 이 둘 다
 *     `kakao_8bf108d1` 로 해싱된다. 남이 그 계정으로 로그인했고, 다른 건에서는
 *     침입자가 원 주인의 닉네임까지 바꿨다.
 *
 * ⛔ 이건 응급 지혈이지 수정이 아니다. 구멍은 register.ts 의
 *    `inspectSocialMbIdOccupant` 에 그대로 있다. 소유 확인을 넣어 고친 뒤
 *    이 잠금을 풀어야 한다.
 *
 * 대가: 정당한 복구 요청이 하루 0.8건(7/27~8/27 총 23건) 막힌다.
 *       전부 contact@damoang.net 안내로 돌린다.
 */
export const ACCOUNT_RECOVERY_LOCKED = true;

/** 잠금 중 회원에게 보여줄 문구. 원인을 노출하지 않는다. */
export const ACCOUNT_RECOVERY_LOCKED_MESSAGE =
    '이전 계정 복구 기능을 점검하고 있습니다. contact@damoang.net 으로 문의해 주시면 확인 후 도와드리겠습니다.';
