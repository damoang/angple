<script lang="ts">
    import { goto } from '$app/navigation';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import type { PageData } from './$types.js';
    import type { BlockedMember } from '$lib/api/types.js';
    import { apiClient } from '$lib/api/index.js';
    import Ban from '@lucide/svelte/icons/ban';
    import UserX from '@lucide/svelte/icons/user-x';
    import ArrowLeft from '@lucide/svelte/icons/arrow-left';

    let { data }: { data: PageData } = $props();

    // 로컬 차단 목록 상태 (차단 해제시 반응형 업데이트)
    let blockedMembers = $state<BlockedMember[]>([]);

    $effect(() => {
        blockedMembers = data.blockedMembers || [];
    });
    let unblockingId = $state<string | null>(null);

    // 날짜 포맷
    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // 차단 해제
    async function handleUnblock(memberId: string): Promise<void> {
        if (!confirm('이 회원의 차단을 해제하시겠습니까?')) return;

        unblockingId = memberId;
        try {
            await apiClient.unblockMember(memberId);
            blockedMembers = blockedMembers.filter((m) => m.mb_id !== memberId);
        } catch (err) {
            console.error('차단 해제 실패:', err);
            alert('차단 해제에 실패했습니다.');
        } finally {
            unblockingId = null;
        }
    }

    // 회원 프로필로 이동
    function goToProfile(memberId: string): void {
        goto(`/member/${memberId}`);
    }
</script>

<svelte:head>
    <title>차단 목록 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="mx-auto max-w-2xl pt-4">
    <!-- 헤더 -->
    <div class="mb-6">
        <Button variant="ghost" size="sm" onclick={() => goto('/my')} class="mb-4">
            <ArrowLeft class="mr-1 h-4 w-4" />
            마이페이지로
        </Button>
        <h1 class="text-foreground flex items-center gap-2 text-2xl font-bold">
            <Ban class="h-6 w-6" />
            차단 목록
        </h1>
        <p class="text-secondary-foreground mt-1">차단한 회원의 글과 댓글이 숨겨집니다.</p>
    </div>

    <!-- 에러 메시지 -->
    {#if data.error}
        <Card class="border-destructive">
            <CardContent class="pt-6">
                <p class="text-destructive text-center">{data.error}</p>
            </CardContent>
        </Card>
    {:else}
        <Card class="bg-background">
            <CardHeader>
                <CardTitle class="text-lg">
                    차단된 회원
                    <span class="text-muted-foreground text-sm font-normal">
                        ({blockedMembers.length}명)
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {#if blockedMembers.length > 0}
                    <ul class="divide-border divide-y">
                        {#each blockedMembers as member (member.mb_id)}
                            <li class="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                                <div class="flex items-center gap-3">
                                    <!-- 아바타 -->
                                    <div
                                        class="bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-full"
                                    >
                                        <UserX class="h-5 w-5" />
                                    </div>
                                    <div>
                                        <button
                                            type="button"
                                            onclick={() => goToProfile(member.mb_id)}
                                            class="text-foreground font-medium hover:underline"
                                        >
                                            {member.mb_name}
                                        </button>
                                        <p class="text-muted-foreground text-xs">
                                            {formatDate(member.blocked_at)} 차단
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onclick={() => handleUnblock(member.mb_id)}
                                    disabled={unblockingId === member.mb_id}
                                >
                                    {unblockingId === member.mb_id ? '해제 중...' : '차단 해제'}
                                </Button>
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <div class="py-12 text-center">
                        <Ban class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                        <p class="text-foreground mb-2 text-lg font-medium">
                            차단한 회원이 없습니다
                        </p>
                        <p class="text-secondary-foreground">회원 프로필에서 차단할 수 있습니다.</p>
                    </div>
                {/if}
            </CardContent>
        </Card>
    {/if}
</div>
