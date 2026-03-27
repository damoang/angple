<script lang="ts">
    import { onMount } from 'svelte';
    import { Button } from '$lib/components/ui/button/index.js';
    import { launchCelebrationConfetti } from '$lib/utils/confetti.js';

    const SEEN_KEY = 'damoang_2nd_anniversary_home_seen_2026';
    const RELEASE_AT_KST = '2026-03-28T00:00:00+09:00';

    let open = $state(false);

    onMount(() => {
        if (localStorage.getItem(SEEN_KEY) === '1') return;
        if (!isReleased()) return;

        open = true;
        localStorage.setItem(SEEN_KEY, '1');
        launchCelebrationConfetti();
    });

    function isReleased(): boolean {
        if (window.location.hostname === 'dev.damoang.net') return true;
        return Date.now() >= new Date(RELEASE_AT_KST).getTime();
    }

    function close() {
        open = false;
    }
</script>

{#if open}
    <div
        class="backdrop"
        role="presentation"
        onclick={close}
        onkeydown={(e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                close();
            }
        }}
    >
        <div
            class="popup"
            role="dialog"
            tabindex="-1"
            aria-modal="true"
            aria-labelledby="anniversary-popup-title"
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
        >
            <div class="popup__header">
                <h2 id="anniversary-popup-title">다모앙 2주년입니다 🎉</h2>
                <p>
                    작은 목소리들이 모여 큰 울림이 되었고, 그 울림이 지금의 다모앙을 만들었습니다.
                </p>
            </div>

            <div class="popup__body">
                <img
                    src="https://damoang.net/emoticons/DINKIssTyle-ang-025.webp"
                    alt="다모앙 2주년을 기념하는 앙 캐릭터 이미지"
                    class="popup__image"
                />

                <div class="popup__copy">
                    <p>다모앙은 함께 참여하고 함께 키워 온 커뮤니티입니다.</p>
                    <p>
                        어느덧 2주년을 맞이하게 되었네요. 함께해 주신 모든 분들께 진심으로
                        감사드립니다.
                    </p>
                </div>
            </div>

            <div class="popup__footer">
                <Button href="/2nd-anniversary" variant="outline">자세히 보기</Button>
                <Button onclick={close}>확인</Button>
            </div>
        </div>
    </div>
{/if}

<style>
    .backdrop {
        position: fixed;
        inset: 0;
        z-index: 70;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: color-mix(in srgb, var(--foreground) 24%, transparent);
    }

    .popup {
        width: min(100%, 36rem);
        border-radius: 1.25rem;
        border: 2px solid color-mix(in srgb, var(--primary) 40%, var(--border));
        background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--primary) 4%, var(--background)),
            color-mix(in srgb, var(--background) 86%, var(--color-dusty-100))
        );
        padding: 2rem;
        box-shadow:
            0 24px 56px color-mix(in srgb, var(--foreground) 12%, transparent),
            0 0 0 1px color-mix(in srgb, var(--primary) 8%, transparent);
        animation: popup-enter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes popup-enter {
        from {
            opacity: 0;
            transform: scale(0.9) translateY(20px);
        }
        to {
            opacity: 1;
            transform: scale(1) translateY(0);
        }
    }

    .popup__header {
        text-align: center;
    }

    .popup__header h2 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 800;
        letter-spacing: -0.02em;
        background: linear-gradient(135deg, #0f766e, #14b8a6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    .popup__header p {
        margin: 0.75rem 0 0;
        line-height: 1.75;
        color: var(--muted-foreground);
    }

    .popup__body {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        padding: 1rem 0 0.5rem;
    }

    .popup__image {
        width: min(100%, 240px);
        height: auto;
        object-fit: contain;
        filter: drop-shadow(0 16px 32px color-mix(in srgb, var(--foreground) 18%, transparent));
        animation: image-float 3s ease-in-out infinite;
    }

    @keyframes image-float {
        0%,
        100% {
            transform: translateY(0);
        }
        50% {
            transform: translateY(-8px);
        }
    }

    .popup__copy {
        text-align: center;
        color: color-mix(in srgb, var(--foreground) 84%, var(--muted-foreground));
        line-height: 1.8;
    }

    .popup__copy p {
        margin: 0;
    }

    .popup__copy p + p {
        margin-top: 0.75rem;
    }

    .popup__footer {
        display: flex;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 0.75rem;
    }
</style>
