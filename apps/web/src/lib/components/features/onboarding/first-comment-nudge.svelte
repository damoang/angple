<script lang="ts">
    /**
     * 눈팅 신규회원 첫 댓글 넛지 배너 (성장 엔진 축B — 실험 B)
     *
     * 목표: 가입→첫 기여 전환율(12주 실측 14.2%) 개선.
     * 첫 기여가 댓글인 회원은 평균 13.5일이 걸린다 — 읽던 글의 댓글창 위에서
     * 부드럽게 첫 댓글을 유도해 이 소요일을 줄이는 것이 목표.
     *
     * 노출 조건 (전부 만족 시에만 — 실험 A welcome-onboarding 게이트 패턴 재사용):
     *  1) 로그인 && as_level ≤ 1 (XP 거의 없음 = 활동 전 — 프로필 조회 게이트)
     *  2) 내 프로필: 가입 5~21일 && 글/댓글 0 (눈팅만 하는 신규 미기여 회원)
     *     — 가입 직후 5일은 실험 A(홈 온보딩 카드) 구간이라 겹치지 않게 제외
     *  3) 닫기 안 누름 (localStorage)
     * 첫 기여를 하면 post_count/comment_count > 0 이 되어 자연히 사라진다.
     * 프로필 조회 실패 시 조용히 미노출 (넛지는 있으면 좋은 기능).
     *
     * 측정: 배포 주 이후 가입 코호트의 "댓글 첫 기여 소요일"(기준 13.5일)을
     * 주간 growth 리포트로 비교 — 코드 내 별도 이벤트 추적은 두지 않는다.
     */
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { apiClient } from '$lib/api/index.js';

    const DISMISS_KEY = 'angple_first_comment_nudge_dismissed';
    const MIN_DAYS = 5;
    const MAX_DAYS = 21;

    let show = $state(false);
    let checked = $state(false);

    $effect(() => {
        const user = authStore.user;
        if (checked || !user) return;
        if ((user.as_level ?? 1) > 1) {
            checked = true;
            return;
        }
        try {
            if (localStorage.getItem(DISMISS_KEY)) {
                checked = true;
                return;
            }
        } catch {
            checked = true;
            return;
        }
        checked = true;
        void (async () => {
            try {
                const profile = await apiClient.getMemberProfile(user.mb_id);
                const signedAt = new Date(profile.mb_datetime).getTime();
                const daysSince = (Date.now() - signedAt) / 86400000;
                const contributed = (profile.post_count ?? 0) + (profile.comment_count ?? 0) > 0;
                if (
                    !Number.isNaN(signedAt) &&
                    daysSince >= MIN_DAYS &&
                    daysSince <= MAX_DAYS &&
                    !contributed
                ) {
                    show = true;
                }
            } catch {
                // 프로필 조회 실패 시 조용히 미노출
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
