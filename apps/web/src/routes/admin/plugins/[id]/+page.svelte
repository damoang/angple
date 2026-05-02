<script lang="ts">
    import type { Component } from 'svelte';
    import { loadPluginSvelteByPath } from '$lib/utils/plugin-optional-loader';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    let PluginComponent = $state<Component | null>(null);
    let loadError = $state<string | null>(null);

    $effect(() => {
        loadPluginSvelteByPath(data.pluginId, data.componentPath)
            .then((c) => {
                if (!c) {
                    loadError = `Component not found: ${data.componentPath}`;
                } else {
                    PluginComponent = c;
                }
            })
            .catch((err: unknown) => {
                loadError = `Load failed: ${(err as Error).message}`;
            });
    });
</script>

<svelte:head>
    <title>{data.title} — Admin</title>
</svelte:head>

<div class="plugin-admin-page">
    <h1>{data.title}</h1>

    {#if PluginComponent}
        <PluginComponent />
    {:else if loadError}
        <div class="error">
            플러그인 컴포넌트 로드 실패: {loadError}
        </div>
    {:else}
        <div class="loading">로딩 중…</div>
    {/if}
</div>

<style>
    .plugin-admin-page {
        padding: 1rem;
    }
    .error {
        color: #c33;
        background: #fee;
        padding: 0.75rem 1rem;
        border-radius: 4px;
    }
    .loading {
        color: #666;
    }
</style>
