<section class="bg-gray-50 py-24" id="features">
    <div class="mx-auto max-w-6xl px-6">
        <div class="mb-16 text-center">
            <p class="mb-4 text-sm font-medium uppercase tracking-widest text-teal-600">FEATURES</p>
            <h2 class="text-4xl font-bold text-gray-900">Everything You Need to Build Communities</h2>
        </div>
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {#each features as f}
                <div class="rounded-xl border border-gray-200 bg-white p-8 transition-all duration-300 hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-lg">
                    <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-50 text-2xl">{f.icon}</div>
                    <h3 class="mt-4 text-xl font-semibold text-gray-900">{f.title}</h3>
                    <p class="mt-2 text-sm leading-relaxed text-gray-500">{f.desc}</p>
                </div>
            {/each}
        </div>
    </div>
</section>

<script lang="ts">
    const features = [
        { icon: '🎨', title: '24 Themes, Zero Design Work', desc: 'Choose from 24 professionally designed themes. Church, corporate, community, blog — deploy a polished site without touching CSS.' },
        { icon: '🧩', title: 'Plugin-Ready Architecture', desc: 'Extend functionality with hooks and plugins. Slot-based component injection, lifecycle hooks, and a growing marketplace.' },
        { icon: '⚡', title: 'Modern Stack, No Compromise', desc: 'SvelteKit 5, Go, TypeScript, Tailwind CSS 4. Server-side rendering, type safety, and sub-second page loads.' },
        { icon: '🛡️', title: 'Self-Hosted, You Own Everything', desc: 'Install on your server. Your data, your rules. No vendor lock-in, no monthly fees for the core platform.' },
        { icon: '🌙', title: 'Dark Mode & Responsive', desc: 'Every theme ships with dark mode and responsive design. Accessible, fast, and beautiful on every device.' },
        { icon: '🏢', title: 'Multi-Tenant Ready', desc: 'Run multiple communities from a single installation. Subdomain routing, shared infrastructure, individual themes.' },
    ];
</script>
