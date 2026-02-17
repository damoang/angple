<script lang="ts">
    import {
        Card,
        CardContent,
        CardHeader,
        CardTitle,
        CardDescription
    } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import KeyRound from '@lucide/svelte/icons/key-round';
    import Search from '@lucide/svelte/icons/search';
    import Ban from '@lucide/svelte/icons/ban';
    import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
    import Globe from '@lucide/svelte/icons/globe';
    import Copy from '@lucide/svelte/icons/copy';
    import {
        getLicenseStatusLabel,
        getLicenseStatusColor,
        LICENSE_TIER_META,
        type LicenseKey,
        type LicenseStatus
    } from '$lib/types/license.js';
    import { toast } from 'svelte-sonner';

    // 상태
    let licenses = $state<LicenseKey[]>([]);
    let searchQuery = $state('');
    let filterStatus = $state<LicenseStatus | ''>('');
    let isLoading = $state(false);
    let totalCount = $state(0);
    let currentPage = $state(1);

    // 필터된 목록
    let filteredLicenses = $derived(
        licenses.filter((l) => {
            const matchSearch =
                !searchQuery ||
                l.key.includes(searchQuery.toUpperCase()) ||
                l.userEmail.includes(searchQuery) ||
                l.productName.includes(searchQuery);
            const matchStatus = !filterStatus || l.status === filterStatus;
            return matchSearch && matchStatus;
        })
    );

    // 상태별 뱃지 variant
    function getStatusVariant(
        status: LicenseStatus
    ): 'default' | 'secondary' | 'destructive' | 'outline' {
        switch (status) {
            case 'active':
                return 'default';
            case 'expired':
                return 'secondary';
            case 'revoked':
            case 'suspended':
                return 'destructive';
            default:
                return 'outline';
        }
    }

    function copyKey(key: string) {
        navigator.clipboard.writeText(key);
        toast.success('라이선스 키가 복사되었습니다.');
    }

    function getTierName(tier: string): string {
        return LICENSE_TIER_META.find((t) => t.id === tier)?.name || tier;
    }
</script>

<svelte:head>
    <title>라이선스 관리 - Commerce</title>
</svelte:head>

<div>
    <div class="mb-8 flex items-center justify-between">
        <div>
            <h1 class="text-foreground mb-2 text-3xl font-bold">라이선스 관리</h1>
            <p class="text-muted-foreground">프리미엄 플러그인/테마 라이선스 키를 관리합니다.</p>
        </div>
        <div class="text-muted-foreground text-sm">
            총 {totalCount}개
        </div>
    </div>

    <!-- 검색/필터 바 -->
    <div class="mb-6 flex gap-3">
        <div class="relative flex-1">
            <Search class="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
                class="pl-9"
                placeholder="라이선스 키, 이메일, 상품명으로 검색..."
                bind:value={searchQuery}
            />
        </div>
        <select
            class="border-input bg-background rounded-md border px-3 py-2 text-sm"
            bind:value={filterStatus}
        >
            <option value="">전체 상태</option>
            <option value="active">활성</option>
            <option value="expired">만료</option>
            <option value="revoked">해지</option>
            <option value="suspended">정지</option>
        </select>
    </div>

    <!-- 통계 카드 -->
    <div class="mb-6 grid grid-cols-4 gap-4">
        <Card>
            <CardContent class="pt-4">
                <div class="text-muted-foreground text-sm">전체</div>
                <div class="text-2xl font-bold">{licenses.length}</div>
            </CardContent>
        </Card>
        <Card>
            <CardContent class="pt-4">
                <div class="text-sm text-green-600">활성</div>
                <div class="text-2xl font-bold">{licenses.filter((l) => l.status === 'active').length}</div>
            </CardContent>
        </Card>
        <Card>
            <CardContent class="pt-4">
                <div class="text-sm text-amber-600">만료</div>
                <div class="text-2xl font-bold">{licenses.filter((l) => l.status === 'expired').length}</div>
            </CardContent>
        </Card>
        <Card>
            <CardContent class="pt-4">
                <div class="text-sm text-red-600">해지/정지</div>
                <div class="text-2xl font-bold">
                    {licenses.filter((l) => l.status === 'revoked' || l.status === 'suspended').length}
                </div>
            </CardContent>
        </Card>
    </div>

    <!-- 라이선스 목록 -->
    {#if isLoading}
        <div class="text-muted-foreground flex justify-center py-16">로딩 중...</div>
    {:else if filteredLicenses.length === 0}
        <Card>
            <CardContent class="py-16 text-center">
                <KeyRound class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <p class="text-muted-foreground">
                    {searchQuery || filterStatus ? '검색 결과가 없습니다.' : '등록된 라이선스가 없습니다.'}
                </p>
            </CardContent>
        </Card>
    {:else}
        <div class="space-y-3">
            {#each filteredLicenses as license}
                <Card>
                    <CardContent class="p-4">
                        <div class="flex items-start justify-between">
                            <div class="space-y-2">
                                <!-- 키 + 복사 -->
                                <div class="flex items-center gap-2">
                                    <code class="bg-muted rounded px-2 py-1 text-sm font-mono">
                                        {license.key}
                                    </code>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onclick={() => copyKey(license.key)}
                                    >
                                        <Copy class="h-3 w-3" />
                                    </Button>
                                    <Badge variant={getStatusVariant(license.status)}>
                                        {getLicenseStatusLabel(license.status)}
                                    </Badge>
                                    <Badge variant="outline">{getTierName(license.tier)}</Badge>
                                </div>

                                <!-- 상품/사용자 정보 -->
                                <div class="text-muted-foreground flex gap-4 text-sm">
                                    <span>{license.productName}</span>
                                    <span>{license.userEmail}</span>
                                    <span>
                                        만료: {new Date(license.expiresAt).toLocaleDateString('ko-KR')}
                                    </span>
                                </div>

                                <!-- 활성 도메인 -->
                                {#if license.activatedDomains.length > 0}
                                    <div class="flex flex-wrap gap-1">
                                        {#each license.activatedDomains as domain}
                                            <Badge variant="secondary" class="gap-1">
                                                <Globe class="h-3 w-3" />
                                                {domain}
                                            </Badge>
                                        {/each}
                                        <span class="text-muted-foreground text-xs leading-6">
                                            {license.activatedDomains.length}/{license.maxDomains === -1 ? '∞' : license.maxDomains}
                                        </span>
                                    </div>
                                {/if}
                            </div>

                            <!-- 액션 버튼 -->
                            <div class="flex gap-1">
                                {#if license.status === 'active'}
                                    <Button variant="outline" size="sm" class="gap-1">
                                        <Ban class="h-3 w-3" />
                                        정지
                                    </Button>
                                {:else if license.status === 'suspended'}
                                    <Button variant="outline" size="sm" class="gap-1">
                                        <RotateCcw class="h-3 w-3" />
                                        재활성화
                                    </Button>
                                {/if}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            {/each}
        </div>
    {/if}
</div>
