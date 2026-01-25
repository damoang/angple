<script lang="ts">
    import { goto } from '$app/navigation';
    import { Card, CardContent, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Textarea } from '$lib/components/ui/textarea/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import type { PageData } from './$types.js';
    import { apiClient } from '$lib/api/index.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import type { Message, MessageListResponse, MessageKind } from '$lib/api/types.js';
    import { onMount } from 'svelte';
    import Mail from '@lucide/svelte/icons/mail';
    import Send from '@lucide/svelte/icons/send';
    import Inbox from '@lucide/svelte/icons/inbox';
    import Trash2 from '@lucide/svelte/icons/trash-2';
    import PenSquare from '@lucide/svelte/icons/pen-square';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import User from '@lucide/svelte/icons/user';
    import ArrowLeft from '@lucide/svelte/icons/arrow-left';

    let { data }: { data: PageData } = $props();

    // 상태
    let messageData = $state<MessageListResponse | null>(null);
    let isLoading = $state(true);
    let error = $state<string | null>(null);

    // 쪽지 보내기 다이얼로그
    let showSendDialog = $state(false);
    let sendTo = $state('');
    let sendContent = $state('');
    let isSending = $state(false);
    let sendError = $state<string | null>(null);

    // 쪽지 보기 다이얼로그
    let showViewDialog = $state(false);
    let viewingMessage = $state<Message | null>(null);
    let isLoadingMessage = $state(false);

    // 탭 정의
    const tabs: { id: MessageKind; label: string; icon: typeof Inbox }[] = [
        { id: 'recv', label: '받은 쪽지', icon: Inbox },
        { id: 'send', label: '보낸 쪽지', icon: Send }
    ];

    // 쪽지 목록 로드
    async function loadMessages(): Promise<void> {
        if (!authStore.isAuthenticated) {
            authStore.redirectToLogin();
            return;
        }

        isLoading = true;
        error = null;

        try {
            messageData = await apiClient.getMessages(data.kind, data.page, data.limit);
        } catch (err) {
            error = err instanceof Error ? err.message : '쪽지를 불러오는데 실패했습니다.';
        } finally {
            isLoading = false;
        }
    }

    // 탭 변경
    function changeTab(kind: MessageKind): void {
        goto(`/messages?kind=${kind}`);
    }

    // 페이지 변경
    function goToPage(pageNum: number): void {
        goto(`/messages?kind=${data.kind}&page=${pageNum}`);
    }

    // 시간 포맷
    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 쪽지 보기
    async function viewMessage(message: Message): Promise<void> {
        showViewDialog = true;
        isLoadingMessage = true;

        try {
            viewingMessage = await apiClient.getMessage(message.id);
        } catch (err) {
            console.error('Failed to load message:', err);
            viewingMessage = message;
        } finally {
            isLoadingMessage = false;
        }
    }

    // 쪽지 삭제
    async function deleteMessage(messageId: number): Promise<void> {
        if (!confirm('쪽지를 삭제하시겠습니까?')) return;

        try {
            await apiClient.deleteMessage(messageId);
            // 목록에서 제거
            if (messageData) {
                messageData.items = messageData.items.filter((m) => m.id !== messageId);
                messageData.total--;
            }
            showViewDialog = false;
            viewingMessage = null;
        } catch (err) {
            console.error('Failed to delete message:', err);
            alert('쪽지 삭제에 실패했습니다.');
        }
    }

    // 쪽지 보내기
    async function handleSendMessage(): Promise<void> {
        if (!sendTo.trim() || !sendContent.trim()) {
            sendError = '받는 사람과 내용을 입력해주세요.';
            return;
        }

        isSending = true;
        sendError = null;

        try {
            await apiClient.sendMessage({
                receiver_id: sendTo.trim(),
                content: sendContent.trim()
            });

            // 성공 시 다이얼로그 닫기 및 초기화
            showSendDialog = false;
            sendTo = '';
            sendContent = '';

            // 보낸 쪽지 탭이면 목록 새로고침
            if (data.kind === 'send') {
                loadMessages();
            }
        } catch (err) {
            sendError = err instanceof Error ? err.message : '쪽지 전송에 실패했습니다.';
        } finally {
            isSending = false;
        }
    }

    // 답장하기
    function replyToMessage(message: Message): void {
        showViewDialog = false;
        sendTo = data.kind === 'recv' ? message.sender_id : message.receiver_id;
        sendContent = '';
        showSendDialog = true;
    }

    // 초기 로드
    onMount(() => {
        loadMessages();
    });

    // kind 변경 시 다시 로드
    $effect(() => {
        if (data.kind) {
            loadMessages();
        }
    });
</script>

<svelte:head>
    <title>쪽지함 | 다모앙</title>
</svelte:head>

<div class="mx-auto max-w-4xl pt-4">
    <!-- 헤더 -->
    <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-4">
            <Button variant="ghost" size="sm" onclick={() => goto('/my')}>
                <ArrowLeft class="mr-1 h-4 w-4" />
                마이페이지
            </Button>
            <h1 class="text-2xl font-bold text-foreground">쪽지함</h1>
        </div>
        <Button onclick={() => (showSendDialog = true)}>
            <PenSquare class="mr-2 h-4 w-4" />
            쪽지 쓰기
        </Button>
    </div>

    <!-- 탭 네비게이션 -->
    <div class="mb-6 flex gap-2 border-b border-border pb-2">
        {#each tabs as tab (tab.id)}
            <Button
                variant={data.kind === tab.id ? 'default' : 'ghost'}
                size="sm"
                onclick={() => changeTab(tab.id)}
            >
                <tab.icon class="mr-1.5 h-4 w-4" />
                {tab.label}
                {#if tab.id === 'recv' && messageData?.unread_count}
                    <span class="ml-1.5 rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">
                        {messageData.unread_count}
                    </span>
                {/if}
            </Button>
        {/each}
    </div>

    {#if isLoading}
        <div class="flex items-center justify-center py-20">
            <Loader2 class="h-8 w-8 animate-spin text-primary" />
        </div>
    {:else if error}
        <Card class="border-destructive">
            <CardContent class="pt-6">
                <p class="text-destructive text-center">{error}</p>
            </CardContent>
        </Card>
    {:else if messageData}
        <Card class="bg-background">
            <CardHeader>
                <CardTitle class="flex items-center gap-2">
                    {data.kind === 'recv' ? '받은 쪽지' : '보낸 쪽지'}
                    <span class="text-sm font-normal text-muted-foreground">
                        ({messageData.total}통)
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {#if messageData.items.length > 0}
                    <ul class="divide-y divide-border">
                        {#each messageData.items as message (message.id)}
                            <li class="py-3 first:pt-0 last:pb-0">
                                <button
                                    type="button"
                                    onclick={() => viewMessage(message)}
                                    class="w-full text-left hover:bg-accent rounded-md p-2 -m-2 transition-colors {!message.is_read && data.kind === 'recv' ? 'bg-muted/50' : ''}"
                                >
                                    <div class="flex items-center gap-3">
                                        <!-- 프로필 -->
                                        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                                            <User class="h-5 w-5" />
                                        </div>

                                        <!-- 내용 -->
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2 mb-1">
                                                <span class="font-medium text-foreground">
                                                    {data.kind === 'recv' ? message.sender_name : message.receiver_name}
                                                </span>
                                                {#if !message.is_read && data.kind === 'recv'}
                                                    <span class="rounded bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                                                        NEW
                                                    </span>
                                                {/if}
                                            </div>
                                            <p class="text-muted-foreground text-sm truncate">
                                                {message.content}
                                            </p>
                                            <p class="text-muted-foreground text-xs mt-1">
                                                {formatDate(message.send_datetime)}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <p class="text-center text-muted-foreground py-8">
                        {data.kind === 'recv' ? '받은 쪽지가 없습니다.' : '보낸 쪽지가 없습니다.'}
                    </p>
                {/if}
            </CardContent>
        </Card>

        <!-- 페이지네이션 -->
        {#if messageData.total_pages > 1}
            <div class="mt-6 flex items-center justify-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page === 1}
                    onclick={() => goToPage(data.page - 1)}
                >
                    이전
                </Button>

                <span class="text-sm text-muted-foreground px-4">
                    {data.page} / {messageData.total_pages}
                </span>

                <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page === messageData.total_pages}
                    onclick={() => goToPage(data.page + 1)}
                >
                    다음
                </Button>
            </div>
        {/if}
    {/if}
</div>

<!-- 쪽지 보내기 다이얼로그 -->
<Dialog.Root bind:open={showSendDialog}>
    <Dialog.Content class="sm:max-w-md">
        <Dialog.Header>
            <Dialog.Title class="flex items-center gap-2">
                <PenSquare class="h-5 w-5" />
                쪽지 보내기
            </Dialog.Title>
            <Dialog.Description>
                회원에게 쪽지를 보냅니다.
            </Dialog.Description>
        </Dialog.Header>

        <div class="space-y-4 py-4">
            <div class="space-y-2">
                <Label for="send-to">받는 사람</Label>
                <Input
                    id="send-to"
                    bind:value={sendTo}
                    placeholder="회원 아이디 입력"
                    disabled={isSending}
                />
            </div>

            <div class="space-y-2">
                <Label for="send-content">내용</Label>
                <Textarea
                    id="send-content"
                    bind:value={sendContent}
                    placeholder="쪽지 내용을 입력하세요..."
                    rows={5}
                    disabled={isSending}
                />
            </div>

            {#if sendError}
                <div class="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                    {sendError}
                </div>
            {/if}
        </div>

        <Dialog.Footer>
            <Button
                variant="outline"
                onclick={() => (showSendDialog = false)}
                disabled={isSending}
            >
                취소
            </Button>
            <Button onclick={handleSendMessage} disabled={isSending}>
                {#if isSending}
                    <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                    전송 중...
                {:else}
                    <Send class="mr-2 h-4 w-4" />
                    보내기
                {/if}
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>

<!-- 쪽지 보기 다이얼로그 -->
<Dialog.Root bind:open={showViewDialog}>
    <Dialog.Content class="sm:max-w-lg">
        {#if isLoadingMessage}
            <div class="flex items-center justify-center py-12">
                <Loader2 class="h-8 w-8 animate-spin text-primary" />
            </div>
        {:else if viewingMessage}
            <Dialog.Header>
                <Dialog.Title class="flex items-center gap-2">
                    <Mail class="h-5 w-5" />
                    {data.kind === 'recv' ? '받은 쪽지' : '보낸 쪽지'}
                </Dialog.Title>
            </Dialog.Header>

            <div class="py-4">
                <!-- 발신/수신 정보 -->
                <div class="flex items-center gap-3 mb-4 pb-4 border-b">
                    <div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <User class="h-6 w-6" />
                    </div>
                    <div>
                        <p class="font-medium text-foreground">
                            {data.kind === 'recv' ? viewingMessage.sender_name : viewingMessage.receiver_name}
                        </p>
                        <p class="text-sm text-muted-foreground">
                            {formatDate(viewingMessage.send_datetime)}
                        </p>
                    </div>
                </div>

                <!-- 내용 -->
                <div class="whitespace-pre-wrap text-foreground">
                    {viewingMessage.content}
                </div>
            </div>

            <Dialog.Footer class="flex-col sm:flex-row gap-2">
                <Button
                    variant="outline"
                    class="text-destructive hover:text-destructive"
                    onclick={() => deleteMessage(viewingMessage!.id)}
                >
                    <Trash2 class="mr-2 h-4 w-4" />
                    삭제
                </Button>
                <div class="flex-1"></div>
                <Button variant="outline" onclick={() => (showViewDialog = false)}>
                    닫기
                </Button>
                <Button onclick={() => replyToMessage(viewingMessage!)}>
                    <Send class="mr-2 h-4 w-4" />
                    답장
                </Button>
            </Dialog.Footer>
        {/if}
    </Dialog.Content>
</Dialog.Root>
