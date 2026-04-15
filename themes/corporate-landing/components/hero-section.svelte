<script lang="ts">
    import { browser } from '$app/environment';
    let copied = $state(false);
    function copyCommand() {
        if (browser) navigator.clipboard.writeText('npx create-angple@latest');
        copied = true;
        setTimeout(() => copied = false, 2000);
    }
</script>

<div class="relative flex min-h-screen w-full flex-col items-center justify-center px-4 text-center">
    <!-- Nav -->
    <nav class="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-6 py-4 backdrop-blur-md bg-black/30">
        <span class="text-xl font-bold text-white">angple</span>
        <div class="hidden items-center gap-6 text-sm text-zinc-400 md:flex">
            <a href="#features" class="hover:text-white transition-colors">Features</a>
            <a href="#showcase" class="hover:text-white transition-colors">Showcase</a>
            <a href="#pricing" class="hover:text-white transition-colors">Pricing</a>
            <a href="https://github.com/damoang/angple" target="_blank" rel="noopener" class="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-1.5 text-white hover:bg-zinc-700 transition-colors">GitHub</a>
        </div>
    </nav>

    <!-- Badge -->
    <span class="mb-6 rounded-full border border-zinc-700 bg-zinc-900/50 px-4 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur">Open Source Community Platform</span>

    <!-- Divider -->
    <div class="mb-8 h-px w-full max-w-md bg-gradient-to-r from-transparent via-teal-500/50 to-transparent hidden md:block"></div>

    <!-- Headline -->
    <h1 class="text-4xl font-bold text-white sm:text-6xl md:text-7xl lg:text-8xl">
        Build Communities,<br />Not Infrastructure.
    </h1>

    <!-- Sub -->
    <p class="mt-6 max-w-2xl text-lg text-zinc-400">
        The open-source platform engine for bulletin-board communities.<br class="hidden sm:block" />
        24 themes, plugin-ready, self-hosted. Like WordPress, but for communities.
    </p>

    <!-- Divider -->
    <div class="mt-8 h-px w-full max-w-md bg-gradient-to-r from-transparent via-teal-500/50 to-transparent hidden md:block"></div>

    <!-- CTAs -->
    <div class="mt-8 flex flex-wrap items-center justify-center gap-4">
        <a href="https://github.com/damoang/angple" target="_blank" rel="noopener"
            class="rounded-lg bg-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-600/25 transition-all hover:bg-teal-500 hover:scale-105">
            Get Started
        </a>
        <a href="https://damoang.net" target="_blank" rel="noopener"
            class="rounded-lg border border-zinc-700 bg-zinc-800 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-zinc-700 hover:scale-105">
            Live Demo
        </a>
    </div>

    <!-- Code block -->
    <button class="mt-8 flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/80 px-5 py-3 font-mono text-sm text-zinc-300 transition-colors hover:border-zinc-600" onclick={copyCommand}>
        <span class="text-teal-400">$</span> npx create-angple@latest
        <span class="text-xs text-zinc-500">{copied ? 'Copied!' : 'Click to copy'}</span>
    </button>

    <!-- Scroll indicator -->
    <div class="absolute bottom-8 animate-bounce">
        <svg class="h-6 w-6 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"/></svg>
    </div>
</div>
