<script lang="ts">
    /**
     * 눈팅 신규회원 첫 댓글 넛지 배너 (성장 엔진 축B — 실험 B)
     *
     * 목표: 가입 후 아무 기여도 하지 않는 신규 회원의 첫 댓글을 유도한다.
     * 최근 2주 가입자 589명 중 449명(76%)이 기여 0 이다.
     *
     * ⛔ 반드시 `comment-form` 의 `{#if canComment}` 블록 **안에서** 렌더할 것.
     *    자유게시판은 bo_comment_level=3 이라 신규(등급 2)는 댓글을 못 단다.
     *    권한 없는 곳에서 "첫 댓글을 남겨보세요" 를 띄우면 권해놓고 막는 꼴이라
     *    안 하느니만 못하다. 등급 장벽 자체는 분란 목적 가입을 거르는 장치라
     *    낮추지 않는다 — 막힐 일을 권하지 않는 것이 이 컴포넌트의 책임이다.
     *
     * 노출 조건 (전부 만족):
     *  1) 로그인
     *  2) 가입 5~21일 (0~5일은 실험 A 홈 온보딩 카드 구간이라 겹치지 않게 제외)
     *  3) 공개 기여 0건
     *  4) 닫기 안 누름 (localStorage)
     *
     * ⚠️ 상태 조회는 `/api/me/onboarding-status` 만 쓴다.
     *    이전 구현은 `apiClient.getMemberProfile()` 을 썼는데 이 백엔드 경로는
     *    죽어 있다 — 실존 회원과 없는 ID 가 똑같이 `{"data":null,"success":true}`
     *    를 반환한다(200). 그러면 예외 → catch → 조용히 미노출이라 노출이 0 이
     *    된다. 실험 A 가 11일간 겪은 실패가 정확히 이것이다.
     */
    import { authStore } from '$lib/stores/auth.svelte.js';

    const DISMISS_KEY = 'angple_first_comment_nudge_dismissed';
    const SETTLED_KEY_PREFIX = 'angple_first_comment_nudge_settled';
    const MIN_DAYS = 5;
    const MAX_DAYS = 21;
    const DAY_MS = 86400000;

    /**
     * 결론이 난 회원에게 다시 묻지 않기 위한 마커.
     *
     * ⛔ 왜 필요한가 — 이 넛지는 「가입 5~21일 · 기여 0건」만 대상이다. 그 밖의 회원은
     *    카드가 뜨지 않으니 닫을 일이 없고, 그래서 DISMISS_KEY 가 영영 안 생긴다.
     *    결과가 정해진 질문을 페이지마다 다시 하게 된다.
     *    onboarding-status 라우트 주석도 「호출량 억제는 클라이언트의 settled 마커가
     *    담당한다」고 적고 있는데, 정작 부르는 이 컴포넌트에 그 마커가 없었다.
     *
     * ⛔ 회원별 키다. 공용 브라우저에서 앞 회원의 결론이 다음 회원에게 새면 안 된다.
     *
     * 값: 'never' = 두 번 다시 해당 없음 · 숫자 = 그 시각까지 보류
     */
    function settledKey(mbId: string): string {
        return `${SETTLED_KEY_PREFIX}:${mbId}`;
    }

    function shouldAsk(mbId: string): boolean {
        try {
            const raw = localStorage.getItem(settledKey(mbId));
            if (!raw) return true;
            if (raw === 'never') return false;
            const until = Number(raw);
            // 값이 깨졌으면 묻는 쪽이 안전하다 — 잘못 막으면 넛지가 영영 안 뜬다.
            return !Number.isFinite(until) || Date.now() >= until;
        } catch {
            return true;
        }
    }

    function settle(mbId: string, until: number | 'never'): void {
        try {
            localStorage.setItem(settledKey(mbId), until === 'never' ? 'never' : String(until));
        } catch {
            /* localStorage 불가 환경 — 이번 세션에서만 조용히 넘어간다 */
        }
    }

    let show = $state(false);
    let checked = $state(false);

    $effect(() => {
        const user = authStore.user;
        if (checked || !user) return;
        checked = true;

        const mbId = user.mb_id;
        try {
            if (localStorage.getItem(DISMISS_KEY)) return;
        } catch {
            // localStorage 불가 환경 — 조용히 미노출
            return;
        }

        // 이미 결론이 난 회원이면 묻지 않는다.
        if (!shouldAsk(mbId)) return;

        void (async () => {
            try {
                const res = await fetch('/api/me/onboarding-status');
                if (!res.ok) return;
                const data = (await res.json()) as {
                    signup_at: string | null;
                    last_contribution_at: string | null;
                };
                // 이미 기여한 회원에겐 띄우지 않는다.
                // ⭐ 이 판정은 한 번 참이면 영영 참이다 — 「첫 댓글」은 되돌아오지 않는다.
                if (data.last_contribution_at) {
                    settle(mbId, 'never');
                    return;
                }
                // 가입 시각을 못 읽는 건 데이터 이상이다. 영구로 막지 말고 하루만 쉰다.
                if (!data.signup_at) {
                    settle(mbId, Date.now() + DAY_MS);
                    return;
                }

                const signedAt = Date.parse(data.signup_at);
                if (Number.isNaN(signedAt)) {
                    settle(mbId, Date.now() + DAY_MS);
                    return;
                }

                const daysSince = (Date.now() - signedAt) / DAY_MS;
                if (daysSince > MAX_DAYS) {
                    // 창이 지났다. 다시 열리지 않는다.
                    settle(mbId, 'never');
                    return;
                }
                if (daysSince < MIN_DAYS) {
                    // 아직 이르다. 창이 열리는 시각까지 쉰다.
                    settle(mbId, signedAt + MIN_DAYS * DAY_MS);
                    return;
                }

                show = true;
            } catch {
                // 조회 실패 시 조용히 미노출 (넛지는 있으면 좋은 기능)
            }
        })();
    });

    function dismiss() {
        show = false;
        try {
            localStorage.setItem(DISMISS_KEY, String(Date.now()));
        } catch {
            /* localStorage 불가 환경 — 세션 내 숨김만 */
        }
    }
</script>

{#if show}
    <div
        class="mb-2 flex items-center gap-2 rounded-lg border border-sky-200 bg-gradient-to-r from-sky-50 to-emerald-50 px-3 py-2 text-sm dark:border-sky-800/40 dark:from-sky-950/40 dark:to-emerald-950/30"
    >
        <span class="shrink-0" aria-hidden="true">💬</span>
        <p class="text-muted-foreground min-w-0 flex-1 leading-snug">
            첫 댓글을 남겨보세요 — 앙님들이 반겨줘요! 작은 한마디면 충분해요 💛
        </p>
        <button
            type="button"
            onclick={dismiss}
            class="text-muted-foreground hover:text-foreground shrink-0 rounded-full p-1 leading-none transition-colors"
            aria-label="첫 댓글 안내 닫기"
        >
            ✕
        </button>
    </div>
{/if}
