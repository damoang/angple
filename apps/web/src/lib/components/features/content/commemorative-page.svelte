<script lang="ts">
    import { Card, CardContent } from '$lib/components/ui/card/index.js';
    import Sparkles from '@lucide/svelte/icons/sparkles';
    import type { CommemorativePageContent } from '$lib/types/commemorative-page.js';

    interface Props {
        content: CommemorativePageContent;
    }

    let { content }: Props = $props();
</script>

<div class="anniversary-page">
    <section class="hero-card">
        <div class="eyebrow">
            <Sparkles class="h-4 w-4" />
            <span>{content.eyebrow}</span>
        </div>

        <div class="hero-grid">
            <div class="hero-copy">
                <h1>{content.title}</h1>

                <div class="message-stack">
                    {#each content.heroParagraphs as paragraph}
                        <p>{paragraph}</p>
                    {/each}
                </div>
            </div>

            <div class="hero-image-wrap">
                <img src={content.heroImage.url} alt={content.heroImage.alt} class="hero-image" />
            </div>
        </div>
    </section>

    {#if content.noticeParagraphs?.length}
        <div class="notice-card">
            <Card>
                <CardContent>
                    <div class="notice-content">
                        {#each content.noticeParagraphs as paragraph}
                            <p>{paragraph}</p>
                        {/each}
                    </div>
                </CardContent>
            </Card>
        </div>
    {/if}

    {#if content.closingParagraphs?.length}
        <section class="closing-card" class:closing-card--text-only={!content.closingImage}>
            <div class="closing-copy">
                {#each content.closingParagraphs as paragraph}
                    <p>{paragraph}</p>
                {/each}
                {#if content.closingSignoff}
                    <p class="closing-signoff">{content.closingSignoff}</p>
                {/if}
            </div>

            {#if content.closingImage}
                <div class="closing-image-wrap">
                    <img
                        src={content.closingImage.url}
                        alt={content.closingImage.alt}
                        class="closing-image"
                    />
                </div>
            {/if}
        </section>
    {/if}
</div>

<style>
    .anniversary-page {
        margin: 0 auto;
        max-width: 880px;
        padding: 2rem 1rem 4rem;
    }

    .hero-card,
    .closing-card {
        border: 1px solid color-mix(in srgb, var(--border) 82%, var(--color-dusty-300));
        background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--background) 94%, var(--canvas)),
            color-mix(in srgb, var(--background) 88%, var(--color-dusty-100))
        );
        border-radius: 1.5rem;
        box-shadow: 0 18px 42px color-mix(in srgb, var(--foreground) 8%, transparent);
    }

    .hero-card {
        padding: 1.5rem;
    }

    .eyebrow {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 1rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--primary) 92%, black);
        padding: 0.45rem 0.9rem;
        color: var(--primary-foreground);
        font-size: 0.85rem;
        font-weight: 700;
        letter-spacing: 0.03em;
    }

    .hero-grid,
    .closing-card {
        display: grid;
        gap: 1.25rem;
        align-items: center;
    }

    h1 {
        margin: 0;
        color: var(--foreground);
        font-size: clamp(2rem, 4.8vw, 3.1rem);
        line-height: 1.18;
        letter-spacing: -0.03em;
    }

    .message-stack,
    .notice-content,
    .closing-copy {
        color: color-mix(in srgb, var(--foreground) 84%, var(--muted-foreground));
        font-size: 1.03rem;
        line-height: 1.9;
    }

    .message-stack {
        margin-top: 1rem;
    }

    .message-stack p,
    .notice-content p,
    .closing-copy p {
        margin: 0;
    }

    .message-stack p + p,
    .notice-content p + p,
    .closing-copy p + p {
        margin-top: 1rem;
    }

    .hero-image-wrap,
    .closing-image-wrap {
        display: flex;
        justify-content: center;
    }

    .hero-image {
        width: min(100%, 320px);
        height: auto;
        object-fit: contain;
        filter: drop-shadow(0 16px 28px rgba(15, 23, 42, 0.12));
    }

    .closing-image {
        width: min(100%, 280px);
        height: auto;
        object-fit: contain;
        filter: drop-shadow(0 16px 28px rgba(15, 23, 42, 0.12));
    }

    .notice-card {
        margin-top: 1rem;
        border-radius: 1.25rem;
        border: 1px solid color-mix(in srgb, var(--border) 82%, var(--primary));
        background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--background) 94%, var(--canvas)),
            color-mix(in srgb, var(--background) 86%, var(--color-dusty-100))
        );
        box-shadow: 0 14px 36px color-mix(in srgb, var(--foreground) 8%, transparent);
    }

    .notice-content {
        padding: 0.25rem 0;
    }

    .closing-card {
        margin-top: 1rem;
        padding: 1.5rem;
    }

    .closing-card--text-only {
        display: block;
    }

    .closing-signoff {
        color: var(--foreground);
        font-weight: 700;
    }

    @media (min-width: 768px) {
        .anniversary-page {
            padding: 3rem 1.5rem 5rem;
        }

        .hero-card,
        .closing-card {
            padding: 2rem;
        }

        .hero-grid,
        .closing-card {
            grid-template-columns: minmax(0, 1.4fr) minmax(220px, 0.75fr);
        }
    }
</style>
