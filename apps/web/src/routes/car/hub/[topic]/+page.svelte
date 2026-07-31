<script lang="ts">
    /**
     * 자동차 주제 허브 (SEO L0 파일럿).
     * 설계: docs/seo-niche-hub-design-20260731.html
     * - 키워드화된 title/H1 + 소개문(색인 텍스트) + 큐레이션 글 목록(내부링크)
     * - CollectionPage + ItemList + BreadcrumbList 구조화 데이터
     */
    import { SeoHead, getSiteUrl, createBreadcrumbJsonLd } from '$lib/seo/index.js';
    import type { SeoConfig, JsonLdCollectionPage } from '$lib/seo/types.js';

    let { data } = $props();

    const siteUrl = getSiteUrl();
    const hubUrl = `${siteUrl}/car/hub/${data.topic.slug}`;
    const pageTitle = `${data.topic.title} 후기·정보 모음 | 다모앙 자동차`;

    function fmtDate(s: string): string {
        return (s || '').slice(0, 10);
    }

    // CollectionPage + ItemList: 이 허브가 "주제 큐레이션 페이지"임을 구글에 명시.
    const collectionJsonLd: JsonLdCollectionPage = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: pageTitle,
        description: data.topic.intro,
        url: hubUrl,
        mainEntity: {
            '@type': 'ItemList',
            itemListElement: data.posts.map((p, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                url: `${siteUrl}/car/${p.id}`,
                name: p.subject
            }))
        }
    };

    const seoConfig: SeoConfig = {
        meta: {
            title: pageTitle,
            description: data.topic.intro,
            canonicalUrl: hubUrl
        },
        og: {
            title: pageTitle,
            description: data.topic.intro,
            type: 'website',
            url: hubUrl
        },
        jsonLd: [
            createBreadcrumbJsonLd([
                { name: '홈', url: siteUrl },
                { name: '자동차', url: `${siteUrl}/car` },
                { name: data.topic.title, url: hubUrl }
            ]),
            collectionJsonLd
        ]
    };
</script>

<SeoHead config={seoConfig} />

<div class="mx-auto max-w-4xl px-4 py-6">
    <nav class="text-muted-foreground mb-3 text-sm">
        <a href="/car" class="hover:underline">자동차</a>
        <span aria-hidden="true"> › </span>
        <span>{data.topic.title}</span>
    </nav>

    <h1 class="mb-2 text-2xl font-bold">{data.topic.title} 후기·정보 모음</h1>
    <p class="text-muted-foreground mb-6 leading-relaxed">{data.topic.intro}</p>

    <h2 class="border-border mb-3 border-b pb-2 text-lg font-semibold">
        최신 {data.topic.title} 글 ({data.posts.length})
    </h2>

    <ul class="divide-border divide-y">
        {#each data.posts as post (post.id)}
            <li class="py-2.5">
                <a href="/car/{post.id}" class="group flex items-baseline justify-between gap-3">
                    <span
                        class="group-hover:text-primary flex-1 truncate font-medium transition-colors"
                    >
                        {post.subject}
                        {#if post.comments > 0}
                            <span class="text-primary ml-1 text-sm">[{post.comments}]</span>
                        {/if}
                    </span>
                    <span class="text-muted-foreground shrink-0 text-xs">
                        {post.author} · {fmtDate(post.datetime)}
                    </span>
                </a>
            </li>
        {/each}
    </ul>

    <div class="mt-6">
        <a href="/car" class="text-primary text-sm hover:underline">→ 자동차 게시판 전체 보기</a>
    </div>
</div>
