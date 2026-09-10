/**
 * 회원 메모 보유 여부 store.
 *
 * `GET /api/v1/members/batch/memo` 는 "지금 로그인한 회원이 이 작성자들에게 남긴 메모"를
 * 돌려준다. 메모를 한 번도 쓰지 않은 회원에게 이 응답은 **언제나** 빈 객체다.
 * 그런데 목록을 넘길 때마다 다시 묻는다 — 결과를 미리 아는 질문이다.
 *
 * 백엔드가 응답에 `has_any` 를 함께 주므로, 한 번 `false` 를 받으면 그 뒤로는 부르지 않는다.
 *
 * ⛔ 모듈 상태다. 새로고침하면 다시 확인한다 — 일부러 그렇게 뒀다.
 *    localStorage 에 담으면 다른 기기에서 메모를 지웠을 때 오래 어긋난다.
 *
 * ⛔ 호출부는 3곳이고 그중 하나는 premium 플러그인이다(member-memo). 셋 다 이 store 를 봐야
 *    효과가 난다. 하나라도 빠지면 그 경로가 계속 호출한다.
 */

/** null = 아직 모름 · true = 가진 게 있다 · false = 하나도 없다 */
let hasAnyMemo = $state<boolean | null>(null);

export const memoPresence = {
    /**
     * 호출을 건너뛰어도 되는가.
     *
     * ⛔ `null`(아직 모름)일 때는 **반드시 false** 다. 모르면 부르는 쪽이 안전하다 —
     *    잘못 건너뛰면 메모가 안 보인다.
     */
    get canSkip(): boolean {
        return hasAnyMemo === false;
    },

    /**
     * batch/memo 응답의 `has_any` 를 반영한다.
     *
     * ⛔ **엄격 비교**다. 키가 없는(구버전) 응답은 `undefined` 로 오는데, 그걸 `false` 로
     *    해석하면 메모가 통째로 안 보인다. 불리언일 때만 받아들인다.
     */
    note(hasAny: unknown): void {
        if (hasAny === true) hasAnyMemo = true;
        else if (hasAny === false) hasAnyMemo = false;
    },

    /** 메모를 새로 저장했다 — 이제 확실히 가진 게 있다. */
    markCreated(): void {
        hasAnyMemo = true;
    },

    /** 로그인 주체가 바뀌면 앞 회원의 판단을 물려주면 안 된다. */
    reset(): void {
        hasAnyMemo = null;
    }
};
