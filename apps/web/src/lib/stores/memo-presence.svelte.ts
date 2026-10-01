/**
 * 회원 메모 보유 여부 store.
 *
 * `GET /api/v1/members/batch/memo` 는 "지금 로그인한 회원이 이 작성자들에게 남긴 메모"를
 * 돌려준다. 메모를 한 번도 쓰지 않은 회원에게 이 응답은 **언제나** 빈 객체다.
 * 그런데 목록을 넘길 때마다 다시 묻는다 — 결과를 미리 아는 질문이다.
 *
 * 백엔드가 응답에 `has_any` 를 함께 주므로, 한 번 `false` 를 받으면 그 뒤로는 부르지 않는다.
 *
 * 메모를 가진 회원도 대부분의 화면에서는 작성자와 겹치는 메모가 없다. 그래서
 * 「내가 메모를 단 상대 ID 목록」(`GET /api/v1/members/me/memo-targets`)을 세션당 1회 받아 두고,
 * 화면 작성자와 **겹치는 ID만** 묻는다(`filterIds`). 목록을 모르면(실패·상한 초과·미배포)
 * 입력을 그대로 돌려줘 기존 동작으로 돌아간다.
 *
 * ⛔ 모듈 상태다. 새로고침하면 다시 확인한다 — 일부러 그렇게 뒀다.
 *    localStorage 에 담으면 다른 기기에서 메모를 지웠을 때 오래 어긋난다.
 *    targets 목록도 같은 이유로 모듈 상태에만 둔다.
 *
 * ⛔ 호출부는 3곳이고 그중 하나는 premium 플러그인이다(member-memo). 셋 다 이 store 를 봐야
 *    효과가 난다. 하나라도 빠지면 그 경로가 계속 호출한다.
 */

/** null = 아직 모름 · true = 가진 게 있다 · false = 하나도 없다 */
let hasAnyMemo = $state<boolean | null>(null);

/**
 * 내가 메모를 단 상대 ID 집합. null = 모름(아직 안 받음·실패·상한 초과) → 필터하지 않는다.
 *
 * ⛔ 렌더에 쓰이지 않으므로 반응형 상태가 아니다. 갱신은 항상 **새 Set 으로 재할당**한다.
 */
let targets: Set<string> | null = null;

/** 이번 세션에 목록 조회를 이미 끝냈는가(성공·실패 무관). true 면 다시 부르지 않는다. */
let targetsSettled = false;

/** 진행 중인 목록 조회. 동시에 여러 곳이 불러도 요청은 1번이다. */
let targetsPromise: Promise<Set<string> | null> | null = null;

/** reset() 마다 올라간다. 앞 회원의 진행 중 응답이 뒤늦게 도착해도 반영하지 않기 위함. */
let generation = 0;

const MEMO_TARGETS_URL = '/api/v1/members/me/memo-targets';

async function loadTargets(gen: number): Promise<Set<string> | null> {
    let loaded: Set<string> | null = null;
    let settle = true;
    try {
        const res = await fetch(MEMO_TARGETS_URL, { credentials: 'include' });
        if (res.status === 401 || res.status === 403) {
            // 비로그인/세션 만료 — 로그인 뒤 다시 물을 수 있게 확정하지 않는다.
            settle = false;
        } else if (res.ok) {
            const json = await res.json();
            const data = json?.data;
            if (
                json?.success === true &&
                data &&
                data.truncated === false &&
                Array.isArray(data.targets)
            ) {
                loaded = new Set(
                    (data.targets as unknown[]).filter(
                        (v): v is string => typeof v === 'string' && v !== ''
                    )
                );
            }
        }
    } catch {
        // 실패 = 모름. 기존 동작으로 돌아간다.
        loaded = null;
    }
    if (gen !== generation) return targets;
    targets = loaded;
    targetsSettled = settle;
    return targets;
}

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

    /**
     * 메모 대상 ID 목록을 세션(모듈)당 1회 불러온다. 진행 중이면 그 promise 를 공유한다.
     *
     * 실패·상한 초과(truncated)·비로그인이면 null(모름)로 남는다.
     */
    ensureTargets(): Promise<Set<string> | null> {
        if (targetsSettled) return Promise.resolve(targets);
        if (targetsPromise) return targetsPromise;
        const gen = generation;
        const p = loadTargets(gen).finally(() => {
            if (targetsPromise === p) targetsPromise = null;
        });
        targetsPromise = p;
        return p;
    },

    /**
     * 화면 작성자 ID 중 내가 메모를 단 상대만 돌려준다.
     *
     * ⛔ 목록을 모르면(null) **입력 그대로** 돌려준다 — 기존 동작. 빈 배열은 「물을 필요 없음」.
     */
    async filterIds(ids: string[]): Promise<string[]> {
        if (ids.length === 0) return ids;
        const set = await memoPresence.ensureTargets();
        if (!set) return ids;
        return ids.filter((id) => set.has(id));
    },

    /**
     * 메모를 새로 저장했다 — 이제 확실히 가진 게 있다.
     *
     * `targetId` 를 주면 대상 목록에도 넣는다(인자 없는 기존 호출과 호환).
     */
    markCreated(targetId?: string): void {
        hasAnyMemo = true;
        if (targetId && targets && !targets.has(targetId)) {
            const next = new Set(targets);
            next.add(targetId);
            targets = next;
        }
    },

    /**
     * 메모를 지웠다 — 대상 목록에서 뺀다.
     *
     * ⛔ hasAnyMemo 는 건드리지 않는다. 남은 메모가 있는지 여기서는 모른다.
     */
    markDeleted(targetId: string): void {
        if (!targetId || !targets || !targets.has(targetId)) return;
        const next = new Set(targets);
        next.delete(targetId);
        targets = next;
    },

    /** 로그인 주체가 바뀌면 앞 회원의 판단을 물려주면 안 된다. */
    reset(): void {
        hasAnyMemo = null;
        targets = null;
        targetsSettled = false;
        targetsPromise = null;
        generation++;
    }
};
