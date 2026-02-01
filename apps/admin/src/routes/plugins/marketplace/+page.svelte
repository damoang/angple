<script lang="ts">
    /**
     * 플러그인 마켓플레이스
     *
     * GitHub Packages 기반 플러그인 검색 및 설치 페이지
     */

    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Badge } from '$lib/components/ui/badge';
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle
    } from '$lib/components/ui/card';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs';
    import { ChevronLeft, Search, Download, Star, Plug, Package } from '@lucide/svelte';
    import { t } from '$lib/i18n';

    /** 마켓플레이스 플러그인 타입 */
    interface MarketplacePlugin {
        id: string;
        name: string;
        description: string;
        version: string;
        author: string;
        downloads: number;
        rating: number;
        tags: string[];
        category: string;
        price: number;
        screenshot?: string;
        packageName?: string;
    }

    let searchQuery = $state('');
    let activeCategory = $state('all');

    /** 카테고리 목록 */
    const categories = [
        { id: 'all', label: '전체' },
        { id: 'board', label: '게시판' },
        { id: 'editor', label: '에디터' },
        { id: 'seo', label: 'SEO' },
        { id: 'social', label: '소셜' },
        { id: 'ai', label: 'AI' },
        { id: 'analytics', label: '분석' },
        { id: 'media', label: '미디어' },
        { id: 'auth', label: '인증' },
        { id: 'payment', label: '결제' }
    ];

    /** 추천 플러그인 (추후 API 연동) */
    const featuredPlugins: MarketplacePlugin[] = [
        {
            id: 'plugin-content-history',
            name: 'Content History',
            description: '소프트 삭제 + 수정 이력 추적. 관리자가 삭제된 게시물을 복구할 수 있습니다.',
            version: '1.0.0',
            author: 'Angple Team',
            downloads: 0,
            rating: 5,
            tags: ['history', 'soft-delete', 'admin'],
            category: 'board',
            price: 0
        },
        {
            id: 'plugin-banner-message',
            name: 'Banner Message System',
            description: '위치 기반 배너 광고 시스템. 헤더, 사이드바, 콘텐츠 영역에 배너를 표시합니다.',
            version: '1.0.0',
            author: 'Damoang Team',
            downloads: 0,
            rating: 4,
            tags: ['banner', 'advertising', 'marketing'],
            category: 'custom',
            price: 0
        },
        {
            id: 'plugin-mention',
            name: 'Mention System',
            description: '@멘션 파싱 및 알림 시스템. 댓글에서 다른 사용자를 멘션할 수 있습니다.',
            version: '1.0.0',
            author: 'Angple Team',
            downloads: 0,
            rating: 4,
            tags: ['mention', 'notification', 'social'],
            category: 'social',
            price: 0
        }
    ];

    /** 검색 필터링 */
    const filteredPlugins = $derived(() => {
        let result = featuredPlugins;

        if (activeCategory !== 'all') {
            result = result.filter(p => p.category === activeCategory);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(
                p =>
                    p.name.toLowerCase().includes(query) ||
                    p.description.toLowerCase().includes(query) ||
                    p.tags.some(tag => tag.toLowerCase().includes(query))
            );
        }

        return result;
    });

    function formatDownloads(count: number): string {
        if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
        return count.toString();
    }
</script>

<div class="container mx-auto p-8">
    <!-- 헤더 -->
    <div class="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" href="/plugins">
            <ChevronLeft class="h-5 w-5" />
        </Button>
        <div>
            <h1 class="text-4xl font-bold">{t('admin_plugins_marketplace')}</h1>
            <p class="text-muted-foreground mt-2">
                Angple 생태계의 플러그인을 검색하고 설치하세요.
            </p>
        </div>
    </div>

    <!-- 검색 바 -->
    <div class="mb-6 flex gap-4">
        <div class="relative flex-1">
            <Search class="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <Input
                type="search"
                placeholder="플러그인 검색..."
                class="pl-10"
                bind:value={searchQuery}
            />
        </div>
    </div>

    <!-- 카테고리 탭 -->
    <div class="mb-6 flex flex-wrap gap-2">
        {#each categories as category (category.id)}
            <Button
                variant={activeCategory === category.id ? 'default' : 'outline'}
                size="sm"
                onclick={() => (activeCategory = category.id)}
            >
                {category.label}
            </Button>
        {/each}
    </div>

    <!-- 플러그인 그리드 -->
    {#if filteredPlugins().length === 0}
        <Card>
            <CardContent class="py-12 text-center">
                <Package class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <h2 class="mb-2 text-xl font-semibold">플러그인을 찾을 수 없습니다</h2>
                <p class="text-muted-foreground">다른 검색어로 시도해 보세요.</p>
            </CardContent>
        </Card>
    {:else}
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {#each filteredPlugins() as plugin (plugin.id)}
                <Card class="overflow-hidden transition-shadow hover:shadow-lg">
                    {#if plugin.screenshot}
                        <div class="bg-muted aspect-video">
                            <img
                                src={plugin.screenshot}
                                alt={plugin.name}
                                class="h-full w-full object-cover"
                            />
                        </div>
                    {:else}
                        <div class="bg-muted flex aspect-video items-center justify-center">
                            <Plug class="text-muted-foreground h-12 w-12" />
                        </div>
                    {/if}

                    <CardHeader>
                        <div class="flex items-start justify-between">
                            <div>
                                <CardTitle class="text-lg">{plugin.name}</CardTitle>
                                <CardDescription class="mt-1">
                                    v{plugin.version} · {plugin.author}
                                </CardDescription>
                            </div>
                            <Badge variant={plugin.price === 0 ? 'secondary' : 'default'}>
                                {plugin.price === 0 ? '무료' : `₩${plugin.price.toLocaleString()}`}
                            </Badge>
                        </div>
                    </CardHeader>

                    <CardContent>
                        <p class="text-muted-foreground mb-4 line-clamp-2 text-sm">
                            {plugin.description}
                        </p>

                        <!-- 태그 -->
                        {#if plugin.tags.length > 0}
                            <div class="mb-4 flex flex-wrap gap-1">
                                {#each plugin.tags.slice(0, 3) as tag (tag)}
                                    <Badge variant="outline" class="text-xs">{tag}</Badge>
                                {/each}
                            </div>
                        {/if}

                        <!-- 통계 -->
                        <div class="text-muted-foreground mb-4 flex items-center gap-4 text-xs">
                            <span class="flex items-center gap-1">
                                <Download class="h-3 w-3" />
                                {formatDownloads(plugin.downloads)}
                            </span>
                            <span class="flex items-center gap-1">
                                <Star class="h-3 w-3" />
                                {plugin.rating}/5
                            </span>
                        </div>

                        <!-- 설치 버튼 -->
                        <Button class="w-full" size="sm">
                            <Download class="mr-2 h-4 w-4" />
                            설치
                        </Button>
                    </CardContent>
                </Card>
            {/each}
        </div>
    {/if}
</div>
