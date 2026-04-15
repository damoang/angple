<section class="bg-white py-24">
    <div class="mx-auto max-w-3xl px-6">
        <div class="mb-16 text-center">
            <p class="mb-4 text-sm font-medium uppercase tracking-widest text-teal-600">FAQ</p>
            <h2 class="text-4xl font-bold text-gray-900">Frequently Asked Questions</h2>
        </div>
        {#each faqs as faq, i}
            <div class="border-b border-gray-200">
                <button class="flex w-full items-center justify-between py-5 text-left" onclick={() => toggle(i)}>
                    <span class="text-lg font-semibold text-gray-900">{faq.q}</span>
                    <span class="ml-4 text-gray-400 transition-transform {openIdx === i ? 'rotate-180' : ''}">&darr;</span>
                </button>
                {#if openIdx === i}
                    <p class="pb-5 text-sm leading-relaxed text-gray-500">{faq.a}</p>
                {/if}
            </div>
        {/each}
    </div>
</section>

<script lang="ts">
    let openIdx = $state<number | null>(null);
    function toggle(i: number) { openIdx = openIdx === i ? null : i; }

    const faqs = [
        { q: 'Is Angple really free?', a: 'Yes. The core platform is MIT-licensed open source. Download, modify, and use it commercially with no restrictions.' },
        { q: 'How is this different from WordPress?', a: 'WordPress is a CMS for blogs. Angple is purpose-built for bulletin-board communities with recommendation systems, level systems, and real-time discussion features.' },
        { q: 'Can I migrate from my existing platform?', a: 'Angple supports import from common formats. For complex migrations, our agency partners can help.' },
        { q: 'What about hosting?', a: 'Self-host on any server running Docker. Or wait for our managed SaaS hosting (coming soon) for zero-maintenance deployment.' },
        { q: 'Is it production-ready?', a: 'damoang.net serves 20,000+ users daily. muzia.net has been running since 2002. The platform is battle-tested.' },
        { q: 'Can I create my own theme?', a: 'Absolutely. Build custom themes with SvelteKit and Tailwind CSS. The theme engine supports full customization with hot-reload during development.' },
    ];
</script>
