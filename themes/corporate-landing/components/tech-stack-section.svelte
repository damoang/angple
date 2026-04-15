<section class="bg-gradient-to-br from-zinc-900 via-zinc-950 to-black py-24 text-white">
    <div class="mx-auto max-w-5xl px-6">
        <div class="mb-16 text-center">
            <p class="mb-4 text-sm font-medium uppercase tracking-widest text-teal-400">TECH STACK</p>
            <h2 class="text-4xl font-bold">Built With Modern Technology</h2>
            <p class="mt-4 text-lg text-zinc-400">Performance, type safety, and developer happiness.</p>
        </div>
        <div class="grid grid-cols-2 gap-6 md:grid-cols-4">
            {#each stack as s}
                <div class="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 text-center transition-all hover:border-zinc-600 hover:bg-zinc-900/80">
                    <div class="text-3xl">{s.icon}</div>
                    <div class="mt-3 text-lg font-semibold">{s.name}</div>
                    <div class="mt-1 text-xs text-zinc-400">{s.desc}</div>
                </div>
            {/each}
        </div>
        <!-- Terminal -->
        <div class="mt-12 mx-auto max-w-2xl overflow-hidden rounded-xl border border-zinc-800 bg-black">
            <div class="flex items-center gap-1.5 border-b border-zinc-800 bg-zinc-900 px-4 py-2">
                <div class="h-2.5 w-2.5 rounded-full bg-red-500"></div>
                <div class="h-2.5 w-2.5 rounded-full bg-yellow-500"></div>
                <div class="h-2.5 w-2.5 rounded-full bg-green-500"></div>
                <span class="ml-2 text-xs text-zinc-500">terminal</span>
            </div>
            <div class="p-6 font-mono text-sm leading-relaxed">
                <div><span class="text-teal-400">$</span> <span class="text-zinc-300">git clone https://github.com/damoang/angple.git</span></div>
                <div><span class="text-teal-400">$</span> <span class="text-zinc-300">cd angple && docker compose up</span></div>
                <div class="mt-2"><span class="text-green-400">✓</span> <span class="text-zinc-400">Backend ready at :8080</span></div>
                <div><span class="text-green-400">✓</span> <span class="text-zinc-400">Frontend ready at :5173</span></div>
                <div><span class="text-green-400">✓</span> <span class="text-zinc-400">Admin panel at :5174</span></div>
            </div>
        </div>
    </div>
</section>

<script lang="ts">
    const stack = [
        { icon: '🔥', name: 'SvelteKit 5', desc: 'SSR, routing, reactive' },
        { icon: '🐹', name: 'Go', desc: 'Fast, concurrent API' },
        { icon: '📘', name: 'TypeScript', desc: 'Type safety everywhere' },
        { icon: '🎨', name: 'Tailwind 4', desc: 'Utility-first styling' },
    ];
</script>
