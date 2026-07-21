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
    const MIN_DAYS = 5;
    const MAX_DAYS = 21;

    let show = $state(false);
    let checked = $state(false);

    $effect(() => {
        const user = authStore.user;
        if (checked || !user) return;
        checked = true;

        try {
            if (localStorage.getItem(DISMISS_KEY)) return;
        } catch {
            // localStorage 불가 환경 — 조용히 미노출
            return;
        }

        void (async () => {
            try {
                const res = await fetch('/api/me/onboarding-status');
                if (!res.ok) return;
                const data = (await res.json()) as {
                    signup_at: string | null;
                    last_contribution_at: string | null;
                };
                // 이미 기여한 회원에겐 띄우지 않는다.
                if (data.last_contribution_at) return;
                if (!data.signup_at) return;

                const signedAt = Date.parse(data.signup_at);
                if (Number.isNaN(signedAt)) return;

                const daysSince = (Date.now() - signedAt) / 86400000;
                if (daysSince >= MIN_DAYS && daysSince <= MAX_DAYS) {
                    show = true;
                }
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
