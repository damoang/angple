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
        Eye
    } from '@lucide/svelte/icons';

    /**
     * 관리자 대시보드
     */

    // 임시 통계 데이터 (추후 API에서 가져올 예정)
    const stats = [
        { label: '총 게시글', value: '1,234', icon: FileText, change: '+12%' },
        { label: '총 회원', value: '567', icon: Users, change: '+5%' },
        { label: '오늘 댓글', value: '89', icon: MessageSquare, change: '+23%' },
        { label: '오늘 방문자', value: '2,345', icon: Eye, change: '+8%' }
    ];
</script>

<svelte:head>
    <title>대시보드 - Angple Admin</title>
</svelte:head>

<div class="container mx-auto p-8">
    <div class="mb-8">
        <h1 class="text-4xl font-bold">대시보드</h1>
        <p class="text-muted-foreground mt-2">사이트 현황을 한눈에 확인하세요.</p>
    </div>

    <!-- 통계 카드 -->
    <div class="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {#each stats as stat (stat.label)}
            {@const Icon = stat.icon}
            <Card>
                <CardHeader class="flex flex-row items-center justify-between pb-2">
                    <CardTitle class="text-sm font-medium">{stat.label}</CardTitle>
                    <Icon class="text-muted-foreground h-4 w-4" />
                </CardHeader>
                <CardContent>
                    <div class="text-2xl font-bold">{stat.value}</div>
                    <p class="text-muted-foreground text-xs">
                        <span class="text-green-600">{stat.change}</span> 지난 주 대비
                    </p>
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
                <CardDescription>
                    사이트 테마를 변경하고 커스터마이즈하세요.
                </CardDescription>
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
                <CardDescription>
                    게시판을 생성하고 관리하세요.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button variant="outline" class="w-full" disabled>준비 중</Button>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    <Users class="h-5 w-5" />
                    회원 관리
                </CardTitle>
                <CardDescription>
                    회원 정보를 관리하고 권한을 설정하세요.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Button variant="outline" class="w-full" disabled>준비 중</Button>
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
            <CardDescription>
                사이트의 최근 활동 내역입니다.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div class="text-muted-foreground py-8 text-center">
                <p>아직 활동 내역이 없습니다.</p>
                <p class="text-sm">게시글이나 댓글이 작성되면 여기에 표시됩니다.</p>
            </div>
        </CardContent>
    </Card>
</div>
