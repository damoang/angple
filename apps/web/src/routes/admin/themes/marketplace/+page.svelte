<script lang="ts">
    /**
     * 테마 마켓플레이스
     *
     * 공식 테마 검색 및 설치 페이지.
     * plugins/marketplace 패턴을 테마용으로 미러링.
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
    import {
        ChevronLeft,
        Search,
        Download,
        Star,
        Palette,
        Package,
        Loader2,
        Check,
        Eye
    } from '@lucide/svelte';
    import { onMount } from 'svelte';
    import { toast } from 'svelte-sonner';

    /** 마켓플레이스 테마 타입 */
    interface MarketplaceTheme {
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
        installed?: boolean;
        isActive?: boolean;
    }

    let searchQuery = $state('');
    let activeCategory = $state('all');
    let themes = $state<MarketplaceTheme[]>([]);
    let loading = $state(true);
    let installingThemes = $state<Set<string>>(new Set());

    /** 카테고리 목록 */
    const categories = [
        { id: 'all', label: '전체' },
        { id: 'general', label: '범용' },
        { id: 'community', label: '커뮤니티' },
        { id: 'blog', label: '블로그' },
        { id: 'business', label: '비즈니스' },
        { id: 'minimal', label: '미니멀' },
        { id: 'dark', label: '다크' }
    ];

    /** 마켓플레이스 API 호출 */
    async function fetchMarketplaceThemes() {
        loading = true;
        try {
            const response = await fetch('/api/themes/marketplace');
            const data = await response.json();

            if (data.themes) {
                themes = data.themes;
            } else {
                toast.error('테마 목록을 불러오는 데 실패했습니다.');
            }
        } catch {
            toast.error('서버와 연결할 수 없습니다.');
        } finally {
            loading = false;
        }
    }

    /** 테마 활성화 */
    async function activateTheme(themeId: string) {
        installingThemes.add(themeId);
        installingThemes = installingThemes;

        try {
            const response = await fetch('/api/themes/active', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ themeId })
            });

            if (response.ok) {
                toast.success('테마가 활성화되었습니다.');
                await fetchMarketplaceThemes();
            } else {
                const data = await response.json();
                toast.error(data.error || '테마 활성화에 실패했습니다.');
            }
        } catch {
            toast.error('테마 활성화 중 오류가 발생했습니다.');
        } finally {
            installingThemes.delete(themeId);
            installingThemes = installingThemes;
        }
    }

    onMount(() => {
        fetchMarketplaceThemes();
    });

    /** 검색 필터링 */
    const filteredThemes = $derived(() => {
        let result = themes;

        if (activeCategory !== 'all') {
            result = result.filter((t) => t.category === activeCategory);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(
                (t) =>
                    t.name.toLowerCase().includes(query) ||
                    t.description.toLowerCase().includes(query) ||
                    t.tags.some((tag) => tag.toLowerCase().includes(query))
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
        <Button variant="ghost" size="icon" href="/admin/themes">
            <ChevronLeft class="h-5 w-5" />
        </Button>
        <div>
            <h1 class="text-4xl font-bold">테마 마켓플레이스</h1>
            <p class="text-muted-foreground mt-2">
                Angple 생태계의 테마를 검색하고 적용하세요.
            </p>
        </div>
    </div>

    <!-- 검색 바 -->
    <div class="mb-6 flex gap-4">
        <div class="relative flex-1">
            <Search
                class="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            />
            <Input
                type="search"
                placeholder="테마 검색..."
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

    <!-- 테마 그리드 -->
    {#if loading}
        <Card>
            <CardContent class="py-12 text-center">
                <Loader2 class="text-muted-foreground mx-auto mb-4 h-12 w-12 animate-spin" />
                <h2 class="mb-2 text-xl font-semibold">테마 로드 중...</h2>
                <p class="text-muted-foreground">잠시만 기다려주세요.</p>
            </CardContent>
        </Card>
    {:else if filteredThemes().length === 0}
        <Card>
            <CardContent class="py-12 text-center">
                <Package class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <h2 class="mb-2 text-xl font-semibold">테마를 찾을 수 없습니다</h2>
                <p class="text-muted-foreground">다른 검색어로 시도해 보세요.</p>
            </CardContent>
        </Card>
    {:else}
        <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {#each filteredThemes() as theme (theme.id)}
                <Card class="overflow-hidden transition-shadow hover:shadow-lg">
                    {#if theme.screenshot}
                        <div class="bg-muted aspect-video">
                            <img
                                src={theme.screenshot}
                                alt={theme.name}
                                class="h-full w-full object-cover"
                            />
                        </div>
                    {:else}
                        <div class="bg-muted flex aspect-video items-center justify-center">
                            <Palette class="text-muted-foreground h-12 w-12" />
                        </div>
                    {/if}

                    <CardHeader>
                        <div class="flex items-start justify-between">
                            <div>
                                <CardTitle class="text-lg">{theme.name}</CardTitle>
                                <CardDescription class="mt-1">
                                    v{theme.version} · {theme.author}
                                </CardDescription>
                            </div>
                            <Badge variant={theme.price === 0 ? 'secondary' : 'default'}>
                                {theme.price === 0 ? '무료' : `₩${theme.price.toLocaleString()}`}
                            </Badge>
                        </div>
                    </CardHeader>

                    <CardContent>
                        <p class="text-muted-foreground mb-4 line-clamp-2 text-sm">
                            {theme.description}
                        </p>

                        <!-- 태그 -->
                        {#if theme.tags.length > 0}
                            <div class="mb-4 flex flex-wrap gap-1">
                                {#each theme.tags.slice(0, 3) as tag (tag)}
                                    <Badge variant="outline" class="text-xs">{tag}</Badge>
                                {/each}
                            </div>
                        {/if}

                        <!-- 통계 -->
                        <div class="text-muted-foreground mb-4 flex items-center gap-4 text-xs">
                            <span class="flex items-center gap-1">
                                <Download class="h-3 w-3" />
                                {formatDownloads(theme.downloads)}
                            </span>
                            <span class="flex items-center gap-1">
                                <Star class="h-3 w-3" />
                                {theme.rating}/5
                            </span>
                        </div>

                        <!-- 액션 버튼 -->
                        {#if theme.isActive}
                            <div class="flex gap-2">
                                <Button class="flex-1" size="sm" variant="secondary" disabled>
                                    <Check class="mr-2 h-4 w-4" />
                                    현재 적용 중
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    href={`/admin/themes/${theme.id}/settings`}
                                >
                                    <Eye class="h-4 w-4" />
                                </Button>
                            </div>
                        {:else if installingThemes.has(theme.id)}
                            <Button class="w-full" size="sm" disabled>
                                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                                적용 중...
                            </Button>
                        {:else}
                            <div class="flex gap-2">
                                <Button
                                    class="flex-1"
                                    size="sm"
                                    onclick={() => activateTheme(theme.id)}
                                >
                                    <Palette class="mr-2 h-4 w-4" />
                                    적용
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    href={`/admin/themes/${theme.id}/settings`}
                                >
                                    <Eye class="h-4 w-4" />
                                </Button>
                            </div>
                        {/if}
                    </CardContent>
                </Card>
            {/each}
        </div>
    {/if}
</div>
