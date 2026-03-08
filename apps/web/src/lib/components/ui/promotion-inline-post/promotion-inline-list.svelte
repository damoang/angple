<script lang="ts">
    import PromotionInlinePost from './promotion-inline-post.svelte';

    interface Props {
        posts?: any[];
        variant?: 'default' | 'classic';
    }

    let { posts = [], variant = 'default' }: Props = $props();
</script>

{#if posts.length > 0}
    {#each posts.slice(0, 2) as promo (promo.wrId)}
        <PromotionInlinePost post={promo} {variant} />
    {/each}
{/if}
