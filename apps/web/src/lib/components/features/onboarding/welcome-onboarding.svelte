<script lang="ts">
    /**
     * 신규 회원 웰컴 온보딩 카드 (성장 엔진 축B — 실험 A)
     *
     * 목표: 가입→첫 기여 전환율 개선 (12주 실측 14.2%).
     * 노출 조건 (전부 만족 시에만):
     *  1) 로그인 && as_level ≤ 1 (XP 거의 없음 = 활동 전 — 프로필 조회 게이트)
     *  2) 내 프로필: 가입 14일 이내 && 글/댓글 0 (정확한 "신규 미기여" 판별)
     *  3) 닫기 안 누름 (localStorage)
     * 첫 기여를 하면 post_count/comment_count > 0 이 되어 자연히 사라진다.
     *
     * 첫 기여 유도는 가입인사(/hello) 게시판으로 — 자유게시판 등은 신규에게
     * 글쓰기가 제한될 수 있어, 항상 열려 있는 인사 게시판이 첫걸음으로 적합.
     */
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { apiClient } from '$lib/api/index.js';

    const DISMISS_KEY = 'angple_welcome_onboarding_dismissed';
    const NEW_MEMBER_DAYS = 14;

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
                if (!Number.isNaN(signedAt) && daysSince <= NEW_MEMBER_DAYS && !contributed) {
                    show = true;
                }
            } catch {
                // 프로필 조회 실패 시 조용히 미노출 (온보딩은 있으면 좋은 기능)
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
    <div class="mx-auto mb-4 max-w-5xl px-4 pt-4">
        <div
            class="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 px-5 py-4 shadow-sm dark:border-amber-800/40 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-yellow-950/30"
        >
            <button
                type="button"
                onclick={dismiss}
                class="text-muted-foreground hover:text-foreground absolute right-3 top-3 rounded-full p-1 text-lg leading-none transition-colors"
                aria-label="환영 안내 닫기"
            >
                ✕
            </button>

            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div class="shrink-0 text-4xl" aria-hidden="true">🐣</div>
                <div class="min-w-0 flex-1">
                    <p class="text-foreground text-base font-bold">앙님, 어서오세요! 💛</p>
                    <p class="text-muted-foreground mt-0.5 text-sm leading-relaxed">
                        가입인사를 남기면 앙님들이 우르르 반겨줘요. <b class="font-semibold"
                            >매일 출석 7일</b
                        >이면 자동으로
                        <span class="font-semibold text-amber-600 dark:text-amber-400">앙님💛</span
                        >으로 승급해 글쓰기·댓글·공감이 모두 열려요 — 오늘부터 도장 꾹, 첫걸음은
                        인사가 딱이에요! (참, 닉네임 옆 숫자 배지는 활동 레벨이라 등급과는 달라요
                        🙂)
                    </p>
                </div>
                <div class="flex shrink-0 flex-wrap items-center gap-2">
                    <a
                        href="/hello"
                        class="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-amber-600 hover:shadow-md"
                    >
                        💌 가입인사 남기기
                    </a>
                    <!-- 운영 안내글: 환영 안내(20754) — 새내기 필독 -->
                    <a
                        href="/hello/20754"
                        class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-full border border-amber-200 px-3 py-2 text-xs font-semibold transition-colors hover:border-amber-400 dark:border-amber-800/50"
                    >
                        📖 새내기 안내
                    </a>
                </div>
            </div>
        </div>
    </div>
{/if}
