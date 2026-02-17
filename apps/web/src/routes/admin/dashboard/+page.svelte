<script lang="ts">
    import {
        Card,
        CardContent,
        CardDescription,
        CardHeader,
        CardTitle
    } from '$lib/components/ui/card';
    import { Button } from '$lib/components/ui/button';
    import {
        Palette,
        FileText,
        Users,
        MessageSquare,
        TrendingUp,
        Eye,
        Loader2,
        RefreshCw
    } from '@lucide/svelte/icons';
    import { onMount } from 'svelte';
    import {
        getDashboardStats,
        getRecentActivity,
        type DashboardStats,
        type RecentActivity
    } from '$lib/api/admin-stats';

    let loading = $state(true);
    let error = $state(false);
    let dashboardStats = $state<DashboardStats | null>(null);
    let recentActivities = $state<RecentActivity[]>([]);

    const stats = $derived(
        dashboardStats
            ? [
                    {
                        label: '총 게시글',
                        value: dashboardStats.totalPosts.toLocaleString(),
                        icon: FileText,
                        change: dashboardStats.postsChange
                    },
                    {
                        label: '총 회원',
                        value: dashboardStats.totalMembers.toLocaleString(),
                        icon: Users,
                        change: dashboardStats.membersChange
                    },
                    {
                        label: '오늘 댓글',
                        value: dashboardStats.todayComments.toLocaleString(),
                        icon: MessageSquare,
                        change: dashboardStats.commentsChange
                    },
                    {
                        label: '오늘 방문자',
                        value: dashboardStats.todayVisitors.toLocaleString(),
                        icon: Eye,
                        change: dashboardStats.visitorsChange
                    }
                ]
            : [
                    { label: '총 게시글', value: '-', icon: FileText, change: 0 },
                    { label: '총 회원', value: '-', icon: Users, change: 0 },
                    { label: '오늘 댓글', value: '-', icon: MessageSquare, change: 0 },
                    { label: '오늘 방문자', value: '-', icon: Eye, change: 0 }
                ]
    );

    async function loadDashboard() {
        loading = true;
        error = false;
        try {
            const [statsData, activityData] = await Promise.allSettled([
                getDashboardStats(),
                getRecentActivity()
            ]);
            if (statsData.status === 'fulfilled') {
                dashboardStats = statsData.value;
            }
            if (activityData.status === 'fulfilled') {
                recentActivities = activityData.value;
            }
            if (statsData.status === 'rejected' && activityData.status === 'rejected') {
                error = true;
            }
        } catch {
            error = true;
        } finally {
            loading = false;
        }
    }

    function formatChange(change: number): string {
        if (change > 0) return `+${change}%`;
        if (change < 0) return `${change}%`;
        return '0%';
    }

    function getActivityIcon(type: RecentActivity['type']): string {
        switch (type) {
            case 'post':
                return '📝';
            case 'comment':
                return '💬';
            case 'member':
                return '👤';
            case 'report':
                return '🚨';
        }
    }

    function getActivityLabel(type: RecentActivity['type']): string {
        switch (type) {
            case 'post':
                return '새 게시글';
            case 'comment':
                return '새 댓글';
            case 'member':
                return '신규 회원';
            case 'report':
                return '신고';
        }
    }

    function timeAgo(dateStr: string): string {
        const now = new Date();
        const date = new Date(dateStr);
        const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
        if (diff < 60) return '방금 전';
        if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
        return `${Math.floor(diff / 86400)}일 전`;
    }

    onMount(() => {
        loadDashboard();
    });
</script>

<svelte:head>
    <title>대시보드 - Angple Admin</title>
</svelte:head>

<div class="container mx-auto p-8">
    <div class="mb-8 flex items-center justify-between">
        <div>
            <h1 class="text-4xl font-bold">대시보드</h1>
            <p class="text-muted-foreground mt-2">사이트 현황을 한눈에 확인하세요.</p>
        </div>
        <Button variant="outline" size="sm" onclick={loadDashboard} disabled={loading}>
            {#if loading}
                <Loader2 class="mr-2 h-4 w-4 animate-spin" />
            {:else}
                <RefreshCw class="mr-2 h-4 w-4" />
            {/if}
            새로고침
        </Button>
    </div>

    {#if error && !dashboardStats}
        <Card class="mb-8">
            <CardContent class="py-6 text-center">
                <p class="text-muted-foreground">통계 데이터를 불러올 수 없습니다.</p>
                <p class="text-muted-foreground text-sm">백엔드 API 연결을 확인해 주세요.</p>
                <Button variant="outline" size="sm" class="mt-4" onclick={loadDashboard}>
                    다시 시도
                </Button>
            </CardContent>
        </Card>
    {/if}

    <!-- 통계 카드 -->
    <div class="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {#each stats as stat (stat.label)}
            {@const Icon = stat.icon}
            <Card class={loading && !dashboardStats ? 'animate-pulse' : ''}>
                <CardHeader class="flex flex-row items-center justify-between pb-2">
                    <CardTitle class="text-sm font-medium">{stat.label}</CardTitle>
                    <Icon class="text-muted-foreground h-4 w-4" />
                </CardHeader>
                <CardContent>
                    <div class="text-2xl font-bold">{stat.value}</div>
                    {#if dashboardStats}
                        <p class="text-muted-foreground text-xs">
                            <span class={stat.change >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {formatChange(stat.change)}
                            </span>
                            지난 주 대비
                        </p>
                    {/if}
                </CardContent>
            </Card>
        {/each}
    </div>

    <!-- 빠른 액션 -->
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    <Palette class="h-5 w-5" />
                    테마 관리
                </CardTitle>
                <CardDescription>사이트 테마를 변경하고 커스터마이즈하세요.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button href="/admin/themes" class="w-full">테마 설정</Button>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    <FileText class="h-5 w-5" />
                    게시판 관리
                </CardTitle>
                <CardDescription>게시판을 생성하고 관리하세요.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button href="/admin/boards" class="w-full">게시판 관리</Button>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    <Users class="h-5 w-5" />
                    회원 관리
                </CardTitle>
                <CardDescription>회원 정보를 관리하고 권한을 설정하세요.</CardDescription>
            </CardHeader>
            <CardContent>
                <Button href="/admin/members" class="w-full">회원 관리</Button>
            </CardContent>
        </Card>
    </div>

    <!-- 최근 활동 -->
    <Card class="mt-8">
        <CardHeader>
            <CardTitle class="flex items-center gap-2">
                <TrendingUp class="h-5 w-5" />
                최근 활동
            </CardTitle>
            <CardDescription>사이트의 최근 활동 내역입니다.</CardDescription>
        </CardHeader>
        <CardContent>
            {#if loading && recentActivities.length === 0}
                <div class="space-y-3">
                    {#each Array(5) as _}
                        <div class="bg-muted h-12 animate-pulse rounded-lg"></div>
                    {/each}
                </div>
            {:else if recentActivities.length > 0}
                <div class="space-y-3">
                    {#each recentActivities as activity (activity.id)}
                        <div
                            class="hover:bg-muted/50 flex items-center gap-3 rounded-lg p-3 transition-colors"
                        >
                            <span class="text-lg">{getActivityIcon(activity.type)}</span>
                            <div class="min-w-0 flex-1">
                                <p class="truncate text-sm font-medium">
                                    {activity.title}
                                </p>
                                <p class="text-muted-foreground text-xs">
                                    <span
                                        class="bg-muted inline-block rounded px-1.5 py-0.5 text-xs"
                                    >
                                        {getActivityLabel(activity.type)}
                                    </span>
                                    <span class="ml-1">{activity.author}</span>
                                    {#if activity.boardId}
                                        <span class="ml-1">in {activity.boardId}</span>
                                    {/if}
                                </p>
                            </div>
                            <span class="text-muted-foreground whitespace-nowrap text-xs">
                                {timeAgo(activity.createdAt)}
                            </span>
                        </div>
                    {/each}
                </div>
            {:else}
                <div class="text-muted-foreground py-8 text-center">
                    <p>아직 활동 내역이 없습니다.</p>
                    <p class="text-sm">게시글이나 댓글이 작성되면 여기에 표시됩니다.</p>
                </div>
            {/if}
        </CardContent>
    </Card>
</div>
