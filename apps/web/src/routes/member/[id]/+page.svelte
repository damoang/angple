<script lang="ts">
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import type { PageData } from './$types.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { apiClient } from '$lib/api/index.js';
    import User from '@lucide/svelte/icons/user';
    import Calendar from '@lucide/svelte/icons/calendar';
    import Clock from '@lucide/svelte/icons/clock';
    import FileText from '@lucide/svelte/icons/file-text';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import Ban from '@lucide/svelte/icons/ban';
    import Link from '@lucide/svelte/icons/link';

    let { data }: { data: PageData } = $props();

    // 차단 상태
    let isBlocking = $state(false);
    let isBlocked = $state(false);

    // 날짜 포맷
    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // 상대 시간 포맷 (최근 활동용)
    function formatRelativeTime(dateString?: string): string {
        if (!dateString) return '정보 없음';

        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 30) {
            return formatDate(dateString);
        } else if (days > 0) {
            return `${days}일 전`;
        } else if (hours > 0) {
            return `${hours}시간 전`;
        } else if (minutes > 0) {
            return `${minutes}분 전`;
        } else {
            return '방금 전';
        }
    }

    // 레벨에 따른 배지 색상
    function getLevelVariant(level: number): 'default' | 'secondary' | 'destructive' | 'outline' {
        if (level >= 10) return 'destructive'; // 관리자
        if (level >= 5) return 'default'; // 고급 회원
        return 'secondary'; // 일반 회원
    }

    // 레벨명
    function getLevelName(level: number): string {
        if (level >= 10) return '관리자';
        if (level >= 7) return 'VIP';
        if (level >= 5) return '우수회원';
        if (level >= 3) return '정회원';
        return '준회원';
    }

    // 본인 프로필인지 확인
    const isOwnProfile = $derived(authStore.user?.mb_id === data.profile?.mb_id);

    // 차단하기
    async function handleBlock(): Promise<void> {
        if (!data.profile || !authStore.isAuthenticated) return;

        isBlocking = true;
        try {
            if (isBlocked) {
                await apiClient.unblockMember(data.profile.mb_id);
                isBlocked = false;
            } else {
                await apiClient.blockMember(data.profile.mb_id);
                isBlocked = true;
            }
        } catch (err) {
            console.error('차단 처리 실패:', err);
            alert('차단 처리에 실패했습니다.');
        } finally {
            isBlocking = false;
        }
    }
</script>

<svelte:head>
    <title>{data.profile?.mb_name || '회원'} 프로필 | 다모앙</title>
</svelte:head>

<div class="mx-auto max-w-2xl pt-4">
    {#if data.error}
        <Card class="border-destructive">
            <CardContent class="pt-6">
                <p class="text-destructive text-center">{data.error}</p>
            </CardContent>
        </Card>
    {:else if data.profile}
        <!-- 프로필 카드 -->
        <Card class="bg-background mb-6">
            <CardHeader>
                <div class="flex items-start gap-6">
                    <!-- 프로필 이미지 -->
                    <div class="shrink-0">
                        {#if data.profile.mb_image}
                            <img
                                src={data.profile.mb_image}
                                alt={data.profile.mb_name}
                                class="h-24 w-24 rounded-full object-cover ring-4 ring-primary/10"
                            />
                        {:else}
                            <div
                                class="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground ring-4 ring-primary/10"
                            >
                                <User class="h-12 w-12" />
                            </div>
                        {/if}
                    </div>

                    <!-- 프로필 정보 -->
                    <div class="flex-1">
                        <div class="flex items-center gap-3 mb-2">
                            <CardTitle class="text-2xl">{data.profile.mb_name}</CardTitle>
                            <Badge variant={getLevelVariant(data.profile.mb_level)}>
                                Lv.{data.profile.mb_level} {getLevelName(data.profile.mb_level)}
                            </Badge>
                        </div>

                        {#if data.profile.mb_signature}
                            <p class="text-secondary-foreground mb-4">{data.profile.mb_signature}</p>
                        {/if}

                        <!-- 통계 -->
                        <div class="flex flex-wrap gap-4 text-sm">
                            <div class="flex items-center gap-1.5 text-muted-foreground">
                                <FileText class="h-4 w-4" />
                                <span>글 {data.profile.post_count.toLocaleString()}개</span>
                            </div>
                            <div class="flex items-center gap-1.5 text-muted-foreground">
                                <MessageSquare class="h-4 w-4" />
                                <span>댓글 {data.profile.comment_count.toLocaleString()}개</span>
                            </div>
                        </div>
                    </div>

                    <!-- 액션 버튼 -->
                    {#if authStore.isAuthenticated && !isOwnProfile}
                        <div class="shrink-0">
                            <Button
                                variant={isBlocked ? 'outline' : 'destructive'}
                                size="sm"
                                onclick={handleBlock}
                                disabled={isBlocking}
                            >
                                <Ban class="mr-1 h-4 w-4" />
                                {isBlocked ? '차단 해제' : '차단'}
                            </Button>
                        </div>
                    {/if}
                </div>
            </CardHeader>

            <CardContent>
                <div class="grid gap-4 border-t border-border pt-4">
                    <!-- 가입일 -->
                    <div class="flex items-center gap-3">
                        <Calendar class="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p class="text-sm font-medium text-foreground">가입일</p>
                            <p class="text-sm text-secondary-foreground">
                                {formatDate(data.profile.mb_datetime)}
                            </p>
                        </div>
                    </div>

                    <!-- 최근 활동 -->
                    <div class="flex items-center gap-3">
                        <Clock class="h-5 w-5 text-muted-foreground" />
                        <div>
                            <p class="text-sm font-medium text-foreground">최근 활동</p>
                            <p class="text-sm text-secondary-foreground">
                                {formatRelativeTime(data.profile.mb_today_login)}
                            </p>
                        </div>
                    </div>

                    <!-- 홈페이지 -->
                    {#if data.profile.mb_homepage}
                        <div class="flex items-center gap-3">
                            <Link class="h-5 w-5 text-muted-foreground" />
                            <div>
                                <p class="text-sm font-medium text-foreground">홈페이지</p>
                                <a
                                    href={data.profile.mb_homepage}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="text-sm text-primary hover:underline"
                                >
                                    {data.profile.mb_homepage}
                                </a>
                            </div>
                        </div>
                    {/if}
                </div>
            </CardContent>
        </Card>

        <!-- 추가 정보 또는 최근 활동 (향후 확장) -->
        <Card class="bg-background">
            <CardHeader>
                <CardTitle class="text-lg">최근 활동</CardTitle>
            </CardHeader>
            <CardContent>
                <p class="text-center text-muted-foreground py-8">
                    회원의 최근 활동 내역이 여기에 표시됩니다.
                </p>
            </CardContent>
        </Card>
    {:else}
        <Card class="bg-background">
            <CardContent class="py-12 text-center">
                <User class="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
                <p class="text-lg font-medium text-foreground mb-2">회원을 찾을 수 없습니다</p>
                <p class="text-secondary-foreground">
                    요청하신 회원 정보가 존재하지 않습니다.
                </p>
            </CardContent>
        </Card>
    {/if}
</div>
