<script lang="ts">
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import * as Card from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Textarea } from '$lib/components/ui/textarea/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import ArrowLeft from '@lucide/svelte/icons/arrow-left';
    import Pencil from '@lucide/svelte/icons/pencil';
    import Ban from '@lucide/svelte/icons/ban';
    import ShieldCheck from '@lucide/svelte/icons/shield-check';
    import UserX from '@lucide/svelte/icons/user-x';
    import UserCheck from '@lucide/svelte/icons/user-check';
    import FileText from '@lucide/svelte/icons/file-text';
    import MessageSquare from '@lucide/svelte/icons/message-square';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import {
        getMember,
        updateMember,
        banMember,
        unbanMember,
        type AdminMember
    } from '$lib/api/admin-members';

    const mbId = $derived($page.params.mbId ?? '');

    let member = $state<AdminMember | null>(null);
    let loading = $state(true);
    let error = $state('');

    let recentPosts = $state<any[]>([]);
    let recentComments = $state<any[]>([]);
    let activityLoading = $state(true);
    let activeTab = $state<'posts' | 'comments'>('posts');

    let showEditDialog = $state(false);
    let editRealName = $state('');
    let editName = $state('');
    let editEmail = $state('');
    let editLevel = $state(1);
    let editPoint = $state(0);
    let editSignature = $state('');
    let editMemo = $state('');
    let saving = $state(false);

    async function fetchMember() {
        loading = true;
        error = '';
        try {
            member = await getMember(mbId);
        } catch (err) {
            error = err instanceof Error ? err.message : '회원 정보를 불러올 수 없습니다.';
        } finally {
            loading = false;
        }
    }

    async function fetchActivity() {
        activityLoading = true;
        try {
            const res = await fetch(`/api/v1/members/${mbId}/activity?limit=20`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                recentPosts = data.recentPosts || [];
                recentComments = data.recentComments || [];
            }
        } catch {
            // silent
        } finally {
            activityLoading = false;
        }
    }

    function openEditDialog() {
        if (!member) return;
        editRealName = member.mb_real_name || '';
        editName = member.mb_name;
        editEmail = member.mb_email;
        editLevel = member.mb_level;
        editPoint = member.mb_point;
        editSignature = member.mb_signature || '';
        editMemo = member.mb_memo || '';
        showEditDialog = true;
    }

    async function handleSaveEdit() {
        if (!member) return;
        saving = true;
        try {
            await updateMember(member.mb_id, {
                mb_real_name: editRealName,
                mb_name: editName,
                mb_email: editEmail,
                mb_level: editLevel,
                mb_point: editPoint,
                mb_signature: editSignature,
                mb_memo: editMemo
            });
            showEditDialog = false;
            await fetchMember();
        } catch (err) {
            alert(err instanceof Error ? err.message : '저장에 실패했습니다.');
        } finally {
            saving = false;
        }
    }

    async function handleBan() {
        if (!member) return;
        const isBanned = !!member.mb_intercept_date;
        const action = isBanned ? '차단 해제' : '차단';
        if (!confirm(`"${member.mb_name}" (${member.mb_id})님을 ${action}하시겠습니까?`)) return;
        try {
            if (isBanned) {
                await unbanMember(member.mb_id);
            } else {
                await banMember(member.mb_id);
            }
            await fetchMember();
        } catch (err) {
            alert(err instanceof Error ? err.message : `${action}에 실패했습니다.`);
        }
    }

    async function handleLeave() {
        if (!member) return;
        const isLeft = !!member.mb_leave_date;
        const action = isLeft ? '탈퇴 취소' : '탈퇴 처리';
        if (!confirm(`"${member.mb_name}" (${member.mb_id})님을 ${action}하시겠습니까?`)) return;
        try {
            await updateMember(member.mb_id, { mb_leave: !isLeft });
            await fetchMember();
        } catch (err) {
            alert(err instanceof Error ? err.message : `${action}에 실패했습니다.`);
        }
    }

    function getLevelBadge(level: number) {
        if (level === -1) return { label: '공식 AI 봇', variant: 'outline' as const };
        if (level >= 10) return { label: '관리자', variant: 'destructive' as const };
        if (level >= 5) return { label: `Lv.${level}`, variant: 'default' as const };
        return { label: `Lv.${level}`, variant: 'secondary' as const };
    }

    function getStatusBadge(m: AdminMember) {
        if (m.mb_intercept_date) return { label: '차단', variant: 'destructive' as const };
        if (m.mb_leave_date) return { label: '탈퇴', variant: 'outline' as const };
        return { label: '정상', variant: 'default' as const };
    }

    function formatDate(dateStr?: string | null): string {
        if (!dateStr || dateStr === '0000-00-00') return '-';
        try {
            return new Date(dateStr).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        } catch {
            return dateStr;
        }
    }

    function getInitial(name: string): string {
        return name?.charAt(0)?.toUpperCase() || '?';
    }

    onMount(() => {
        fetchMember();
        fetchActivity();
    });
</script>

<svelte:head>
    <title>{member?.mb_name || mbId} - 회원 상세 | Admin</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6 p-6">
    <div class="flex items-center gap-3">
        <Button variant="ghost" size="icon" onclick={() => goto('/admin/members')}>
            <ArrowLeft class="h-5 w-5" />
        </Button>
        <h1 class="text-2xl font-bold">회원 상세</h1>
    </div>

    {#if loading}
        <div class="flex items-center justify-center py-12">
            <Loader2 class="text-muted-foreground h-6 w-6 animate-spin" />
            <span class="text-muted-foreground ml-2 text-sm">로딩 중...</span>
        </div>
    {:else if error}
        <Card.Root>
            <Card.Content class="py-12 text-center">
                <p class="text-destructive mb-4">{error}</p>
                <Button variant="outline" onclick={() => goto('/admin/members')}>목록으로</Button>
            </Card.Content>
        </Card.Root>
    {:else if member}
        <Card.Root>
            <Card.Content class="p-6">
                <div class="flex flex-col gap-6 sm:flex-row">
                    <div
                        class="bg-primary/10 text-primary flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-2xl font-bold"
                    >
                        {getInitial(member.mb_name)}
                    </div>
                    <div class="flex-1 space-y-3">
                        <div class="flex flex-wrap items-center gap-2">
                            <h2 class="text-xl font-bold">{member.mb_name}</h2>
                            <Badge variant={getLevelBadge(member.mb_level).variant}
                                >{getLevelBadge(member.mb_level).label}</Badge
                            >
                            {#if getStatusBadge(member).label !== '정상'}
                                <Badge variant={getStatusBadge(member).variant}
                                    >{getStatusBadge(member).label}</Badge
                                >
                            {/if}
                        </div>
                        <div
                            class="text-muted-foreground grid grid-cols-1 gap-2 text-sm sm:grid-cols-2"
                        >
                            <div><span class="font-medium">아이디:</span> {member.mb_id}</div>
                            <div>
                                <span class="font-medium">이름:</span>
                                {member.mb_real_name || '-'}
                            </div>
                            <div><span class="font-medium">이메일:</span> {member.mb_email}</div>
                            <div>
                                <span class="font-medium">포인트:</span>
                                {member.mb_point.toLocaleString()}P
                            </div>
                            <div>
                                <span class="font-medium">가입일:</span>
                                {formatDate(member.mb_datetime)}
                            </div>
                            <div>
                                <span class="font-medium">최근 로그인:</span>
                                {formatDate(member.mb_today_login)}
                            </div>
                            {#if member.mb_signature}
                                <div class="sm:col-span-2">
                                    <span class="font-medium">서명:</span>
                                    {member.mb_signature}
                                </div>
                            {/if}
                            {#if member.mb_memo}
                                <div class="sm:col-span-2">
                                    <span class="font-medium">관리자 메모:</span>
                                    {member.mb_memo}
                                </div>
                            {/if}
                        </div>
                        <div class="flex flex-wrap gap-2 pt-2">
                            <Button size="sm" variant="outline" onclick={openEditDialog}>
                                <Pencil class="mr-1 h-4 w-4" />
                                수정
                            </Button>
                            {#if member.mb_intercept_date}
                                <Button size="sm" variant="outline" onclick={handleBan}>
                                    <ShieldCheck class="mr-1 h-4 w-4" />
                                    차단 해제
                                </Button>
                            {:else}
                                <Button size="sm" variant="destructive" onclick={handleBan}>
                                    <Ban class="mr-1 h-4 w-4" />
                                    차단
                                </Button>
                            {/if}
                            {#if member.mb_leave_date}
                                <Button size="sm" variant="outline" onclick={handleLeave}>
                                    <UserCheck class="mr-1 h-4 w-4" />
                                    탈퇴 취소
                                </Button>
                            {:else}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    class="text-orange-600 hover:text-orange-700"
                                    onclick={handleLeave}
                                >
                                    <UserX class="mr-1 h-4 w-4" />
                                    탈퇴 처리
                                </Button>
                            {/if}
                        </div>
                    </div>
                </div>
            </Card.Content>
        </Card.Root>

        <div class="grid grid-cols-2 gap-4">
            <Card.Root>
                <Card.Content class="flex items-center gap-3 p-4">
                    <FileText class="text-muted-foreground h-8 w-8" />
                    <div>
                        <div class="text-2xl font-bold">{recentPosts.length}</div>
                        <div class="text-muted-foreground text-xs">최근 작성글</div>
                    </div>
                </Card.Content>
            </Card.Root>
            <Card.Root>
                <Card.Content class="flex items-center gap-3 p-4">
                    <MessageSquare class="text-muted-foreground h-8 w-8" />
                    <div>
                        <div class="text-2xl font-bold">{recentComments.length}</div>
                        <div class="text-muted-foreground text-xs">최근 댓글</div>
                    </div>
                </Card.Content>
            </Card.Root>
        </div>

        <Card.Root>
            <Card.Header class="pb-0">
                <div class="flex gap-1 border-b">
                    <button
                        class="px-4 py-2 text-sm font-medium transition-colors {activeTab ===
                        'posts'
                            ? 'border-primary text-foreground border-b-2'
                            : 'text-muted-foreground hover:text-foreground'}"
                        onclick={() => (activeTab = 'posts')}
                    >
                        작성글
                    </button>
                    <button
                        class="px-4 py-2 text-sm font-medium transition-colors {activeTab ===
                        'comments'
                            ? 'border-primary text-foreground border-b-2'
                            : 'text-muted-foreground hover:text-foreground'}"
                        onclick={() => (activeTab = 'comments')}
                    >
                        댓글
                    </button>
                </div>
            </Card.Header>
            <Card.Content class="pt-4">
                {#if activityLoading}
                    <div class="flex items-center justify-center py-8">
                        <Loader2 class="text-muted-foreground h-5 w-5 animate-spin" />
                    </div>
                {:else if activeTab === 'posts'}
                    {#if recentPosts.length === 0}
                        <p class="text-muted-foreground py-8 text-center text-sm">
                            작성한 글이 없습니다.
                        </p>
                    {:else}
                        <div class="space-y-1">
                            {#each recentPosts as post}
                                <a
                                    href={post.href}
                                    target="_blank"
                                    class="hover:bg-muted flex items-center gap-3 rounded-md px-3 py-2 transition-colors"
                                >
                                    <Badge variant="outline" class="shrink-0 text-xs">
                                        {post.bo_subject}
                                    </Badge>
                                    <span class="min-w-0 flex-1 truncate text-sm">
                                        {post.wr_subject}
                                    </span>
                                    <span class="text-muted-foreground shrink-0 text-xs">
                                        {formatDate(post.wr_datetime)}
                                    </span>
                                </a>
                            {/each}
                        </div>
                    {/if}
                {:else if recentComments.length === 0}
                    <p class="text-muted-foreground py-8 text-center text-sm">
                        작성한 댓글이 없습니다.
                    </p>
                {:else}
                    <div class="space-y-1">
                        {#each recentComments as comment}
                            <a
                                href={comment.href}
                                target="_blank"
                                class="hover:bg-muted flex items-center gap-3 rounded-md px-3 py-2 transition-colors"
                            >
                                <Badge variant="outline" class="shrink-0 text-xs">
                                    {comment.bo_subject}
                                </Badge>
                                <span class="text-muted-foreground min-w-0 flex-1 truncate text-sm">
                                    {comment.wr_content}
                                </span>
                                <span class="text-muted-foreground shrink-0 text-xs">
                                    {formatDate(comment.wr_datetime)}
                                </span>
                            </a>
                        {/each}
                    </div>
                {/if}
            </Card.Content>
        </Card.Root>
    {/if}
</div>

<Dialog.Root bind:open={showEditDialog}>
    <Dialog.Content class="sm:max-w-lg">
        <Dialog.Header>
            <Dialog.Title>회원 정보 수정</Dialog.Title>
            <Dialog.Description>{member?.mb_name} ({member?.mb_id})</Dialog.Description>
        </Dialog.Header>
        <form
            class="space-y-4"
            onsubmit={(e) => {
                e.preventDefault();
                handleSaveEdit();
            }}
        >
            <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                    <Label for="edit-real-name">이름</Label>
                    <Input id="edit-real-name" type="text" bind:value={editRealName} />
                </div>
                <div class="space-y-2">
                    <Label for="edit-name">닉네임</Label>
                    <Input id="edit-name" type="text" bind:value={editName} required />
                </div>
            </div>
            <div class="space-y-2">
                <Label for="edit-email">이메일</Label>
                <Input id="edit-email" type="email" bind:value={editEmail} required />
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                    <Label for="edit-level">레벨 (1~10)</Label>
                    <Input id="edit-level" type="number" min={1} max={10} bind:value={editLevel} />
                </div>
                <div class="space-y-2">
                    <Label for="edit-point">포인트</Label>
                    <Input id="edit-point" type="number" bind:value={editPoint} />
                </div>
            </div>
            <div class="space-y-2">
                <Label for="edit-signature">서명</Label>
                <Input id="edit-signature" type="text" bind:value={editSignature} />
            </div>
            <div class="space-y-2">
                <Label for="edit-memo">관리자 메모</Label>
                <Textarea id="edit-memo" bind:value={editMemo} rows={3} />
            </div>
            <Dialog.Footer>
                <Button variant="outline" type="button" onclick={() => (showEditDialog = false)}>
                    취소
                </Button>
                <Button type="submit" disabled={saving}>
                    {#if saving}
                        <Loader2 class="mr-2 h-4 w-4 animate-spin" />
                    {/if}
                    저장
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>
