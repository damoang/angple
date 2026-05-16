<script lang="ts">
    // Shim — 본문은 $plugins/ad-free/views/Landing.svelte
    import Landing from '$plugins/ad-free/views/Landing.svelte';
    let { data } = $props();
</script>

<Landing {data} />
