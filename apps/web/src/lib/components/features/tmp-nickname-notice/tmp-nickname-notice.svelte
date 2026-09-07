<script lang="ts">
    /**
     * 임시 닉네임(`tmp_…`) 회원에게 닉네임을 정하도록 알리는 우측 하단 토스트.
     *
     * ⛔ 왜 토스트인가 — `SSR_STRIP_USER` 환경이라 서버 렌더링 시점에 `data.user` 가 없다
     *    (`routes/+layout.server.ts`). 그래서 이 안내는 **하이드레이션 뒤**에만 뜬다.
     *    본문 흐름 안에 넣으면 그때 본문을 밀어 그대로 CLS 가 된다. 자리를 미리 비워두면
     *    임시 닉네임이 아닌 대다수 회원에게 빈 칸이 생긴다.
     *    ⭐ `fixed` 로 띄우면 레이아웃에 영향이 없다 — 그래서 높이 변동이 0px 다.
     *
     * ⛔ 문구에 「임시」·「tmp」·「미완료」를 쓰지 않는다. 회원 잘못이 아니라 우리 가입 흐름이
     *    닉네임을 정하는 단계를 안 만든 것이다.
     *
     * ⛔ 닉네임을 추천하거나 미리 채워주지 않는다 — 소셜 프로필 이름이 실명인 프로바이더가 있다.
     */
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { tmpNicknameNotice, isTempNickname } from '$lib/stores/tmp-nickname-notice.svelte.js';
    import { Button } from '$lib/components/ui/button';
    import X from '@lucide/svelte/icons/x';

    /**
     * ⛔ 이름이 헷갈리는 자리다. **클라이언트의 `mb_name` 은 닉네임이다.**
     *    `auth.svelte.ts:81` 이 `mb_name: ssrUser.nickname` 으로 채우고,
     *    헤더도 `header.svelte:87` 에서 같은 값을 화면에 쓴다.
     *    DB 의 `g5_member.mb_name`(실명)과는 다른 값이다 —
     *    실명은 2026-08-08 개인정보 점검 때 응답에서 빠졌다(`api/types.ts:726` 주석).
     *    `DamoangUser` 에는 `mb_nick` 필드가 아예 없다. 쓰면 항상 undefined 다.
     */
    const currentNick = $derived(authStore.user?.mb_name);

    // ⛔ 로딩 중에는 띄우지 않는다. 인증이 확립되기 전에 판정하면 깜빡인다.
    const show = $derived(
        !authStore.isLoading && isTempNickname(currentNick) && tmpNicknameNotice.notDismissed
    );

    function handleDismiss() {
        tmpNicknameNotice.dismiss();
    }
</script>

{#if show}
    <div
        class="tmp-nickname-notice fixed bottom-4 right-4 z-[100] max-w-sm rounded-xl border border-blue-200 bg-white p-4 shadow-2xl ring-1 ring-black/5 sm:bottom-6 sm:right-6 dark:border-blue-900/40 dark:bg-zinc-900 dark:ring-white/10"
        role="status"
        aria-live="polite"
        aria-label="닉네임 설정 안내"
    >
        <button
            type="button"
            class="text-muted-foreground hover:text-foreground absolute right-2 top-2 rounded p-1 transition"
            aria-label="닫기 (7일간 안내 끄기)"
            onclick={handleDismiss}
        >
            <X class="h-4 w-4" />
        </button>
        <div class="flex items-start gap-3 pr-6">
            <div class="text-2xl" aria-hidden="true">✏️</div>
            <div class="flex-1">
                <p class="text-sm font-semibold">닉네임을 정해 주세요</p>
                <p class="text-muted-foreground mt-1 text-xs leading-relaxed">
                    지금 닉네임이 <strong class="text-foreground break-all">{currentNick}</strong>
                    으로 되어 있어요. 다른 분들께 보이는 이름이라, 원하시는 이름으로 바꾸실 수 있습니다.
                </p>
                <div class="mt-3 flex flex-wrap items-center gap-2">
                    <Button size="sm" href="/member/settings" onclick={handleDismiss}>
                        닉네임 정하기
                    </Button>
                    <Button size="sm" variant="ghost" onclick={handleDismiss}>나중에</Button>
                </div>
            </div>
        </div>
    </div>
{/if}
