<script lang="ts">
    import { getUser } from '$lib/stores/auth.svelte';
    import { customizerStore } from '$lib/stores/admin-customizer.svelte';
    import Settings from '@lucide/svelte/icons/settings';

    const { serverIsAdmin = false }: { serverIsAdmin?: boolean } = $props();

    const user = $derived(getUser());
    const isAdmin = $derived(serverIsAdmin && (user?.mb_level ?? 0) >= 10);
    const isOpen = $derived(customizerStore.isOpen);
</script>

{#if isAdmin && !isOpen}
    <button
        type="button"
        onclick={() => customizerStore.open()}
        class="bg-primary text-primary-foreground hover:bg-primary/90 fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105"
        title="페이지 커스터마이저"
    >
        <Settings class="h-5 w-5" />
    </button>
{/if}
