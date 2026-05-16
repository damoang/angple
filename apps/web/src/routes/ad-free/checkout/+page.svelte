<script lang="ts">
    // Shim — 본문은 $plugins/ad-free/views/Checkout.svelte
    import Checkout from '$plugins/ad-free/views/Checkout.svelte';
    let { data } = $props();
</script>

<Checkout {data} />
