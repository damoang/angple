<script lang="ts">
    import { Button } from '$lib/components/ui/button/index.js';
    import MessageCircleHeart from '@lucide/svelte/icons/message-circle-heart';
    import ShieldAlert from '@lucide/svelte/icons/shield-alert';
    import Sparkles from '@lucide/svelte/icons/sparkles';

    import TrendingUp from '@lucide/svelte/icons/trending-up';
</script>

<svelte:head>
    <title>환영합니다 | {import.meta.env.VITE_SITE_NAME || '다모앙'}</title>
</svelte:head>

<div class="welcome-page">
    <section class="hero">
        <div class="hero-badge">
            <Sparkles class="h-4 w-4" />
            <span>Welcome</span>
        </div>
        <h1>다모앙에 오신 것을<br />환영합니다</h1>
        <p class="hero-sub">
            다모앙은 함께 만들어 가는 커뮤니티입니다.<br />
            쾌적한 소통 환경을 위해 아래 규칙을 꼭 지켜 주세요.
        </p>
    </section>

    <section class="rules">
        <div class="rule-card">
            <div class="rule-icon polite">
                <MessageCircleHeart class="h-7 w-7" />
            </div>
            <h3>경어체(존댓말) 필수</h3>
            <p>
                모든 게시글과 댓글에서 경어체를 사용해 주세요. 서로를 존중하는 소통의 첫걸음입니다.
            </p>
        </div>

        <div class="rule-card">
            <div class="rule-icon warn">
                <ShieldAlert class="h-7 w-7" />
            </div>
            <h3>비속어 사용 금지</h3>
            <p>초성 비속어를 포함한 모든 형태의 욕설·비하 표현은 이용제한 대상입니다.</p>
        </div>

        <div class="rule-card">
            <div class="rule-icon clean">
                <Sparkles class="h-7 w-7" />
            </div>
            <h3>청정 커뮤니티</h3>
            <p>건전하고 청정한 커뮤니티를 함께 만들어 갑시다. 여러분의 참여가 다모앙을 만듭니다.</p>
        </div>
    </section>

    <section class="level-guide">
        <div class="level-header">
            <TrendingUp class="h-5 w-5" />
            <h2>첫 걸음 안내</h2>
        </div>
        <div class="level-steps">
            <div class="level-step">
                <div class="level-badge current">앙님❤️</div>
                <div class="level-info">
                    <p class="level-title">가입 직후</p>
                    <p class="level-desc">게시글 읽기가 가능합니다.</p>
                </div>
            </div>
            <div class="level-arrow">→</div>
            <div class="level-step">
                <div class="level-badge next">앙님💛</div>
                <div class="level-info">
                    <p class="level-title">7일 로그인 + 실명인증</p>
                    <p class="level-desc">글쓰기와 댓글 작성이 가능합니다.</p>
                </div>
            </div>
        </div>
    </section>

    <section class="video-section">
        <h2>다모앙 가이드 영상</h2>
        <div class="video-container">
            <iframe
                src="https://www.youtube-nocookie.com/embed/d9FESnvUX_I"
                title="다모앙 가이드 영상"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowfullscreen
            ></iframe>
        </div>
    </section>

    <section class="cta">
        <Button href="/" size="lg" class="cta-button">시작하기</Button>
    </section>
</div>

<style>
    .welcome-page {
        margin: 0 auto;
        max-width: 720px;
        padding: 2.5rem 1rem 4rem;
    }

    .hero {
        text-align: center;
        margin-bottom: 2.5rem;
    }

    .hero-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        margin-bottom: 1.25rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--primary) 92%, black);
        padding: 0.4rem 0.85rem;
        color: var(--primary-foreground);
        font-size: 0.82rem;
        font-weight: 700;
        letter-spacing: 0.03em;
    }

    h1 {
        margin: 0;
        color: var(--foreground);
        font-size: clamp(1.8rem, 5vw, 2.6rem);
        font-weight: 800;
        line-height: 1.25;
        letter-spacing: -0.03em;
    }

    .hero-sub {
        margin: 1rem 0 0;
        color: var(--muted-foreground);
        font-size: 1.05rem;
        line-height: 1.8;
    }

    .rules {
        display: grid;
        gap: 1rem;
        margin-bottom: 2.5rem;
    }

    .rule-card {
        border: 1px solid color-mix(in srgb, var(--border) 80%, var(--color-dusty-300));
        background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--background) 96%, var(--canvas)),
            color-mix(in srgb, var(--background) 90%, var(--color-dusty-100))
        );
        border-radius: 1.25rem;
        padding: 1.5rem;
        box-shadow: 0 4px 16px color-mix(in srgb, var(--foreground) 4%, transparent);
    }

    .rule-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 3rem;
        height: 3rem;
        border-radius: 0.85rem;
        margin-bottom: 0.75rem;
    }

    .rule-icon.polite {
        background: color-mix(in srgb, var(--primary) 12%, var(--background));
        color: var(--primary);
    }

    .rule-icon.warn {
        background: color-mix(in srgb, #ef4444 12%, var(--background));
        color: #ef4444;
    }

    .rule-icon.clean {
        background: color-mix(in srgb, #f59e0b 12%, var(--background));
        color: #f59e0b;
    }

    .rule-card h3 {
        margin: 0 0 0.4rem;
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--foreground);
    }

    .rule-card p {
        margin: 0;
        color: color-mix(in srgb, var(--foreground) 76%, var(--muted-foreground));
        font-size: 0.95rem;
        line-height: 1.7;
    }

    .level-guide {
        margin-bottom: 2.5rem;
        border: 1px solid color-mix(in srgb, var(--border) 80%, var(--color-dusty-300));
        background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--background) 96%, var(--canvas)),
            color-mix(in srgb, var(--background) 90%, var(--color-dusty-100))
        );
        border-radius: 1.25rem;
        padding: 1.5rem;
        box-shadow: 0 4px 16px color-mix(in srgb, var(--foreground) 4%, transparent);
    }

    .level-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1.25rem;
        color: var(--foreground);
    }

    .level-header h2 {
        margin: 0;
        font-size: 1.1rem;
        font-weight: 700;
    }

    .level-steps {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
        justify-content: center;
    }

    .level-step {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex: 1;
        min-width: 200px;
        padding: 1rem;
        border-radius: 0.85rem;
        background: color-mix(in srgb, var(--background) 80%, var(--muted));
    }

    .level-badge {
        flex-shrink: 0;
        padding: 0.35rem 0.75rem;
        border-radius: 999px;
        font-size: 0.9rem;
        font-weight: 700;
        white-space: nowrap;
    }

    .level-badge.current {
        background: color-mix(in srgb, #ef4444 12%, var(--background));
        color: #ef4444;
    }

    .level-badge.next {
        background: color-mix(in srgb, #f59e0b 12%, var(--background));
        color: #f59e0b;
    }

    .level-title {
        margin: 0;
        font-size: 0.88rem;
        font-weight: 700;
        color: var(--foreground);
    }

    .level-desc {
        margin: 0.15rem 0 0;
        font-size: 0.82rem;
        color: var(--muted-foreground);
        line-height: 1.5;
    }

    .level-arrow {
        color: var(--muted-foreground);
        font-size: 1.2rem;
        font-weight: 700;
    }

    .video-section {
        margin-bottom: 2.5rem;
    }

    .video-section h2 {
        margin: 0 0 1rem;
        font-size: 1.15rem;
        font-weight: 700;
        color: var(--foreground);
    }

    .video-container {
        position: relative;
        width: 100%;
        padding-bottom: 56.25%;
        border-radius: 1rem;
        overflow: hidden;
        background: var(--muted);
        box-shadow: 0 8px 24px color-mix(in srgb, var(--foreground) 8%, transparent);
    }

    .video-container iframe {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        border: 0;
    }

    .cta {
        display: flex;
        justify-content: center;
    }

    :global(.cta-button) {
        min-width: 200px;
        height: 3.2rem;
        font-size: 1.08rem;
        font-weight: 700;
        border-radius: 0.85rem;
    }

    @media (min-width: 640px) {
        .welcome-page {
            padding: 3.5rem 1.5rem 5rem;
        }

        .rules {
            grid-template-columns: repeat(3, 1fr);
        }
    }
</style>
