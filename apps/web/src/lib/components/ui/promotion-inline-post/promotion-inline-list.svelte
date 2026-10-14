<script lang="ts">
    import PromotionInlinePost from './promotion-inline-post.svelte';

    interface Props {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API 응답 모양에 맞춘 타입이 아직 없다
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
