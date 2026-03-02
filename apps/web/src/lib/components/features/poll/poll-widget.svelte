<script lang="ts">
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { apiClient } from '$lib/api/index.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
    import Check from '@lucide/svelte/icons/check';

    interface PollOption {
        index: number;
        text: string;
        count: number;
    }

    interface Poll {
        id: number;
        subject: string;
        options: PollOption[];
        total_vote: number;
        level: number;
        is_active: boolean;
        has_voted: boolean;
    }

    let poll = $state<Poll | null>(null);
    let selectedOption = $state<number | null>(null);
    let isVoting = $state(false);
    let showResults = $state(false);

    $effect(() => {
        fetchLatestPoll();
    });

    async function fetchLatestPoll(): Promise<void> {
        try {
            const response = await fetch('/api/v1/polls/latest', { credentials: 'include' });
            const result = await response.json();
            if (result.success && result.data) {
                poll = result.data;
                showResults = result.data.has_voted;
            }
        } catch {
            // silently fail
        }
    }

    async function handleVote(): Promise<void> {
        if (!poll || selectedOption === null || !authStore.isAuthenticated) return;
        isVoting = true;
        try {
            const response = await fetch(`/api/v1/polls/${poll.id}/vote`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authStore.accessToken
                        ? { Authorization: `Bearer ${authStore.accessToken}` }
                        : {})
                },
                body: JSON.stringify({ option_index: selectedOption })
            });
            const result = await response.json();
            if (result.success) {
                // 투표 성공 - 결과 새로고침
                await fetchLatestPoll();
                showResults = true;
            } else {
                alert(result.error || '투표에 실패했습니다.');
            }
        } catch {
            alert('투표 처리 중 오류가 발생했습니다.');
        } finally {
            isVoting = false;
        }
    }

    function getPercentage(count: number, total: number): number {
        if (total === 0) return 0;
        return Math.round((count / total) * 100);
    }
</script>

{#if poll}
    <Card class="bg-background">
        <CardHeader class="pb-3">
            <CardTitle class="flex items-center gap-2 text-base">
                <BarChart3 class="h-4 w-4" />
                {poll.subject}
            </CardTitle>
        </CardHeader>
        <CardContent>
            {#if showResults || poll.has_voted}
                <!-- 결과 표시 -->
                <div class="space-y-2">
                    {#each poll.options as option}
                        {@const pct = getPercentage(option.count, poll.total_vote)}
                        <div>
                            <div class="mb-1 flex items-center justify-between text-sm">
                                <span class="text-foreground">{option.text}</span>
                                <span class="text-muted-foreground">
                                    {pct}% ({option.count}표)
                                </span>
                            </div>
                            <div class="bg-muted h-2 overflow-hidden rounded-full">
                                <div
                                    class="bg-primary h-full rounded-full transition-all duration-500"
                                    style="width: {pct}%"
                                ></div>
                            </div>
                        </div>
                    {/each}
                    <p class="text-muted-foreground pt-1 text-xs">
                        총 {poll.total_vote}명 참여
                    </p>
                </div>
            {:else}
                <!-- 투표 UI -->
                <div class="space-y-2">
                    {#each poll.options as option}
                        <button
                            type="button"
                            class="border-border hover:border-primary hover:bg-primary/5 flex w-full items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors {selectedOption ===
                            option.index
                                ? 'border-primary bg-primary/10'
                                : ''}"
                            onclick={() => (selectedOption = option.index)}
                        >
                            <div
                                class="border-muted-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 {selectedOption ===
                                option.index
                                    ? 'border-primary bg-primary'
                                    : ''}"
                            >
                                {#if selectedOption === option.index}
                                    <Check class="text-primary-foreground h-3 w-3" />
                                {/if}
                            </div>
                            <span class="text-foreground">{option.text}</span>
                        </button>
                    {/each}
                </div>

                <div class="mt-3 flex items-center gap-2">
                    {#if authStore.isAuthenticated}
                        <Button
                            size="sm"
                            onclick={handleVote}
                            disabled={selectedOption === null || isVoting}
                        >
                            {isVoting ? '투표 중...' : '투표하기'}
                        </Button>
                    {:else}
                        <p class="text-muted-foreground text-xs">로그인 후 투표할 수 있습니다.</p>
                    {/if}
                    <Button variant="ghost" size="sm" onclick={() => (showResults = true)}>
                        결과보기
                    </Button>
                </div>
            {/if}
        </CardContent>
    </Card>
{/if}
