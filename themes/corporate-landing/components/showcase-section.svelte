<section class="bg-white py-24" id="showcase">
    <div class="mx-auto max-w-6xl px-6">
        <div class="mb-16 text-center">
            <p class="mb-4 text-sm font-medium uppercase tracking-widest text-teal-600">SHOWCASE</p>
            <h2 class="text-4xl font-bold text-gray-900">Real Communities, Running Today</h2>
            <p class="mt-4 text-lg text-gray-500">Battle-tested platforms serving thousands of users daily.</p>
        </div>
        <div class="grid gap-8 md:grid-cols-2">
            {#each sites as site}
                <a href={site.url} target="_blank" rel="noopener" class="group overflow-hidden rounded-xl border border-gray-200 transition-all duration-300 hover:shadow-xl">
                    <!-- Browser chrome -->
                    <div class="flex h-8 items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-3">
                        <div class="h-2.5 w-2.5 rounded-full bg-red-400"></div>
                        <div class="h-2.5 w-2.5 rounded-full bg-yellow-400"></div>
                        <div class="h-2.5 w-2.5 rounded-full bg-green-400"></div>
                        <div class="ml-2 flex-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-400">{site.url}</div>
                    </div>
                    <!-- Screenshot placeholder -->
                    <div class="aspect-video bg-gradient-to-br {site.gradient} transition-transform duration-300 group-hover:scale-[1.02]"></div>
                    <!-- Info -->
                    <div class="p-5">
                        <div class="flex items-center justify-between">
                            <div>
                                <span class="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-600">{site.tag}</span>
                                <h3 class="mt-2 text-lg font-semibold text-gray-900">{site.name}</h3>
                            </div>
                            <span class="text-gray-400 transition-transform group-hover:translate-x-1">&rarr;</span>
                        </div>
                        <p class="mt-1 text-sm text-gray-500">{site.desc}</p>
                    </div>
                </a>
            {/each}
        </div>
    </div>
</section>

<script lang="ts">
    const sites = [
        { name: 'damoang.net', url: 'https://damoang.net', tag: 'Community', desc: '20,000+ members. Korea\'s largest Angple-powered developer community.', gradient: 'from-indigo-100 to-blue-50' },
        { name: 'muzia.net', url: 'https://muzia.net', tag: 'Music', desc: 'Running since 2002. Music lovers sharing and discussing for 24 years.', gradient: 'from-pink-100 to-purple-50' },
        { name: 'church.re.kr', url: 'https://church.re.kr', tag: 'SaaS', desc: 'Churches create websites in 3 minutes. Theme selection, customization wizard.', gradient: 'from-violet-100 to-indigo-50' },
        { name: 'hdbc.kr', url: 'https://hdbc.kr', tag: 'Church', desc: 'A real church running their entire web presence on Angple.', gradient: 'from-amber-100 to-orange-50' },
    ];
</script>
