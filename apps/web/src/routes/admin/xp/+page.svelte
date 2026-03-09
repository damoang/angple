<script lang="ts">
    /**
     * 관리자 경험치 관리 페이지
     * 회원 XP 목록 + 검색 + XP 이력 조회 + 수동 지급
     */
    import { onMount } from 'svelte';
    import * as Card from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import Search from '@lucide/svelte/icons/search';
    import TrendingUp from '@lucide/svelte/icons/trending-up';
    import ChevronLeft from '@lucide/svelte/icons/chevron-left';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import Plus from '@lucide/svelte/icons/plus';
    import Minus from '@lucide/svelte/icons/minus';
    import History from '@lucide/svelte/icons/history';
    import Settings from '@lucide/svelte/icons/settings';
    import Save from '@lucide/svelte/icons/save';
    import Check from '@lucide/svelte/icons/check';
    import { Switch } from '$lib/components/ui/switch/index.js';
    import {
        listMemberXP,
        getMemberXPHistory,
        grantXP,
        getXPConfig,
        updateXPConfig,
        getPointConfig,
        updatePointConfig,
        type MemberXPInfo,
        type XPHistoryItem,
        type XPSummary,
        type XPConfig,
        type PointConfig
    } from '$lib/api/admin-xp';
    import Clock from '@lucide/svelte/icons/clock';
    import Coins from '@lucide/svelte/icons/coins';

    // 레벨 구간 데이터
    const levelThresholds = [
        0, 1000, 3000, 6000, 10000, 15000, 21000, 28000, 36000, 45000, 55000, 66000, 78000, 91000,
        105000
    ];

    // 설정 상태
    let config = $state<XPConfig>({
        login_xp: 500,
        write_xp: 100,
        comment_xp: 50,
        login_enabled: true,
        write_enabled: false,
        comment_enabled: false
    });
    let configLoading = $state(true);
    let configSaving = $state(false);
    let configSaved = $state(false);

    async function loadConfig() {
        configLoading = true;
        try {
            config = await getXPConfig();
        } catch (error) {
            console.error('XP 설정 로드 실패:', error);
        } finally {
            configLoading = false;
        }
    }

    async function saveConfig() {
        configSaving = true;
        configSaved = false;
        try {
            await updateXPConfig(config);
            configSaved = true;
            setTimeout(() => (configSaved = false), 2000);
        } catch (error) {
            console.error('XP 설정 저장 실패:', error);
            alert('설정 저장에 실패했습니다.');
        } finally {
            configSaving = false;
        }
    }

    // 포인트 설정 상태
    let pointCfg = $state<PointConfig>({
        expiry_enabled: false,
        expiry_days: 180
    });
    let pointConfigLoading = $state(true);
    let pointConfigSaving = $state(false);
    let pointConfigSaved = $state(false);

    async function loadPointConfig() {
        pointConfigLoading = true;
        try {
            pointCfg = await getPointConfig();
        } catch (error) {
            console.error('포인트 설정 로드 실패:', error);
        } finally {
            pointConfigLoading = false;
        }
    }

    async function savePointConfig() {
        pointConfigSaving = true;
        pointConfigSaved = false;
        try {
            await updatePointConfig(pointCfg);
            pointConfigSaved = true;
            setTimeout(() => (pointConfigSaved = false), 2000);
        } catch (error) {
            console.error('포인트 설정 저장 실패:', error);
            alert('설정 저장에 실패했습니다.');
        } finally {
            pointConfigSaving = false;
        }
    }

    // 목록 상태
    let members = $state<MemberXPInfo[]>([]);
    let total = $state(0);
    let totalPages = $state(0);
    let loading = $state(true);
    let currentPage = $state(1);
    const pageSize = 20;

    // 검색
    let searchQuery = $state('');

    // 상세 다이얼로그 상태
    let detailOpen = $state(false);
    let selectedMember = $state<MemberXPInfo | null>(null);
    let historyItems = $state<XPHistoryItem[]>([]);
    let historySummary = $state<XPSummary | null>(null);
    let historyTotal = $state(0);
    let historyPage = $state(1);
    let historyTotalPages = $state(0);
    let historyLoading = $state(false);

    // 수동 지급 폼
    let grantPoint = $state(500);
    let grantContent = $state('');
    let granting = $state(false);

    async function loadMembers() {
        loading = true;
        try {
            const result = await listMemberXP({
                page: currentPage,
                limit: pageSize,
                search: searchQuery || undefined
            });
            members = result.members ?? [];
            total = result.pagination.total;
            totalPages = result.pagination.total_pages;
        } catch (error) {
            console.error('회원 XP 목록 조회 실패:', error);
            members = [];
        } finally {
            loading = false;
        }
    }

    async function handleSearch() {
        currentPage = 1;
        await loadMembers();
    }

    async function goToPage(page: number) {
        currentPage = page;
        await loadMembers();
    }

    async function openDetail(member: MemberXPInfo) {
        selectedMember = member;
        historyPage = 1;
        grantPoint = 500;
        grantContent = '';
        detailOpen = true;
        await loadHistory(member.mb_id, 1);
    }

    async function loadHistory(mbId: string, page: number) {
        historyLoading = true;
        try {
            const result = await getMemberXPHistory(mbId, page);
            historyItems = result.items ?? [];
            historySummary = result.summary;
            historyTotal = result.pagination.total;
            historyTotalPages = result.pagination.total_pages;
            historyPage = page;
        } catch (error) {
            console.error('XP 이력 조회 실패:', error);
            historyItems = [];
        } finally {
            historyLoading = false;
        }
    }

    async function handleGrant() {
        if (!selectedMember || !grantContent.trim() || grantPoint === 0) return;
        granting = true;
        try {
            await grantXP(selectedMember.mb_id, grantPoint, grantContent.trim());
            // 이력 새로고침
            await loadHistory(selectedMember.mb_id, 1);
            // 목록도 새로고침
            await loadMembers();
            // 선택된 멤버 정보 업데이트
            const updated = members.find((m) => m.mb_id === selectedMember!.mb_id);
            if (updated) selectedMember = updated;
            grantContent = '';
            grantPoint = 500;
        } catch (error) {
            console.error('XP 지급 실패:', error);
            alert('경험치 지급에 실패했습니다.');
        } finally {
            granting = false;
        }
    }

    function formatNumber(n: number): string {
        return n.toLocaleString('ko-KR');
    }

    function getPageNumbers(current: number, totalPg: number): number[] {
        const pages: number[] = [];
        let start = Math.max(1, current - 2);
        const end = Math.min(totalPg, start + 4);
        start = Math.max(1, end - 4);
        for (let i = start; i <= end; i++) pages.push(i);
        return pages;
    }

    onMount(() => {
        loadConfig();
        loadPointConfig();
        loadMembers();
    });
</script>

<svelte:head>
    <title>경험치 관리 - Admin</title>
</svelte:head>

<div class="space-y-6">
    <!-- 헤더 -->
    <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
            <TrendingUp class="h-8 w-8" />
            <div>
                <h1 class="text-2xl font-bold">경험치 관리</h1>
                <p class="text-muted-foreground text-sm">회원 경험치 조회 및 수동 지급</p>
            </div>
        </div>
    </div>

    <!-- 경험치 설정 -->
    <Card.Root>
        <Card.Header class="pb-3">
            <Card.Title class="flex items-center gap-2 text-base">
                <Settings class="h-4 w-4" />
                경험치 설정
            </Card.Title>
        </Card.Header>
        <Card.Content>
            {#if configLoading}
                <div class="flex items-center gap-2 py-2">
                    <Loader2 class="text-muted-foreground h-4 w-4 animate-spin" />
                    <span class="text-muted-foreground text-sm">설정 로드 중...</span>
                </div>
            {:else}
                <div class="space-y-5">
                    <!-- 로그인 보상 -->
                    <div class="flex items-center justify-between gap-4">
                        <div class="flex-1">
                            <div class="flex items-center gap-2">
                                <Label for="config-login-xp" class="font-medium">로그인 보상</Label>
                                <Switch
                                    checked={config.login_enabled}
                                    onCheckedChange={(v) => (config.login_enabled = v)}
                                />
                            </div>
                            <p class="text-muted-foreground mt-0.5 text-xs">
                                매일 첫 로그인 시 지급
                            </p>
                        </div>
                        <div class="flex items-center gap-2">
                            <Input
                                id="config-login-xp"
                                type="number"
                                min="0"
                                step="100"
                                class="w-24 text-right"
                                bind:value={config.login_xp}
                                disabled={!config.login_enabled}
                            />
                            <span class="text-muted-foreground w-6 text-sm">XP</span>
                        </div>
                    </div>

                    <!-- 글쓰기 보상 -->
                    <div class="flex items-center justify-between gap-4">
                        <div class="flex-1">
                            <div class="flex items-center gap-2">
                                <Label for="config-write-xp" class="font-medium">글쓰기 보상</Label>
                                <Switch
                                    checked={config.write_enabled}
                                    onCheckedChange={(v) => (config.write_enabled = v)}
                                />
                            </div>
                            <p class="text-muted-foreground mt-0.5 text-xs">게시글 작성 시 지급</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <Input
                                id="config-write-xp"
                                type="number"
                                min="0"
                                step="50"
                                class="w-24 text-right"
                                bind:value={config.write_xp}
                                disabled={!config.write_enabled}
                            />
                            <span class="text-muted-foreground w-6 text-sm">XP</span>
                        </div>
                    </div>

                    <!-- 댓글 보상 -->
                    <div class="flex items-center justify-between gap-4">
                        <div class="flex-1">
                            <div class="flex items-center gap-2">
                                <Label for="config-comment-xp" class="font-medium">댓글 보상</Label>
                                <Switch
                                    checked={config.comment_enabled}
                                    onCheckedChange={(v) => (config.comment_enabled = v)}
                                />
                            </div>
                            <p class="text-muted-foreground mt-0.5 text-xs">
                                댓글 작성 시 지급 (30일 이내 글만)
                            </p>
                        </div>
                        <div class="flex items-center gap-2">
                            <Input
                                id="config-comment-xp"
                                type="number"
                                min="0"
                                step="10"
                                class="w-24 text-right"
                                bind:value={config.comment_xp}
                                disabled={!config.comment_enabled}
                            />
                            <span class="text-muted-foreground w-6 text-sm">XP</span>
                        </div>
                    </div>

                    <!-- 레벨 구간 참고 -->
                    <div class="bg-muted/50 rounded-lg p-3">
                        <p class="text-muted-foreground mb-1.5 text-xs font-medium">
                            레벨 구간 (읽기 전용)
                        </p>
                        <div class="flex flex-wrap gap-x-3 gap-y-1">
                            {#each levelThresholds as threshold, i}
                                <span class="text-muted-foreground text-xs tabular-nums">
                                    Lv.{i + 1}: {formatNumber(threshold)}
                                </span>
                            {/each}
                        </div>
                    </div>

                    <!-- 저장 버튼 -->
                    <div class="flex justify-end">
                        <Button size="sm" onclick={saveConfig} disabled={configSaving}>
                            {#if configSaved}
                                <Check class="mr-2 h-4 w-4" />
                                저장됨
                            {:else if configSaving}
                                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                                저장 중...
                            {:else}
                                <Save class="mr-2 h-4 w-4" />
                                저장
                            {/if}
                        </Button>
                    </div>
                </div>
            {/if}
        </Card.Content>
    </Card.Root>

    <!-- 포인트 유효기간 설정 -->
    <Card.Root>
        <Card.Header class="pb-3">
            <Card.Title class="flex items-center gap-2 text-base">
                <Coins class="h-4 w-4" />
                포인트 설정
            </Card.Title>
        </Card.Header>
        <Card.Content>
            {#if pointConfigLoading}
                <div class="flex items-center gap-2 py-2">
                    <Loader2 class="text-muted-foreground h-4 w-4 animate-spin" />
                    <span class="text-muted-foreground text-sm">설정 로드 중...</span>
                </div>
            {:else}
                <div class="space-y-5">
                    <!-- 포인트 유효기간 -->
                    <div class="flex items-center justify-between gap-4">
                        <div class="flex-1">
                            <div class="flex items-center gap-2">
                                <Label for="point-expiry-days" class="font-medium">
                                    <Clock class="mr-1 inline h-3.5 w-3.5" />
                                    포인트 유효기간
                                </Label>
                                <Switch
                                    checked={pointCfg.expiry_enabled}
                                    onCheckedChange={(v) => (pointCfg.expiry_enabled = v)}
                                />
                            </div>
                            <p class="text-muted-foreground mt-0.5 text-xs">
                                활성화 시 새로 지급되는 포인트부터 유효기간이 적용됩니다
                            </p>
                        </div>
                        <div class="flex items-center gap-2">
                            <Input
                                id="point-expiry-days"
                                type="number"
                                min="1"
                                max="3650"
                                step="1"
                                class="w-24 text-right"
                                bind:value={pointCfg.expiry_days}
                                disabled={!pointCfg.expiry_enabled}
                            />
                            <span class="text-muted-foreground w-6 text-sm">일</span>
                        </div>
                    </div>

                    {#if pointCfg.expiry_enabled}
                        <div class="bg-muted/50 rounded-lg p-3">
                            <p class="text-muted-foreground text-xs">
                                만료 크론이 매일 새벽에 실행되어 만료된 포인트를 자동 차감합니다.
                                만료 7일 전 알림이 발송됩니다.
                            </p>
                        </div>
                    {/if}

                    <!-- 저장 버튼 -->
                    <div class="flex justify-end">
                        <Button size="sm" onclick={savePointConfig} disabled={pointConfigSaving}>
                            {#if pointConfigSaved}
                                <Check class="mr-2 h-4 w-4" />
                                저장됨
                            {:else if pointConfigSaving}
                                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                                저장 중...
                            {:else}
                                <Save class="mr-2 h-4 w-4" />
                                저장
                            {/if}
                        </Button>
                    </div>
                </div>
            {/if}
        </Card.Content>
    </Card.Root>

    <!-- 검색 -->
    <Card.Root>
        <Card.Content class="pt-6">
            <form
                class="flex items-end gap-3"
                onsubmit={(e) => {
                    e.preventDefault();
                    handleSearch();
                }}
            >
                <div class="flex-1">
                    <Label for="search">회원 검색</Label>
                    <div class="relative mt-1">
                        <Search
                            class="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                        />
                        <Input
                            id="search"
                            type="text"
                            placeholder="회원 ID 또는 닉네임"
                            class="pl-10"
                            bind:value={searchQuery}
                        />
                    </div>
                </div>
                <Button type="submit">
                    <Search class="mr-2 h-4 w-4" />
                    검색
                </Button>
            </form>
        </Card.Content>
    </Card.Root>

    <!-- 테이블 -->
    <Card.Root>
        <Card.Content class="pt-6">
            {#if loading}
                <div class="flex items-center justify-center py-12">
                    <Loader2 class="text-muted-foreground h-8 w-8 animate-spin" />
                </div>
            {:else if members.length === 0}
                <div class="text-muted-foreground py-12 text-center">
                    {searchQuery ? '검색 결과가 없습니다.' : '회원이 없습니다.'}
                </div>
            {:else}
                <div class="overflow-x-auto">
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-border border-b">
                                <th class="px-4 py-3 text-left font-medium">회원 ID</th>
                                <th class="px-4 py-3 text-left font-medium">닉네임</th>
                                <th class="px-4 py-3 text-right font-medium">경험치</th>
                                <th class="px-4 py-3 text-center font-medium">XP 레벨</th>
                                <th class="px-4 py-3 text-center font-medium">권한 레벨</th>
                                <th class="px-4 py-3 text-center font-medium">관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each members as member (member.mb_id)}
                                <tr
                                    class="border-border hover:bg-muted/50 cursor-pointer border-b transition-colors"
                                    onclick={() => openDetail(member)}
                                >
                                    <td class="px-4 py-3 font-mono text-xs">{member.mb_id}</td>
                                    <td class="px-4 py-3">{member.mb_nick}</td>
                                    <td class="px-4 py-3 text-right font-medium tabular-nums">
                                        {formatNumber(member.as_exp)} XP
                                    </td>
                                    <td class="px-4 py-3 text-center">
                                        <Badge variant="secondary">Lv.{member.as_level}</Badge>
                                    </td>
                                    <td class="px-4 py-3 text-center">
                                        {#if member.mb_level >= 10}
                                            <Badge variant="destructive">관리자</Badge>
                                        {:else}
                                            <Badge variant="outline">Lv.{member.mb_level}</Badge>
                                        {/if}
                                    </td>
                                    <td class="px-4 py-3 text-center">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onclick={(e: MouseEvent) => {
                                                e.stopPropagation();
                                                openDetail(member);
                                            }}
                                        >
                                            <History class="h-4 w-4" />
                                        </Button>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

                <!-- 페이지네이션 -->
                <div class="mt-4 flex items-center justify-between">
                    <p class="text-muted-foreground text-sm">
                        {(currentPage - 1) * pageSize + 1}~{Math.min(currentPage * pageSize, total)}
                        / {formatNumber(total)}명
                    </p>
                    <div class="flex items-center gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage <= 1}
                            onclick={() => goToPage(currentPage - 1)}
                        >
                            <ChevronLeft class="h-4 w-4" />
                        </Button>
                        {#each getPageNumbers(currentPage, totalPages) as pg (pg)}
                            <Button
                                variant={pg === currentPage ? 'default' : 'outline'}
                                size="sm"
                                onclick={() => goToPage(pg)}
                            >
                                {pg}
                            </Button>
                        {/each}
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={currentPage >= totalPages}
                            onclick={() => goToPage(currentPage + 1)}
                        >
                            <ChevronRight class="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            {/if}
        </Card.Content>
    </Card.Root>
</div>

<!-- 상세 다이얼로그 -->
<Dialog.Root bind:open={detailOpen}>
    <Dialog.Content class="max-w-2xl">
        <Dialog.Header>
            <Dialog.Title>
                {#if selectedMember}
                    {selectedMember.mb_nick} ({selectedMember.mb_id})
                {/if}
            </Dialog.Title>
            <Dialog.Description>경험치 이력 조회 및 수동 지급</Dialog.Description>
        </Dialog.Header>

        {#if selectedMember}
            <!-- 요약 -->
            {#if historySummary}
                <div class="grid grid-cols-3 gap-4">
                    <div class="bg-muted rounded-lg p-3 text-center">
                        <p class="text-muted-foreground text-xs">총 경험치</p>
                        <p class="text-lg font-bold">{formatNumber(historySummary.total_exp)}</p>
                    </div>
                    <div class="bg-muted rounded-lg p-3 text-center">
                        <p class="text-muted-foreground text-xs">현재 레벨</p>
                        <p class="text-lg font-bold">Lv.{historySummary.current_level}</p>
                    </div>
                    <div class="bg-muted rounded-lg p-3 text-center">
                        <p class="text-muted-foreground text-xs">다음 레벨까지</p>
                        <p class="text-lg font-bold">{formatNumber(historySummary.exp_to_next)}</p>
                    </div>
                </div>
            {/if}

            <!-- 수동 지급 폼 -->
            <div class="border-border space-y-3 rounded-lg border p-4">
                <h3 class="text-sm font-semibold">수동 경험치 지급</h3>
                <div class="flex gap-3">
                    <div class="w-32">
                        <Label for="grant-point">경험치</Label>
                        <Input
                            id="grant-point"
                            type="number"
                            bind:value={grantPoint}
                            class="mt-1"
                        />
                    </div>
                    <div class="flex-1">
                        <Label for="grant-content">사유</Label>
                        <Input
                            id="grant-content"
                            type="text"
                            placeholder="지급/차감 사유를 입력하세요"
                            bind:value={grantContent}
                            class="mt-1"
                        />
                    </div>
                </div>
                <div class="flex gap-2">
                    <Button
                        size="sm"
                        onclick={handleGrant}
                        disabled={granting || !grantContent.trim() || grantPoint === 0}
                    >
                        {#if granting}
                            <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                        {:else if grantPoint > 0}
                            <Plus class="mr-2 h-4 w-4" />
                        {:else}
                            <Minus class="mr-2 h-4 w-4" />
                        {/if}
                        {grantPoint > 0 ? '지급' : '차감'}
                        ({grantPoint > 0 ? '+' : ''}{formatNumber(grantPoint)} XP)
                    </Button>
                </div>
            </div>

            <!-- 이력 목록 -->
            <div class="max-h-64 space-y-1 overflow-y-auto">
                <h3 class="text-sm font-semibold">경험치 이력</h3>
                {#if historyLoading}
                    <div class="flex justify-center py-4">
                        <Loader2 class="text-muted-foreground h-6 w-6 animate-spin" />
                    </div>
                {:else if historyItems.length === 0}
                    <p class="text-muted-foreground py-4 text-center text-sm">이력이 없습니다.</p>
                {:else}
                    <table class="w-full text-sm">
                        <thead>
                            <tr class="border-border border-b">
                                <th class="px-2 py-1.5 text-left text-xs font-medium">일시</th>
                                <th class="px-2 py-1.5 text-left text-xs font-medium">내용</th>
                                <th class="px-2 py-1.5 text-right text-xs font-medium">경험치</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each historyItems as item (item.id)}
                                <tr class="border-border border-b">
                                    <td class="text-muted-foreground px-2 py-1.5 text-xs">
                                        {item.datetime?.slice(0, 16).replace('T', ' ') ?? '-'}
                                    </td>
                                    <td class="px-2 py-1.5 text-xs">{item.content}</td>
                                    <td class="px-2 py-1.5 text-right text-xs font-medium">
                                        <span
                                            class={item.point > 0
                                                ? 'text-green-600'
                                                : 'text-red-600'}
                                        >
                                            {item.point > 0 ? '+' : ''}{formatNumber(item.point)}
                                        </span>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>

                    <!-- 이력 페이지네이션 -->
                    {#if historyTotalPages > 1}
                        <div class="flex justify-center gap-1 pt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={historyPage <= 1}
                                onclick={() => loadHistory(selectedMember!.mb_id, historyPage - 1)}
                            >
                                <ChevronLeft class="h-3 w-3" />
                            </Button>
                            <span class="text-muted-foreground px-2 text-xs leading-8">
                                {historyPage} / {historyTotalPages}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={historyPage >= historyTotalPages}
                                onclick={() => loadHistory(selectedMember!.mb_id, historyPage + 1)}
                            >
                                <ChevronRight class="h-3 w-3" />
                            </Button>
                        </div>
                    {/if}
                {/if}
            </div>
        {/if}
    </Dialog.Content>
</Dialog.Root>
