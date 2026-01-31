<script lang="ts">
    import {
        buildTitle,
        buildRobots,
        buildOgTags,
        buildTwitterTags,
        buildJsonLd,
        type SeoConfig
    } from './meta-helper';

    const { config }: { config: SeoConfig } = $props();

    const fullTitle = $derived(buildTitle(config.meta.title));
    const robots = $derived(buildRobots(config.meta));
    const ogTags = $derived(buildOgTags(config.meta, config.og));
    const twitterTags = $derived(buildTwitterTags(config.meta, config.twitter));
    const jsonLdScript = $derived(config.jsonLd ? buildJsonLd(config.jsonLd) : null);
</script>

<svelte:head>
    <title>{fullTitle}</title>

    {#if config.meta.description}
        <meta name="description" content={config.meta.description} />
    {/if}

    {#if config.meta.keywords?.length}
        <meta name="keywords" content={config.meta.keywords.join(', ')} />
    {/if}

    {#if config.meta.canonicalUrl}
        <link rel="canonical" href={config.meta.canonicalUrl} />
    {/if}

    {#if robots}
        <meta name="robots" content={robots} />
    {/if}

    <!-- Open Graph -->
    {#each Object.entries(ogTags) as [property, content]}
        <meta {property} {content} />
    {/each}

    <!-- Twitter Card -->
    {#each Object.entries(twitterTags) as [name, content]}
        <meta {name} {content} />
    {/each}

    <!-- JSON-LD 구조화 데이터 -->
    {#if jsonLdScript}
        {@html `<script type="application/ld+json">${jsonLdScript}</script>`}
    {/if}
</svelte:head>
