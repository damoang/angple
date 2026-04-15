<section class="bg-white py-24">
    <div class="mx-auto max-w-5xl px-6">
        <div class="mb-16 text-center">
            <p class="mb-4 text-sm font-medium uppercase tracking-widest text-teal-600">GET STARTED</p>
            <h2 class="text-4xl font-bold text-gray-900">Up and Running in 3 Steps</h2>
        </div>
        <div class="grid gap-8 md:grid-cols-3">
            {#each steps as step, i}
                <div class="relative">
                    <div class="absolute -left-2 -top-4 select-none text-8xl font-bold text-gray-100">{i + 1}</div>
                    <div class="relative">
                        <div class="text-2xl">{step.icon}</div>
                        <h3 class="mt-3 text-lg font-semibold text-gray-900">{step.title}</h3>
                        <p class="mt-2 text-sm text-gray-500">{step.desc}</p>
                        {#if step.code}
                            <code class="mt-3 block rounded-lg bg-gray-100 px-3 py-2 font-mono text-xs text-gray-600">{step.code}</code>
                        {/if}
                    </div>
                </div>
            {/each}
        </div>
    </div>
</section>

<script lang="ts">
    const steps = [
        { icon: '📥', title: 'Clone & Install', desc: 'Download from GitHub or use Docker. One command to start.', code: 'docker compose up' },
        { icon: '🎨', title: 'Choose Your Theme', desc: 'Pick from 24 themes in the admin panel. Customize colors, layout, and content.', code: null },
        { icon: '🚀', title: 'Launch Your Community', desc: 'Point your domain, invite members, and go live. Your community, your way.', code: null },
    ];
</script>
