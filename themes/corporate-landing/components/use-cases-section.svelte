<section class="bg-gray-50 py-24">
    <div class="mx-auto max-w-6xl px-6">
        <div class="mb-16 text-center">
            <p class="mb-4 text-sm font-medium uppercase tracking-widest text-teal-600">USE CASES</p>
            <h2 class="text-4xl font-bold text-gray-900">Built For Every Community</h2>
        </div>
        <div class="flex gap-4 overflow-x-auto pb-4 snap-x md:grid md:grid-cols-5 md:overflow-visible md:pb-0">
            {#each cases as c}
                <div class="min-w-[180px] snap-center rounded-xl border border-gray-200 bg-white p-6 text-center transition-all hover:border-teal-300 hover:shadow-md md:min-w-0">
                    <div class="text-3xl">{c.icon}</div>
                    <h3 class="mt-3 text-base font-semibold text-gray-900">{c.title}</h3>
                    <p class="mt-2 text-xs text-gray-500">{c.desc}</p>
                </div>
            {/each}
        </div>
    </div>
</section>

<script lang="ts">
    const cases = [
        { icon: '⛪', title: 'Churches', desc: 'Sermons, events, member directory. 12 church themes.' },
        { icon: '🎓', title: 'Education', desc: 'Student forums, course discussions, study groups.' },
        { icon: '🏢', title: 'Corporations', desc: 'Knowledge base, support forums, team collaboration.' },
        { icon: '❤️', title: 'Hobby Groups', desc: 'Music, gaming, sports. Communities deserve beautiful homes.' },
        { icon: '✍️', title: 'Personal Blogs', desc: 'Profile, blog posts, portfolio. Simple themes for creators.' },
    ];
</script>
