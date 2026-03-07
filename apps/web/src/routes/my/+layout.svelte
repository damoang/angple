<script lang="ts">
    import { navigating } from '$app/stores';
    import type { Snippet } from 'svelte';
    import MyNav from '$lib/components/features/my/my-nav.svelte';

    let { children }: { children: Snippet } = $props();
</script>

<MyNav />

<!-- 각 페이지 콘텐츠 -->
{#if $navigating}
    <div class="mx-auto max-w-4xl px-4">
        <div class="flex justify-center py-12">
            <div
                class="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"
            ></div>
        </div>
    </div>
{:else}
    {@render children()}
{/if}
