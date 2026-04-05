<script lang="ts">
    import { SeoHead, getSiteUrl } from '$lib/seo/index.js';
    import type { SeoConfig } from '$lib/seo/types.js';

    let { data } = $props();

    const siteName = '위키앙';
    const siteTagline = '자유로운 위키 백과';
    const homeTitle = data.mainPage?.title
        ? `${data.mainPage.title} - ${siteName}`
        : `${siteName} | ${siteTagline}`;
    const homeDescription = data.mainPage?.description || `${siteName} - ${siteTagline}`;

    const seoConfig: SeoConfig = $derived({
        meta: {
            title: homeTitle,
            description: homeDescription,
            canonicalUrl: getSiteUrl(),
            includeSiteName: false
        },
        og: {
            title: homeTitle,
            description: homeDescription,
            type: 'website',
            url: getSiteUrl()
        }
    });

    function formatDate(date: Date | string): string {
        const d = typeof date === 'string' ? new Date(date) : date;
        return d.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
</script>

<SeoHead config={seoConfig} />

<div class="mx-auto max-w-4xl px-4 py-6">
    <!-- 메인 페이지 (대문) -->
    {#if data.mainPage}
        <article>
            <h1 class="mb-4 border-b-2 border-blue-600 pb-2 text-3xl font-bold text-gray-900">
                {data.mainPage.title}
            </h1>

            <div class="prose prose-lg max-w-none">
                {#if data.mainPage.content}
                    {@html data.mainPage.content}
                {:else if data.mainPage.content_raw}
                    <pre class="whitespace-pre-wrap">{data.mainPage.content_raw}</pre>
                {:else}
                    <p class="text-gray-500">내용이 없습니다.</p>
                {/if}
            </div>

            <div class="mt-6 text-sm text-gray-500">
                마지막 수정: {formatDate(data.mainPage.updated_at)}
            </div>
        </article>
    {:else}
        <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center">
            <h1 class="mb-2 text-2xl font-bold text-yellow-800">위키앙에 오신 것을 환영합니다</h1>
            <p class="text-yellow-700">대문 페이지가 아직 생성되지 않았습니다.</p>
        </div>
    {/if}

    <!-- 최근 문서 목록 -->
    {#if data.recentPages && data.recentPages.length > 0}
        <section class="mt-10">
            <h2 class="mb-4 border-b border-gray-200 pb-2 text-xl font-semibold text-gray-800">
                최근 문서
            </h2>
            <ul class="divide-y divide-gray-100">
                {#each data.recentPages as page}
                    <li class="py-3">
                        <a
                            href="/wiki{page.path}"
                            class="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                            {page.title}
                        </a>
                        {#if page.description}
                            <p class="mt-1 text-sm text-gray-600">{page.description}</p>
                        {/if}
                        <span class="text-xs text-gray-400">{formatDate(page.updated_at)}</span>
                    </li>
                {/each}
            </ul>
        </section>
    {/if}
</div>
