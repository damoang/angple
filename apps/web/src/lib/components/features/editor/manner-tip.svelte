<script lang="ts">
    /**
     * 작성 매너 안내 풍선.
     *
     * placeholder 가 사라지는 순간 — 즉 회원이 첫 글자를 입력한 순간 — 에디터 위에
     * 잠깐 떠올랐다 사라진다.
     *
     * 왜 이 타이밍인가:
     *   - placeholder 는 항상 거기 있어서 배경이 된다. 읽히지 않는다.
     *   - 에디터 클릭 진입 시 띄우면 쓰려는 사람을 막는다. 모바일은 키보드가
     *     올라오는 순간과 겹쳐 더 나쁘다.
     *   - 첫 글자를 친 순간은 "쓰기 시작했다"는 확실한 신호이면서, 아직 문장을
     *     짓기 전이라 방해가 가장 적다.
     *
     * ⛔ 규제가 아니라 안내다. 막지 않고, 검사하지 않고, 되돌리지 않는다.
     *    비속어 판단은 회원 스스로 한다(2026-07-28 방침).
     *
     * 표시 규칙:
     *   - 하루 1회. 매번 뜨면 사흘이면 아무도 안 본다.
     *   - 두 문구를 함께, 앙모지와 같이 보여준다.
     *   - 6초 후 자동 소멸. 나타남 0.3초 / 사라짐 0.6초로 놀라지 않게.
     *     (처음엔 3초·한 문구씩이었는데 "너무 빨리 사라진다"는 확인으로 늘렸다.
     *      읽을 것이 두 줄로 늘었으니 그만큼 더 필요하다.)
     */
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';

    const STORAGE_KEY = 'angple_manner_tip';
    const SHOW_MS = 6000;

    const TIPS = ['경어체 사용해 주세앙 🙏', '초성 포함 비속어 안돼앙 🙅'] as const;
    /** 앙모지 — 안내가 잔소리로 읽히지 않게 하는 장치 */
    const EMOJI_SRC = '/emoticons/DINKIssTyle-3d-ang-033.webp';

    /**
     * placement
     *   'inside' — 입력 영역 안쪽 상단. 글쓰기처럼 높이가 넉넉한 곳에 쓴다.
     *   'above'  — 입력 영역 바깥 위. 댓글처럼 입력창이 낮아 안쪽에 띄우면
     *              방금 친 글자를 가리는 곳에 쓴다.
     */
    let { show = false, placement = 'inside' }: { show?: boolean; placement?: 'inside' | 'above' } =
        $props();

    let visible = $state(false);
    let timer: ReturnType<typeof setTimeout> | undefined;

    /** 마지막으로 보여준 날짜(KST). 값이 없거나 깨졌으면 "처음 보는 것"으로 취급한다. */
    function lastShownDate(): string {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return '';
            // 과거에는 {date, next} 객체였다. 두 문구를 함께 띄우면서 next 가 필요 없어졌지만
            // 이미 저장된 값이 있는 사용자를 위해 두 형태를 모두 읽는다.
            if (raw.startsWith('{')) {
                const p = JSON.parse(raw);
                return typeof p?.date === 'string' ? p.date : '';
            }
            return raw;
        } catch {
            return '';
        }
    }

    function todayKST(): string {
        // 한국 기준 날짜. UTC 로 계산하면 오전 9시에 날짜가 바뀐다.
        return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
    }

    function maybeShow() {
        if (!browser || visible) return;

        const today = todayKST();
        if (lastShownDate() === today) return; // 오늘 이미 봤다

        visible = true;

        try {
            localStorage.setItem(STORAGE_KEY, today);
        } catch {
            // 저장 실패해도 이번 한 번은 보여준다. 다음에 또 뜰 뿐 해가 없다.
        }

        clearTimeout(timer);
        timer = setTimeout(() => (visible = false), SHOW_MS);
    }

    // show 가 false → true 로 바뀌는 순간에만 발화한다.
    let prevShow = false;
    $effect(() => {
        if (show && !prevShow) maybeShow();
        prevShow = show;
    });

    onMount(() => () => clearTimeout(timer));
</script>

{#if visible}
    <!--
        aria-live=polite: 스크린리더에게 현재 작업(입력)을 끊지 말고 알리게 한다.
        pointer-events-none: 풍선이 클릭을 가로채지 않는다. 글쓰기를 절대 방해하지 않는다.
    -->
    <div
        class="manner-tip pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 {placement ===
        'above'
            ? '-top-20'
            : 'top-2'}"
        role="status"
        aria-live="polite"
    >
        <div
            class="bg-primary text-primary-foreground flex items-center gap-2.5 rounded-2xl py-2 pl-2.5 pr-4 shadow-lg"
        >
            <!-- width/height 를 명시해 이미지 로드 전후로 풍선 크기가 흔들리지 않게 한다 -->
            <img
                src={EMOJI_SRC}
                alt=""
                width="44"
                height="44"
                class="h-11 w-11 shrink-0 object-contain"
                aria-hidden="true"
            />
            <div class="flex flex-col gap-0.5 whitespace-nowrap text-sm font-medium leading-snug">
                {#each TIPS as tip (tip)}
                    <span>{tip}</span>
                {/each}
            </div>
        </div>
        <div class="manner-tip-tail" aria-hidden="true"></div>
    </div>
{/if}

<style>
    .manner-tip {
        animation:
            manner-tip-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
            manner-tip-out 0.6s ease-in forwards;
        /* SHOW_MS(6s) 에 맞춰 5.4s 부터 사라지기 시작해 6s 에 완전히 사라진다.
           이 값을 바꾸면 스크립트의 SHOW_MS 도 함께 바꿔야 한다. */
        animation-delay: 0s, 5.4s;
    }

    /* 말풍선 꼬리 */
    .manner-tip-tail {
        width: 0;
        height: 0;
        margin: -1px auto 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 7px solid var(--color-primary, #f59e0b);
    }

    @keyframes manner-tip-in {
        from {
            opacity: 0;
            transform: translate(-50%, 8px) scale(0.92);
        }
        to {
            opacity: 1;
            transform: translate(-50%, 0) scale(1);
        }
    }

    @keyframes manner-tip-out {
        to {
            opacity: 0;
            transform: translate(-50%, -6px);
        }
    }

    /* 움직임을 줄이도록 설정한 사용자에게는 애니메이션 없이 보여준다 */
    @media (prefers-reduced-motion: reduce) {
        .manner-tip {
            animation: none;
        }
    }
</style>
