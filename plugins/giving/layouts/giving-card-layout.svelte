<script lang="ts">
    import type { FreePost, BoardDisplaySettings } from '$lib/api/types.js';
    import GivingCard from '../components/giving-card.svelte';

    let {
        post,
        displaySettings,
        onclick
    }: {
        post: FreePost;
        displaySettings?: BoardDisplaySettings;
        onclick: () => void;
    } = $props();
</script>

<GivingCard {post} {displaySettings} {onclick} />
