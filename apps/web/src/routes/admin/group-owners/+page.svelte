<script lang="ts">
    /**
     * 소모임 당주 지정 (운영진 전용)
     *
     * 소모임(gr_id='group')마다 관리 책임자를 지정한다. 저장 위치는 g5_board.bo_admin 이며,
     * 백엔드 PUT /api/v1/admin/boards/:boardId 가 이미 이 필드를 지원한다(신규 API 없음).
     *
     * 왜 필요한가 — 실측(2026-07-26): 소모임 91곳 중 실제 당주가 지정된 곳은 9곳뿐이고
     * 63곳이 특정 한 명으로 몰려 있었다. 이 상태로 당주 콘솔을 열면 그 한 사람이
     * 63개 소모임의 관리 권한을 갖게 된다. 그래서 콘솔보다 이 화면이 먼저다.
     *
     * ⛔ 닉네임이 아니라 mb_id 를 저장한다 — 닉네임은 바뀌고, 바뀌면 권한이 끊긴다.
     * ⛔ 권한 검사는 /admin/+layout.server.ts 가 서버에서 한다(level>=10). 여기서 화면을
     *    가리는 분기는 두지 않는다 — 클라이언트 분기는 토큰 위조에 무력하다.
     */
    import { onMount } from 'svelte';
    import * as Card from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import Users from '@lucide/svelte/icons/users';
    import Search from '@lucide/svelte/icons/search';
    import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
    import { listBoards, updateBoard } from '$lib/api/admin-boards';
    import { listMembers, type AdminMember } from '$lib/api/admin-members';
    import type { Board } from '$lib/api/types';

    const GROUP_ID = 'group';

    let boards = $state<Board[]>([]);
    let loading = $state(true);
    let loadError = $state('');
    let filter = $state('');

    // 지정 다이얼로그
    let dialogOpen = $state(false);
    let target = $state<Board | null>(null);
    let memberQuery = $state('');
    let candidates = $state<AdminMember[]>([]);
    let searching = $state(false);
    let searchError = $state('');
    let saving = $state(false);

    const groupBoards = $derived(boards.filter((b) => b.group_id === GROUP_ID));

    /** 같은 사람이 여러 소모임 당주로 잡혀 있으면 눈에 띄게 한다(대량 기본값 탐지). */
    const ownerCounts = $derived.by(() => {
        const counts = new Map<string, number>();
        for (const b of groupBoards) {
            const owner = (b.admin || '').trim();
            if (owner) counts.set(owner, (counts.get(owner) ?? 0) + 1);
        }
        return counts;
    });

    const visible = $derived.by(() => {
        const q = filter.trim().toLowerCase();
        const rows = q
            ? groupBoards.filter(
                  (b) =>
                      b.board_id.toLowerCase().includes(q) ||
                      (b.subject || b.name || '').toLowerCase().includes(q) ||
                      (b.admin || '').toLowerCase().includes(q)
              )
            : groupBoards;
        // 미지정 → 중복 지정 → 나머지 순. 손봐야 할 것이 위로 온다.
        return [...rows].sort((a, b) => rank(a) - rank(b));
    });

    const unassignedCount = $derived(groupBoards.filter((b) => !(b.admin || '').trim()).length);
    const duplicated = $derived([...ownerCounts.entries()].filter(([, n]) => n > 1));

    function rank(b: Board): number {
        const owner = (b.admin || '').trim();
        if (!owner) return 0;
        if ((ownerCounts.get(owner) ?? 0) > 1) return 1;
        return 2;
    }

    async function load() {
        loading = true;
        loadError = '';
        try {
            boards = await listBoards();
        } catch (e) {
            loadError = e instanceof Error ? e.message : '게시판 목록을 불러오지 못했습니다.';
        } finally {
            loading = false;
        }
    }

    function openDialog(board: Board) {
        target = board;
        memberQuery = '';
        candidates = [];
        searchError = '';
        dialogOpen = true;
    }

    async function searchMembers() {
        const q = memberQuery.trim();
        if (!q) {
            candidates = [];
            return;
        }
        searching = true;
        searchError = '';
        try {
            const res = await listMembers({ search: q, limit: 10 });
            candidates = res.members ?? [];
            if (candidates.length === 0) searchError = '검색 결과가 없습니다.';
        } catch (e) {
            searchError = e instanceof Error ? e.message : '회원 검색에 실패했습니다.';
        } finally {
            searching = false;
        }
    }

    /** 탈퇴한 회원을 당주로 두면 그 소모임은 관리 불능이 된다. */
    function isWithdrawn(m: AdminMember): boolean {
        return !!(m.mb_leave_date && m.mb_leave_date.trim() !== '');
    }

    async function assign(mbId: string) {
        if (!target || saving) return;
        saving = true;
        try {
            await updateBoard(target.board_id, { admin: mbId });
            // 목록을 다시 받지 않고 해당 행만 갱신 — 91행 재조회는 과하다.
            boards = boards.map((b) =>
                b.board_id === target!.board_id ? { ...b, admin: mbId } : b
            );
            dialogOpen = false;
        } catch (e) {
            searchError = e instanceof Error ? e.message : '당주 지정에 실패했습니다.';
        } finally {
            saving = false;
        }
    }

    async function clearOwner(board: Board) {
        if (!confirm(`${board.subject || board.board_id} 의 당주 지정을 해제할까요?`)) return;
        try {
            await updateBoard(board.board_id, { admin: '' });
            boards = boards.map((b) => (b.board_id === board.board_id ? { ...b, admin: '' } : b));
        } catch (e) {
            alert(e instanceof Error ? e.message : '해제에 실패했습니다.');
        }
    }

    onMount(load);
</script>

<svelte:head><title>소모임 당주 지정 - 관리자</title></svelte:head>

<div class="space-y-4">
    <div class="flex items-center gap-2">
        <Users class="h-5 w-5" />
        <h1 class="text-xl font-semibold">소모임 당주 지정</h1>
    </div>

    <p class="text-muted-foreground text-sm">
        소모임마다 관리 책임자를 지정합니다. 지정된 분만 해당 소모임의 관리 화면을 열 수 있고,
        지정되지 않은 소모임은 관리 화면 자체가 열리지 않습니다.
    </p>

    {#if duplicated.length > 0}
        <Card.Root class="border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
            <Card.Content class="flex gap-3 pt-6">
                <TriangleAlert class="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div class="text-sm">
                    <p class="font-medium">한 분이 여러 소모임의 당주로 지정되어 있습니다.</p>
                    <ul class="mt-1 space-y-0.5">
                        {#each duplicated as [owner, count] (owner)}
                            <li><code class="text-xs">{owner}</code> — {count}곳</li>
                        {/each}
                    </ul>
                    <p class="text-muted-foreground mt-1">
                        기본값이 그대로 남아 있는 경우가 많습니다. 실제 당주로 바꿔 주세요.
                    </p>
                </div>
            </Card.Content>
        </Card.Root>
    {/if}

    <div class="flex flex-wrap items-center gap-2">
        <Input class="max-w-xs" placeholder="소모임 이름·주소·당주로 검색" bind:value={filter} />
        <span class="text-muted-foreground text-sm">
            전체 {groupBoards.length}곳 · 미지정 {unassignedCount}곳
        </span>
    </div>

    {#if loading}
        <p class="text-muted-foreground text-sm">불러오는 중…</p>
    {:else if loadError}
        <p class="text-destructive text-sm">{loadError}</p>
    {:else if visible.length === 0}
        <p class="text-muted-foreground text-sm">해당하는 소모임이 없습니다.</p>
    {:else}
        <div class="overflow-x-auto rounded-md border">
            <table class="w-full text-sm">
                <thead class="bg-muted/50">
                    <tr>
                        <th class="p-2 text-left font-medium">소모임</th>
                        <th class="p-2 text-left font-medium">주소</th>
                        <th class="p-2 text-left font-medium">현재 당주</th>
                        <th class="p-2 text-right font-medium">지정</th>
                    </tr>
                </thead>
                <tbody>
                    {#each visible as b (b.board_id)}
                        {@const owner = (b.admin || '').trim()}
                        {@const dup = owner ? (ownerCounts.get(owner) ?? 0) > 1 : false}
                        <tr class="border-t">
                            <td class="p-2">{b.subject || b.name || b.board_id}</td>
                            <td class="text-muted-foreground p-2"><code>{b.board_id}</code></td>
                            <td class="p-2">
                                {#if !owner}
                                    <Badge variant="outline">미지정</Badge>
                                {:else}
                                    <code class="text-xs">{owner}</code>
                                    {#if dup}
                                        <Badge variant="destructive" class="ml-1 text-[10px]">
                                            중복 {ownerCounts.get(owner)}곳
                                        </Badge>
                                    {/if}
                                {/if}
                            </td>
                            <td class="whitespace-nowrap p-2 text-right">
                                <Button size="sm" variant="outline" onclick={() => openDialog(b)}>
                                    변경
                                </Button>
                                {#if owner}
                                    <Button size="sm" variant="ghost" onclick={() => clearOwner(b)}>
                                        해제
                                    </Button>
                                {/if}
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</div>

<Dialog.Root bind:open={dialogOpen}>
    <Dialog.Content class="max-w-lg">
        <Dialog.Header>
            <Dialog.Title>
                당주 지정 — {target?.subject || target?.name || target?.board_id}
            </Dialog.Title>
            <Dialog.Description>
                닉네임이나 아이디로 회원을 찾아 지정합니다. 저장되는 값은 아이디(mb_id)라 닉네임이
                바뀌어도 권한은 유지됩니다.
            </Dialog.Description>
        </Dialog.Header>

        <div class="space-y-3">
            <form
                class="flex gap-2"
                onsubmit={(e) => {
                    e.preventDefault();
                    searchMembers();
                }}
            >
                <Input placeholder="닉네임 또는 아이디" bind:value={memberQuery} />
                <Button type="submit" disabled={searching}>
                    <Search class="mr-1 h-4 w-4" />
                    {searching ? '검색 중' : '검색'}
                </Button>
            </form>

            {#if searchError}
                <p class="text-destructive text-sm">{searchError}</p>
            {/if}

            {#if candidates.length > 0}
                <ul class="max-h-64 space-y-1 overflow-y-auto">
                    {#each candidates as m (m.mb_id)}
                        {@const withdrawn = isWithdrawn(m)}
                        <li class="flex items-center justify-between gap-2 rounded border p-2">
                            <div class="min-w-0">
                                <div class="truncate">
                                    {m.mb_name}
                                    {#if withdrawn}
                                        <Badge variant="destructive" class="ml-1 text-[10px]">
                                            탈퇴
                                        </Badge>
                                    {/if}
                                </div>
                                <code class="text-muted-foreground text-xs">{m.mb_id}</code>
                            </div>
                            <Button
                                size="sm"
                                disabled={saving || withdrawn}
                                title={withdrawn ? '탈퇴한 회원은 당주로 지정할 수 없습니다' : ''}
                                onclick={() => assign(m.mb_id)}
                            >
                                이 회원으로 지정
                            </Button>
                        </li>
                    {/each}
                </ul>
            {/if}
        </div>
    </Dialog.Content>
</Dialog.Root>
