<script lang="ts">
    import { goto } from '$app/navigation';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import type { PageData } from './$types.js';
    import Users from '@lucide/svelte/icons/users';
    import User from '@lucide/svelte/icons/user';
    import UserMinus from '@lucide/svelte/icons/user-minus';

    let { data }: { data: PageData } = $props();

    let followingList = $state<typeof data.following>([]);
    let unfollowingId = $state<string | null>(null);

    $effect(() => {
        followingList = data.following || [];
    });

    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    async function handleUnfollow(memberId: string, memberNick: string): Promise<void> {
        if (!confirm(`${memberNick}님의 팔로우를 해제하시겠습니까?`)) return;

        unfollowingId = memberId;
        try {
            await fetch(`/api/members/${memberId}/follow`, { method: 'DELETE' });
            followingList = followingList.filter((m) => m.mb_id !== memberId);
        } catch (err) {
            console.error('팔로우 해제 실패:', err);
            alert('팔로우 해제에 실패했습니다.');
        } finally {
            unfollowingId = null;
        }
    }

    function goToProfile(memberId: string): void {
        goto(`/member/${memberId}`);
    }
</script>

<svelte:head>
    <title>팔로잉 | {import.meta.env.VITE_SITE_NAME || 'Angple'}</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4">
    <div class="mb-6">
        <h1 class="text-foreground flex items-center gap-2 text-2xl font-bold">
            <Users class="h-6 w-6" />
            팔로잉
        </h1>
        <p class="text-secondary-foreground mt-1">팔로잉한 회원의 새 글 알림을 받습니다.</p>
    </div>

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
                    팔로잉 목록
                    <span class="text-muted-foreground text-sm font-normal">
                        ({followingList.length}명)
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {#if followingList.length > 0}
                    <ul class="divide-border divide-y">
                        {#each followingList as member (member.mb_id)}
                            <li class="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                                <div class="flex items-center gap-3">
                                    <div
                                        class="bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-full"
                                    >
                                        <User class="h-5 w-5" />
                                    </div>
                                    <div>
                                        <button
                                            type="button"
                                            onclick={() => goToProfile(member.mb_id)}
                                            class="text-foreground font-medium hover:underline"
                                        >
                                            {member.mb_nick}
                                        </button>
                                        <p class="text-muted-foreground text-xs">
                                            {formatDate(member.followed_at)} 팔로우
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onclick={() => handleUnfollow(member.mb_id, member.mb_nick)}
                                    disabled={unfollowingId === member.mb_id}
                                >
                                    <UserMinus class="mr-1 h-3.5 w-3.5" />
                                    {unfollowingId === member.mb_id ? '해제 중...' : '팔로우 해제'}
                                </Button>
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <div class="py-12 text-center">
                        <Users class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                        <p class="text-foreground mb-2 text-lg font-medium">
                            팔로잉한 회원이 없습니다
                        </p>
                        <p class="text-secondary-foreground">
                            회원 프로필에서 팔로우할 수 있습니다.
                        </p>
                    </div>
                {/if}
            </CardContent>
        </Card>
    {/if}
</div>
