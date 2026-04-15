<section class="bg-gray-50 py-24" id="pricing">
    <div class="mx-auto max-w-5xl px-6">
        <div class="mb-16 text-center">
            <p class="mb-4 text-sm font-medium uppercase tracking-widest text-teal-600">PRICING</p>
            <h2 class="text-4xl font-bold text-gray-900">Simple, Transparent Pricing</h2>
        </div>
        <div class="grid gap-6 md:grid-cols-3">
            {#each plans as plan}
                <div class="rounded-xl border bg-white p-8 {plan.popular ? 'border-teal-500 ring-2 ring-teal-500/20 relative shadow-lg' : 'border-gray-200'}">
                    {#if plan.popular}
                        <span class="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-teal-600 px-3 py-1 text-xs font-bold text-white">Popular</span>
                    {/if}
                    <h3 class="text-xl font-semibold text-gray-900">{plan.name}</h3>
                    <div class="mt-4 text-4xl font-bold text-gray-900">{plan.price}</div>
                    <p class="mt-1 text-sm text-gray-500">{plan.sub}</p>
                    <ul class="mt-6 space-y-3 text-sm text-gray-600">
                        {#each plan.features as f}
                            <li class="flex items-start gap-2"><span class="text-teal-500">✓</span> {f}</li>
                        {/each}
                    </ul>
                    <a href={plan.href} target="_blank" rel="noopener" class="mt-8 block rounded-lg py-3 text-center text-sm font-semibold transition-all {plan.popular ? 'bg-teal-600 text-white hover:bg-teal-500' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}">{plan.cta}</a>
                </div>
            {/each}
        </div>
    </div>
</section>

<script lang="ts">
    const plans = [
        { name: 'Open Source', price: 'Free', sub: 'forever', popular: false, features: ['Self-hosted', 'All 24 themes', 'Full source code', 'Community support'], cta: 'Download on GitHub', href: 'https://github.com/damoang/angple' },
        { name: 'Managed', price: 'Coming Soon', sub: 'hosted by SDKLabs', popular: true, features: ['Zero-maintenance hosting', 'Automatic updates', 'SSL, backups, CDN', 'Priority support'], cta: 'Join Waitlist', href: 'mailto:team@sdklabs.kr' },
        { name: 'Enterprise', price: 'Custom', sub: 'for organizations', popular: false, features: ['Custom themes & plugins', 'Dedicated infrastructure', 'SLA guarantee', 'Agency partnership'], cta: 'Contact Us', href: 'mailto:team@sdklabs.kr' },
    ];
</script>
