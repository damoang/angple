<script lang="ts">
    import { authStore } from '$lib/stores/auth.svelte';
</script>

<header class="border-b border-slate-700 bg-slate-800 shadow-lg">
    <div class="container mx-auto px-4">
        <div class="flex h-16 items-center justify-between">
            <!-- Logo -->
            <div class="flex items-center gap-2">
                <div class="h-8 w-8 rounded bg-gradient-to-br from-slate-600 to-slate-400"></div>
                <h1 class="text-xl font-bold text-slate-100">Modern Dark</h1>
            </div>

            <!-- Navigation -->
            <nav class="hidden space-x-6 md:flex">
                <a href="/" class="text-slate-300 transition hover:text-slate-100">Home</a>
                <a href="/free" class="text-slate-300 transition hover:text-slate-100">Board</a>
                <a href="/notice" class="text-slate-300 transition hover:text-slate-100">Notice</a>
            </nav>

            <!-- User Menu -->
            <div class="flex items-center gap-4">
                {#if authStore.isAuthenticated}
                    <span class="text-sm text-slate-300">{authStore.user?.name}</span>
                    <button
                        class="rounded bg-slate-700 px-4 py-2 text-sm text-slate-100 hover:bg-slate-600"
                    >
                        Logout
                    </button>
                {:else}
                    <button
                        class="rounded bg-slate-600 px-4 py-2 text-sm text-slate-100 hover:bg-slate-500"
                    >
                        Login
                    </button>
                {/if}
            </div>
        </div>
    </div>
</header>
