<script lang="ts">
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import BarChart3 from '@lucide/svelte/icons/bar-chart-3';
    import Plus from '@lucide/svelte/icons/plus';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import X from '@lucide/svelte/icons/x';
    import { authStore } from '$lib/stores/auth.svelte.js';

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
        point: number;
        date: string;
        is_active: boolean;
        has_voted: boolean;
    }

    let polls = $state<Poll[]>([]);
    let showCreateDialog = $state(false);
    let newSubject = $state('');
    let newOptions = $state<string[]>(['', '']);
    let newLevel = $state(0);
    let isCreating = $state(false);

    $effect(() => {
        fetchPolls();
    });

    async function fetchPolls(): Promise<void> {
        try {
            const response = await fetch('/api/v1/polls', {
                credentials: 'include',
                headers: authStore.accessToken
                    ? { Authorization: `Bearer ${authStore.accessToken}` }
                    : {}
            });
            const result = await response.json();
            if (result.success) {
                polls = result.data ?? [];
            }
        } catch {
            console.error('투표 목록 조회 실패');
        }
    }

    function addOption(): void {
        if (newOptions.length < 9) {
            newOptions = [...newOptions, ''];
        }
    }

    function removeOption(index: number): void {
        if (newOptions.length > 2) {
            newOptions = newOptions.filter((_, i) => i !== index);
        }
    }

    async function handleCreate(): Promise<void> {
        const validOptions = newOptions.filter((o) => o.trim());
        if (!newSubject.trim() || validOptions.length < 2) {
            alert('질문과 최소 2개의 선택지를 입력해주세요.');
            return;
        }

        isCreating = true;
        try {
            const response = await fetch('/api/v1/admin/polls', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authStore.accessToken
                        ? { Authorization: `Bearer ${authStore.accessToken}` }
                        : {})
                },
                body: JSON.stringify({
                    subject: newSubject.trim(),
                    options: validOptions,
                    level: newLevel
                })
            });
            const result = await response.json();
            if (result.success) {
                showCreateDialog = false;
                newSubject = '';
                newOptions = ['', ''];
                newLevel = 0;
                await fetchPolls();
            } else {
                alert(result.error || '생성 실패');
            }
        } catch {
            alert('투표 생성 중 오류');
        } finally {
            isCreating = false;
        }
    }

    async function toggleActive(poll: Poll): Promise<void> {
        try {
            await fetch(`/api/v1/admin/polls/${poll.id}`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...(authStore.accessToken
                        ? { Authorization: `Bearer ${authStore.accessToken}` }
                        : {})
                },
                body: JSON.stringify({ is_active: !poll.is_active })
            });
            await fetchPolls();
        } catch {
            alert('상태 변경 실패');
        }
    }

    async function handleDelete(pollId: number): Promise<void> {
        if (!confirm('이 투표를 삭제하시겠습니까?')) return;
        try {
            await fetch(`/api/v1/admin/polls/${pollId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: authStore.accessToken
                    ? { Authorization: `Bearer ${authStore.accessToken}` }
                    : {}
            });
            await fetchPolls();
        } catch {
            alert('삭제 실패');
        }
    }

    function getPercentage(count: number, total: number): number {
        if (total === 0) return 0;
        return Math.round((count / total) * 100);
    }
</script>

<svelte:head>
    <title>투표 관리 | Admin</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6 p-6">
    <div class="flex items-center justify-between">
        <h1 class="text-foreground text-2xl font-bold">투표 관리</h1>
        <Button onclick={() => (showCreateDialog = true)}>
            <Plus class="mr-1 h-4 w-4" />
            새 투표 만들기
        </Button>
    </div>

    {#if polls.length === 0}
        <Card class="bg-background">
            <CardContent class="py-12 text-center">
                <BarChart3 class="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                <p class="text-foreground mb-2 text-lg font-medium">등록된 투표가 없습니다</p>
                <p class="text-muted-foreground">새 투표를 만들어보세요.</p>
            </CardContent>
        </Card>
    {:else}
        <div class="space-y-4">
            {#each polls as poll}
                <Card class="bg-background">
                    <CardHeader class="pb-3">
                        <div class="flex items-start justify-between">
                            <div class="flex items-center gap-2">
                                <CardTitle class="text-lg">{poll.subject}</CardTitle>
                                <Badge variant={poll.is_active ? 'default' : 'secondary'}>
                                    {poll.is_active ? '진행 중' : '종료'}
                                </Badge>
                            </div>
                            <div class="flex gap-1">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onclick={() => toggleActive(poll)}
                                >
                                    {poll.is_active ? '종료' : '재개'}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    class="text-destructive"
                                    onclick={() => handleDelete(poll.id)}
                                >
                                    <Trash2 class="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
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
                                            class="bg-primary h-full rounded-full transition-all"
                                            style="width: {pct}%"
                                        ></div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                        <p class="text-muted-foreground mt-3 text-xs">
                            총 {poll.total_vote}명 참여 &middot; {poll.date}
                            {#if poll.level > 0}
                                &middot; Lv.{poll.level} 이상
                            {/if}
                        </p>
                    </CardContent>
                </Card>
            {/each}
        </div>
    {/if}
</div>

<!-- 새 투표 생성 다이얼로그 -->
<Dialog.Root bind:open={showCreateDialog}>
    <Dialog.Content class="max-w-lg">
        <Dialog.Header>
            <Dialog.Title>새 투표 만들기</Dialog.Title>
            <Dialog.Description>질문과 선택지를 입력하세요. (최소 2개, 최대 9개)</Dialog.Description
            >
        </Dialog.Header>

        <div class="space-y-4 py-4">
            <div>
                <Label for="poll-subject">질문</Label>
                <Input
                    id="poll-subject"
                    bind:value={newSubject}
                    placeholder="투표 질문을 입력하세요"
                />
            </div>

            <div class="space-y-2">
                <Label>선택지</Label>
                {#each newOptions as option, i}
                    <div class="flex gap-2">
                        <Input bind:value={newOptions[i]} placeholder="선택지 {i + 1}" />
                        {#if newOptions.length > 2}
                            <Button
                                variant="ghost"
                                size="sm"
                                class="shrink-0"
                                onclick={() => removeOption(i)}
                            >
                                <X class="h-4 w-4" />
                            </Button>
                        {/if}
                    </div>
                {/each}
                {#if newOptions.length < 9}
                    <Button variant="outline" size="sm" onclick={addOption}>
                        <Plus class="mr-1 h-3 w-3" />
                        선택지 추가
                    </Button>
                {/if}
            </div>

            <div>
                <Label for="poll-level">참여 제한 레벨 (0 = 제한 없음)</Label>
                <Input id="poll-level" type="number" bind:value={newLevel} min={0} max={10} />
            </div>
        </div>

        <Dialog.Footer>
            <Button variant="outline" onclick={() => (showCreateDialog = false)}>취소</Button>
            <Button onclick={handleCreate} disabled={isCreating}>
                {isCreating ? '생성 중...' : '생성'}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
