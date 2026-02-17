<script lang="ts">
    /**
     * 테마 마켓플레이스
     *
     * 로컬 테마 + 레지스트리(외부) 테마 검색 및 설치/활성화
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
        Eye,
        Crown,
        Lock,
        KeyRound
    } from '@lucide/svelte';
    import { onMount } from 'svelte';
    import { toast } from 'svelte-sonner';
    import type { MarketplaceTheme } from '$lib/types/registry';

    let searchQuery = $state('');
    let activeCategory = $state('all');
    let activeTier = $state<'all' | 'free' | 'premium'>('all');
    let themes = $state<MarketplaceTheme[]>([]);
    let loading = $state(true);
    let installingThemes = $state<Set<string>>(new Set());

    // GitHub 토큰 다이얼로그
    let showTokenDialog = $state(false);
    let tokenInput = $state('');
    let tokenScope = $state('@damoang');
    let tokenValidating = $state(false);

    // 라이선스 키 다이얼로그
    let showLicenseDialog = $state(false);
    let licenseInput = $state('');
    let licenseThemeId = $state('');

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

    /** 티어 필터 */
    const tiers = [
        { id: 'all' as const, label: '전체' },
        { id: 'free' as const, label: '무료' },
        { id: 'premium' as const, label: '프리미엄' }
    ];

    /** 마켓플레이스 API 호출 */
    async function fetchMarketplaceThemes() {
        loading = true;
        try {
            const params = activeTier !== 'all' ? `?tier=${activeTier}` : '';
            const response = await fetch(`/api/themes/marketplace${params}`);
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

    /** 테마 활성화 (이미 설치된 테마) */
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

    /** 마켓플레이스에서 테마 설치 */
    async function installFromMarketplace(themeId: string, licenseKey?: string) {
        installingThemes.add(themeId);
        installingThemes = installingThemes;

        try {
            const response = await fetch('/api/themes/marketplace/install', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ themeId, licenseKey })
            });

            const data = await response.json();

            if (data.success) {
                toast.success(`${data.theme?.name || themeId} 테마가 설치되었습니다.`);
                await fetchMarketplaceThemes();
            } else if (data.requiresAuth) {
                // GitHub 토큰 필요
                showTokenDialog = true;
            } else if (data.requiresLicense) {
                // 라이선스 키 필요
                licenseThemeId = themeId;
                showLicenseDialog = true;
            } else {
                toast.error(data.error || '설치에 실패했습니다.');
            }
        } catch {
            toast.error('설치 중 오류가 발생했습니다.');
        } finally {
            installingThemes.delete(themeId);
            installingThemes = installingThemes;
        }
    }

    /** GitHub 토큰 저장 */
    async function saveGitHubToken() {
        if (!tokenInput.trim()) return;
        tokenValidating = true;

        try {
            const response = await fetch('/api/plugins/tokens', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scope: tokenScope, token: tokenInput })
            });

            const data = await response.json();

            if (response.ok) {
                toast.success(`GitHub 토큰이 저장되었습니다. (${data.validation?.username || tokenScope})`);
                showTokenDialog = false;
                tokenInput = '';
                await fetchMarketplaceThemes();
            } else {
                toast.error(data.error || '토큰 저장에 실패했습니다.');
            }
        } catch {
            toast.error('토큰 저장 중 오류가 발생했습니다.');
        } finally {
            tokenValidating = false;
        }
    }

    /** 라이선스 키로 설치 */
    async function installWithLicense() {
        if (!licenseInput.trim() || !licenseThemeId) return;
        showLicenseDialog = false;
        await installFromMarketplace(licenseThemeId, licenseInput);
        licenseInput = '';
        licenseThemeId = '';
    }

    onMount(() => {
        fetchMarketplaceThemes();
    });

    /** 검색 + 카테고리 필터링 */
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
                Angple 생태계의 테마를 검색하고 설치하세요.
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

    <!-- 티어 탭 -->
    <div class="mb-4 flex flex-wrap gap-2">
        {#each tiers as tier (tier.id)}
            <Button
                variant={activeTier === tier.id ? 'default' : 'outline'}
                size="sm"
                onclick={() => { activeTier = tier.id; fetchMarketplaceThemes(); }}
            >
                {#if tier.id === 'premium'}
                    <Crown class="mr-1 h-3 w-3" />
                {/if}
                {tier.label}
            </Button>
        {/each}
    </div>

    <!-- 카테고리 탭 -->
    <div class="mb-6 flex flex-wrap gap-2">
        {#each categories as category (category.id)}
            <Button
                variant={activeCategory === category.id ? 'secondary' : 'ghost'}
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
                            <div class="flex gap-1">
                                {#if theme.tier === 'premium'}
                                    <Badge variant="default" class="bg-amber-500 hover:bg-amber-600">
                                        <Crown class="mr-1 h-3 w-3" />
                                        프리미엄
                                    </Badge>
                                {:else}
                                    <Badge variant="secondary">무료</Badge>
                                {/if}
                            </div>
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
                            {#if !theme.installed}
                                <Badge variant="outline" class="text-xs">미설치</Badge>
                            {/if}
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
                                {theme.installed ? '적용 중...' : '설치 중...'}
                            </Button>
                        {:else if theme.installed}
                            <!-- 설치됨 → 활성화 -->
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
                        {:else if theme.tier === 'premium' && theme.requiredScope}
                            <!-- 프리미엄 미설치 → 잠금 해제 또는 설치 -->
                            <div class="flex gap-2">
                                <Button
                                    class="flex-1"
                                    size="sm"
                                    variant="default"
                                    onclick={() => installFromMarketplace(theme.id)}
                                >
                                    <Lock class="mr-2 h-4 w-4" />
                                    설치
                                </Button>
                            </div>
                        {:else}
                            <!-- 무료 미설치 → 설치 -->
                            <Button
                                class="w-full"
                                size="sm"
                                onclick={() => installFromMarketplace(theme.id)}
                            >
                                <Download class="mr-2 h-4 w-4" />
                                설치
                            </Button>
                        {/if}
                    </CardContent>
                </Card>
            {/each}
        </div>
    {/if}
</div>

<!-- GitHub 토큰 다이얼로그 -->
{#if showTokenDialog}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <Card class="w-full max-w-md">
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    <KeyRound class="h-5 w-5" />
                    GitHub 토큰 등록
                </CardTitle>
                <CardDescription>
                    프리미엄 테마를 설치하려면 GitHub Personal Access Token이 필요합니다.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div class="space-y-4">
                    <div>
                        <label class="text-sm font-medium" for="token-scope">Scope</label>
                        <Input
                            id="token-scope"
                            bind:value={tokenScope}
                            placeholder="@damoang"
                            class="mt-1"
                        />
                    </div>
                    <div>
                        <label class="text-sm font-medium" for="token-input">Personal Access Token</label>
                        <Input
                            id="token-input"
                            type="password"
                            bind:value={tokenInput}
                            placeholder="ghp_..."
                            class="mt-1"
                        />
                        <p class="text-muted-foreground mt-1 text-xs">
                            GitHub Settings > Developer settings > Personal access tokens에서 생성.
                            <code>repo</code> 권한이 필요합니다.
                        </p>
                    </div>
                    <div class="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onclick={() => { showTokenDialog = false; tokenInput = ''; }}
                        >
                            취소
                        </Button>
                        <Button
                            onclick={saveGitHubToken}
                            disabled={!tokenInput.trim() || tokenValidating}
                        >
                            {#if tokenValidating}
                                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                                검증 중...
                            {:else}
                                저장
                            {/if}
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>
{/if}

<!-- 라이선스 키 다이얼로그 -->
{#if showLicenseDialog}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <Card class="w-full max-w-md">
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    <KeyRound class="h-5 w-5" />
                    라이선스 키 입력
                </CardTitle>
                <CardDescription>
                    이 테마는 라이선스 키가 필요합니다.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div class="space-y-4">
                    <div>
                        <label class="text-sm font-medium" for="license-input">라이선스 키</label>
                        <Input
                            id="license-input"
                            bind:value={licenseInput}
                            placeholder="ANGP-XXXX-XXXX-XXXX-XXXX"
                            class="mt-1 font-mono"
                        />
                    </div>
                    <div class="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onclick={() => { showLicenseDialog = false; licenseInput = ''; }}
                        >
                            취소
                        </Button>
                        <Button
                            onclick={installWithLicense}
                            disabled={!licenseInput.trim()}
                        >
                            설치
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>
{/if}
