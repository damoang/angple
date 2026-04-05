<script lang="ts">
    import favicon from '$lib/assets/favicon.png';
    import { onMount } from 'svelte';
    import { authActions } from '$lib/stores/auth.svelte';
    import WikiHeader from '../components/wiki-header.svelte';
    import WikiSidebar from '../components/wiki-sidebar.svelte';
    import WikiFooter from '../components/wiki-footer.svelte';

    /**
     * Wiki Theme - 위키앙 전용 레이아웃
     * - 나무위키/위키피디아 스타일
     * - 좌측 네비게이션
     * - 넓은 콘텐츠 영역
     * - 깔끔하고 단순한 UI
     */

    const { children } = $props();

    onMount(() => {
        console.log('[Wiki Theme] Layout mounted');
        authActions.initAuth();
    });
</script>

<svelte:head>
    <title>위키앙</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href={favicon} />
    <meta name="description" content="위키앙 - 자유로운 백과사전" />
</svelte:head>

<div class="bg-background flex min-h-screen flex-col">
    <!-- Header -->
    <WikiHeader />

    <!-- Main Content Area -->
    <div class="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6">
        <!-- Sidebar (Desktop only) -->
        <div class="hidden lg:block">
            <WikiSidebar />
        </div>

        <!-- Page Content -->
        <main class="min-w-0 flex-1">
            <article class="prose prose-blue dark:prose-invert max-w-none">
                {@render children()}
            </article>
        </main>
    </div>

    <!-- Footer -->
    <WikiFooter />
</div>

<style>
    /* Wiki-specific prose styles */
    :global(.prose h1) {
        border-bottom: 1px solid var(--border);
        padding-bottom: 0.5rem;
    }

    :global(.prose h2) {
        border-bottom: 1px solid var(--border);
        padding-bottom: 0.25rem;
    }

    :global(.prose a) {
        color: var(--primary);
        text-decoration: none;
    }

    :global(.prose a:hover) {
        text-decoration: underline;
    }

    :global(.prose table) {
        border-collapse: collapse;
        border: 1px solid var(--border);
    }

    :global(.prose th),
    :global(.prose td) {
        border: 1px solid var(--border);
        padding: 0.5rem 0.75rem;
    }

    :global(.prose th) {
        background-color: var(--muted);
    }
</style>
