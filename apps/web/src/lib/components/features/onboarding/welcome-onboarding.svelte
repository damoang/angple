<script lang="ts">
    /**
     * 신규 회원 웰컴 온보딩 카드 (성장 엔진 축B — 실험 A)
     *
     * 목표: 가입→첫 기여 전환율 개선 (12주 실측 14.2%).
     * 노출 조건 (전부 만족 시에만):
     *  1) 로그인 && as_level ≤ 1 (XP 거의 없음 = 활동 전 — 값싼 1차 게이트)
     *  2) 가입 14일 이내 && 기여 이력 0 (정확한 "신규 미기여" 판별)
     *  3) 닫기 안 누름 (localStorage, 회원별 스코프)
     * 첫 기여를 하면 last_contribution_at 이 채워져 자연히 사라진다.
     *
     * 첫 기여 유도는 가입인사(/hello) 게시판으로 — 자유게시판 등은 신규에게
     * 글쓰기가 제한될 수 있어, 항상 열려 있는 인사 게시판이 첫걸음으로 적합.
     *
     * ⚠️ 2026-07-20 수정: 기존 게이트가 `apiClient.getMemberProfile()` 을 썼는데 이 API 는
     *    백엔드에 라우트가 없다(`/api/v1/members/{id}` → 존재하지 않는 경로와 똑같이 `{"data":null}`).
     *    `null` 역참조 예외를 아래 catch 가 삼켜 **이 카드는 7/9 라이브 이후 한 번도 노출되지 않았다.**
     *    (그래서 "실험 A 효과" 로 본 코호트 변동은 처치가 아니라 자연 변동이다.)
     *    이제 동작이 검증된 `/api/me/onboarding-status` 단일 소스를 쓴다.
     */
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { trackEvent } from '$lib/services/ga4';

    const DISMISS_KEY_PREFIX = 'angple_welcome_onboarding_dismissed';
    const SETTLED_KEY_PREFIX = 'angple_welcome_onboarding_settled';
    const NEW_MEMBER_DAYS = 14;

    let show = $state(false);
    let checked = $state(false);

    /** 닫기 상태는 회원별로 — 공유 기기에서 다른 회원의 닫기를 상속하면 조용히 미노출된다. */
    function dismissKey(mbId: string): string {
        return `${DISMISS_KEY_PREFIX}:${mbId}`;
    }

    /**
     * "이 회원은 더 이상 신규가 아니다" 라는 확정 판정.
     * 가입일은 불변이라 14일이 지나면 다시 자격을 얻는 일이 없다 → 영구 기록해
     * 다음 방문부터 API 호출 자체를 하지 않는다. as_level 사전 게이트를 제거한 대신
     * 이 캐시가 홈 트래픽의 호출량을 억제한다.
     */
    function settledKey(mbId: string): string {
        return `${SETTLED_KEY_PREFIX}:${mbId}`;
    }

    $effect(() => {
        const user = authStore.user;
        if (checked || !user) return;
        // ⚠️ as_level ≤ 1 사전 게이트 제거(2026-07-20). 실측 결과 "가입 14일 이내 + 기여 0" 인
        //    회원 중 as_level ≥ 2 가 199명으로 통과자(159명)보다 많았다 — XP 는 기여 없이도
        //    출석 등으로 오르기 때문. 값싼 근사치였던 이 게이트가 진짜 타깃의 56% 를 잘라
        //    실험 검정력을 반토막 냈다. 이제 last_contribution_at 이라는 정확한 판별자가 있다.
        try {
            if (
                localStorage.getItem(dismissKey(user.mb_id)) ||
                localStorage.getItem(DISMISS_KEY_PREFIX) || // 구 전역 키 존중(이미 닫은 사람)
                localStorage.getItem(settledKey(user.mb_id))
            ) {
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
                const res = await fetch('/api/me/onboarding-status');
                if (!res.ok) return;
                const status = (await res.json()) as {
                    signup_at: string | null;
                    last_contribution_at: string | null;
                };
                const signedAt = new Date(status.signup_at ?? '').getTime();
                if (Number.isNaN(signedAt)) return;
                const daysSince = (Date.now() - signedAt) / 86400000;
                if (daysSince > NEW_MEMBER_DAYS) {
                    try {
                        localStorage.setItem(settledKey(user.mb_id), '1');
                    } catch {
                        /* localStorage 불가 — 캐시 없이 동작 */
                    }
                    return;
                }
                if (status.last_contribution_at === null) {
                    show = true;
                    // 노출 0 이 곧 신호가 되도록 계측한다 — 이번처럼 조용히 죽는 일을 막는다.
                    trackEvent('onboarding_impression', {
                        days_since_signup: Math.floor(daysSince)
                    });
                }
            } catch {
                // 조회 실패 시 조용히 미노출 (온보딩은 있으면 좋은 기능)
            }
        })();
    });

    function dismiss() {
        show = false;
        try {
            localStorage.setItem(dismissKey(authStore.user?.mb_id ?? ''), String(Date.now()));
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
                        onclick={() => trackEvent('onboarding_cta_click', { target: 'hello' })}
                        class="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-amber-600 hover:shadow-md"
                    >
                        💌 가입인사 남기기
                    </a>
                    <!-- 운영 안내글: 환영 안내(20754) — 새내기 필독 -->
                    <a
                        href="/hello/20754"
                        onclick={() => trackEvent('onboarding_cta_click', { target: 'guide' })}
                        class="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-full border border-amber-200 px-3 py-2 text-xs font-semibold transition-colors hover:border-amber-400 dark:border-amber-800/50"
                    >
                        📖 새내기 안내
                    </a>
                </div>
            </div>
        </div>
    </div>
{/if}
