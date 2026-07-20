<script lang="ts">
    /**
     * 휴면 회원 웰컴백 카드 (성장 엔진 — 재활성 레버 R1)
     *
     * 설계: docs/dormant-reactivation-design-20260720.html
     *
     * 근거가 된 실측(2026-07-20):
     *  - 자연 복귀율은 휴면이 길수록 급락한다(8-12주 27.3% → 13-25주 16.4% → 26-51주 7.4% → 52주+ 1.7%).
     *    대상을 8~25주로 한정하는 이유. 그 밖은 개입해도 회수되지 않고 스팸만 남는다.
     *  - 복귀자의 첫 활동은 글이 아니라 댓글이다(인원 기준 약 4:1). CTA 는 글쓰기가 아니라
     *    "대화가 있는 곳" 을 향한다. 신규 온보딩(실험 A)이 /hello 글쓰기를 향하는 것과 정반대.
     *  - 이메일 수신동의가 1.4% 뿐이라 외부 발송은 불가능하다. 그래서 이 레버는
     *    "이미 읽으러 들어와 있는 사람" 을 그 자리에서 되돌리는 온사이트 설계다.
     *
     * 노출 조건 (전부 만족):
     *  1) 로그인
     *  2) 기존 기여 이력 있음 (post+comment > 0 — 0 이면 신규이므로 실험 A 소관, 상호 배타)
     *  3) 마지막 기여로부터 8주 이상 25주 이하
     *  4) 닫기 안 누름 (회원별 키)
     *  5) 홀드아웃(10%) 이 아님 — 대조군은 카드를 보지 않지만 자격 이벤트는 남겨 증분을 측정한다
     *
     * ⚠️ 판정은 `/api/members/{id}/activity`(SvelteKit 프록시 → Go GetMemberActivity) **단일 호출**로 한다.
     *    apiClient.getMyActivity() 와 getMemberProfile() 은 둘 다 백엔드 라우트가 없는 죽은 메서드다
     *    (`/api/v1/members/{id}` 는 존재하지 않는 경로와 동일하게 `{"data":null}` 을 돌려준다 — 실측 확인).
     *    죽은 API 를 게이트에 두면 예외가 catch 로 삼켜져 기능이 조용히 0% 로 죽는다.
     *    기여 이력 판정도 이 응답으로 대신한다: 목록이 비어 있으면 신규 미기여(실험 A 소관) 이거나
     *    판정 불가이므로 어느 쪽이든 미노출이 정답이다.
     */
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { trackEvent } from '$lib/services/ga4';
    import {
        cacheKey,
        dismissKey,
        isDormantWindow,
        isHoldout,
        lastContributionAt,
        type MemberActivityResponse
    } from './welcome-back-logic';

    const POSITIVE_TTL_MS = 86400000; // 자격 판정 1일 — 복귀해 글을 쓰면 하루 안에 사라진다
    const NEGATIVE_TTL_MS = 3600000; // 미자격/실패 1시간 — 장애 시 재시도 폭주 방지
    const DAY_MS = 86400000;
    const ACTIVITY_LIMIT = 5;

    let show = $state(false);
    let checked = $state(false);
    let dormantWeeks = $state(0);

    function readCache(mbId: string): { eligible: boolean; weeks: number } | null {
        try {
            const raw = localStorage.getItem(cacheKey(mbId));
            if (!raw) return null;
            const p = JSON.parse(raw);
            if (typeof p?.ts !== 'number' || typeof p?.eligible !== 'boolean') return null;
            const ttl = p.eligible ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
            if (Date.now() - p.ts > ttl) return null;
            return { eligible: p.eligible, weeks: Number(p.weeks) || 0 };
        } catch {
            return null;
        }
    }

    function writeCache(mbId: string, eligible: boolean, weeks: number): void {
        try {
            localStorage.setItem(
                cacheKey(mbId),
                JSON.stringify({ ts: Date.now(), eligible, weeks })
            );
        } catch {
            /* localStorage 불가 환경 — 캐시 없이 동작 */
        }
    }

    function reveal(weeks: number, mbId: string): void {
        dormantWeeks = weeks;
        const holdout = isHoldout(mbId);
        // 대조군도 "노출 자격을 얻은 시점" 을 남겨야 증분(개입 - 자연복귀)을 계산할 수 있다.
        trackEvent(holdout ? 'welcomeback_holdout' : 'welcomeback_impression', {
            dormant_weeks: weeks
        });
        if (!holdout) show = true;
    }

    $effect(() => {
        const user = authStore.user;
        if (checked || !user) return;
        checked = true;

        const mbId = user.mb_id;
        try {
            if (localStorage.getItem(dismissKey(mbId))) return;
        } catch {
            return;
        }

        const cached = readCache(mbId);
        if (cached) {
            if (cached.eligible) reveal(cached.weeks, mbId);
            return;
        }

        void (async () => {
            try {
                const res = await fetch(
                    `/api/members/${encodeURIComponent(mbId)}/activity?limit=${ACTIVITY_LIMIT}`
                );
                if (!res.ok) {
                    writeCache(mbId, false, 0);
                    return;
                }
                const activity = (await res.json()) as MemberActivityResponse;

                const last = lastContributionAt(activity);
                if (last === null) {
                    // 신규 미기여(실험 A 소관) 이거나, 검색 제외 게시판(158개 중 38개)에만 기여해
                    // 판정이 불가능한 경우. 어느 쪽이든 미노출이 안전하다(미탐 우선).
                    writeCache(mbId, false, 0);
                    return;
                }

                const days = (Date.now() - last) / DAY_MS;
                const eligible = isDormantWindow(days);
                const weeks = Math.floor(days / 7);
                writeCache(mbId, eligible, weeks);
                if (eligible) reveal(weeks, mbId);
            } catch {
                // 조회 실패 시 조용히 미노출 + 짧은 네거티브 캐시(재시도 폭주 방지)
                writeCache(mbId, false, 0);
            }
        })();
    });

    function dismiss(): void {
        show = false;
        try {
            localStorage.setItem(dismissKey(authStore.user?.mb_id ?? ''), String(Date.now()));
        } catch {
            /* 세션 내 숨김만 */
        }
    }

    function onCta(target: string): void {
        trackEvent('welcomeback_cta_click', { target, dormant_weeks: dormantWeeks });
    }
</script>

{#if show}
    <div class="mx-auto mb-4 max-w-5xl px-4 pt-4">
        <div
            class="relative overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-cyan-50 to-blue-50 px-5 py-4 shadow-sm dark:border-sky-800/40 dark:from-sky-950/40 dark:via-cyan-950/30 dark:to-blue-950/30"
        >
            <button
                type="button"
                onclick={dismiss}
                class="text-muted-foreground hover:text-foreground absolute right-3 top-3 rounded-full p-1 text-lg leading-none transition-colors"
                aria-label="환영 안내 닫기"
            >
                ✕
            </button>

            <p class="mb-1 text-base font-semibold">
                <span aria-hidden="true">👋</span> 오랜만이에요, {authStore.user?.mb_name}님
            </p>
            <p class="text-muted-foreground mb-3 text-sm leading-relaxed">
                그동안 다모앙에도 많은 이야기가 오갔어요. 편하게 둘러보시고, 마음이 가는 글에 한마디
                남겨주시면 반가울 거예요.
            </p>

            <div class="flex flex-wrap gap-2">
                <a
                    href="/notifications"
                    onclick={() => onCta('notifications')}
                    class="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-sky-700"
                >
                    <span aria-hidden="true">🔔</span> 그동안 온 소식 보기
                </a>
                <!-- 목적지는 최신글 firehose(/new) 가 아니라 공감이 모인 글(/empathy) —
                     설계 §5: 갈등 재점화가 이 레버의 최대 위험이라, 과열된 최신글로 곧장 보내지 않는다. -->
                <a
                    href="/empathy"
                    onclick={() => onCta('empathy')}
                    class="border-border hover:bg-muted rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors"
                >
                    <span aria-hidden="true">💬</span> 요즘 이야기 나눈 글
                </a>
            </div>
        </div>
    </div>
{/if}
