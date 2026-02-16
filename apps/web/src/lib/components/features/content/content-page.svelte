<script lang="ts">
    import DOMPurify from 'isomorphic-dompurify';
    import { SeoHead } from '$lib/seo/index.js';
    import type { SeoConfig } from '$lib/seo/types.js';

    interface Props {
        title: string;
        content: string;
        seoConfig?: SeoConfig;
    }

    let { title, content, seoConfig }: Props = $props();

    const sanitizedContent = $derived(DOMPurify.sanitize(content));

    const defaultSeo: SeoConfig = $derived(
        seoConfig || {
            meta: {
                title,
                description: `${title} - ${import.meta.env.VITE_SITE_NAME || 'Angple'}`
            },
            og: {
                title,
                type: 'website'
            }
        }
    );
</script>

<SeoHead config={defaultSeo} />

<div class="mx-auto max-w-4xl px-4 py-8">
    <h1 class="text-foreground mb-6 text-3xl font-bold">{title}</h1>
    {#if sanitizedContent}
        <div class="prose dark:prose-invert max-w-none">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -->
            {@html sanitizedContent}
        </div>
    {:else}
        <div class="text-muted-foreground py-12 text-center">
            <p>등록된 내용이 없습니다.</p>
        </div>
    {/if}
</div>
