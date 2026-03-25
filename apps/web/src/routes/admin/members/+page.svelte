<script lang="ts">
    /**
     * 관리자 회원 관리 페이지
     * 회원 목록 + 검색/필터/레벨 변경/차단
     */
    import { onMount } from 'svelte';
    import * as Card from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Label } from '$lib/components/ui/label/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { Textarea } from '$lib/components/ui/textarea/index.js';
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import { Checkbox } from '$lib/components/ui/checkbox/index.js';
    import Users from '@lucide/svelte/icons/users';
    import Search from '@lucide/svelte/icons/search';
    import Pencil from '@lucide/svelte/icons/pencil';
    import Ban from '@lucide/svelte/icons/ban';
    import ShieldCheck from '@lucide/svelte/icons/shield-check';
    import ChevronLeft from '@lucide/svelte/icons/chevron-left';
    import ChevronRight from '@lucide/svelte/icons/chevron-right';
    import ChevronDown from '@lucide/svelte/icons/chevron-down';
    import ChevronUp from '@lucide/svelte/icons/chevron-up';
    import Filter from '@lucide/svelte/icons/filter';
    import Loader2 from '@lucide/svelte/icons/loader-2';
    import {
        listMembers,
        updateMember,
        banMember,
        unbanMember,
        anonymizeMemberByUsername,
        bulkUpdateLevel,
        type AdminMember,
        type MemberListParams,
        type AnonymizeMemberResult
    } from '$lib/api/admin-members';

    let members = $state<AdminMember[]>([]);
    let total = $state(0);
    let loading = $state(true);
    let currentPage = $state(1);
    const pageSize = 20;

    // 검색/필터
    let searchQuery = $state('');
    let searchField = $state<'name' | 'email' | 'id'>('name');
    let levelFilter = $state<number | undefined>(undefined);
    let sortBy = $state<'datetime' | 'name' | 'level' | 'point'>('datetime');
    let sortOrder = $state<'asc' | 'desc'>('desc');
    let statusFilter = $state<'active' | 'banned' | 'left' | undefined>(undefined);
    let dateFrom = $state('');
    let dateTo = $state('');
    let pointMin = $state('');
    let pointMax = $state('');
    let loginFrom = $state('');
    let loginTo = $state('');
    let showAdvancedFilter = $state(false);

    // 선택
    let selectedIds = $state<Set<string>>(new Set());
    const allSelected = $derived(
        members.length > 0 && members.every((m) => selectedIds.has(m.mb_id))
    );

    // 수정 다이얼로그
    let showEditDialog = $state(false);
    let editingMember = $state<AdminMember | null>(null);
    let editLevel = $state(1);
    let editPoint = $state(0);
    let saving = $state(false);
    let anonymizing = $state(false);

    // 일괄 레벨 변경
    let showBulkDialog = $state(false);
    let bulkLevel = $state(1);

    // 익명화 다이얼로그
    let showAnonymizeDialog = $state(false);
    let anonymizeMember = $state<AdminMember | null>(null);
    let anonymizeReplacementNickname = $state('탈퇴사용자');
    let anonymizeTargetsText = $state('');
    let anonymizeSearchTextsText = $state('');
    let anonymizeResult = $state<AnonymizeMemberResult | null>(null);

    const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

    async function fetchMembers() {
        loading = true;
        try {
            const params: MemberListParams = {
                page: currentPage,
                limit: pageSize,
                sortBy,
                sortOrder
            };
            if (searchQuery.trim()) {
                params.search = searchQuery.trim();
                params.searchField = searchField;
            }
            if (levelFilter !== undefined) {
                params.level = levelFilter;
            }
            if (statusFilter) {
                params.status = statusFilter;
            }
            if (dateFrom) params.dateFrom = dateFrom;
            if (dateTo) params.dateTo = dateTo;
            if (pointMin) params.pointMin = Number(pointMin);
            if (pointMax) params.pointMax = Number(pointMax);
            if (loginFrom) params.loginFrom = loginFrom;
            if (loginTo) params.loginTo = loginTo;
            const result = await listMembers(params);
            members = result.members;
            total = result.total;
        } catch {
            members = [];
            total = 0;
        } finally {
            loading = false;
        }
    }

    function handleSearch() {
        currentPage = 1;
        selectedIds = new Set();
        fetchMembers();
    }

    function goToPage(page: number) {
        if (page < 1 || page > totalPages) return;
        currentPage = page;
        selectedIds = new Set();
        fetchMembers();
    }

    function toggleSelect(memberId: string) {
        const next = new Set(selectedIds);
        if (next.has(memberId)) {
            next.delete(memberId);
        } else {
            next.add(memberId);
        }
        selectedIds = next;
    }

    function toggleSelectAll() {
        if (allSelected) {
            selectedIds = new Set();
        } else {
            selectedIds = new Set(members.map((m) => m.mb_id));
        }
    }

    function openEditDialog(member: AdminMember) {
        editingMember = member;
        editLevel = member.mb_level;
        editPoint = member.mb_point;
        showEditDialog = true;
    }

    async function handleSaveEdit() {
        if (!editingMember) return;
        saving = true;
        try {
            await updateMember(editingMember.mb_id, {
                mb_level: editLevel,
                mb_point: editPoint
            });
            showEditDialog = false;
            await fetchMembers();
        } catch (err) {
            alert(err instanceof Error ? err.message : '저장에 실패했습니다.');
        } finally {
            saving = false;
        }
    }

    async function handleBan(member: AdminMember) {
        const isBanned = !!member.mb_intercept_date;
        const action = isBanned ? '차단 해제' : '차단';
        if (!confirm(`"${member.mb_name}" (${member.mb_id})님을 ${action}하시겠습니까?`)) return;
        try {
            if (isBanned) {
                await unbanMember(member.mb_id);
            } else {
                await banMember(member.mb_id);
            }
            await fetchMembers();
        } catch (err) {
            alert(err instanceof Error ? err.message : `${action}에 실패했습니다.`);
        }
    }

    async function handleBulkLevel() {
        if (selectedIds.size === 0) return;
        saving = true;
        try {
            await bulkUpdateLevel([...selectedIds], bulkLevel);
            showBulkDialog = false;
            selectedIds = new Set();
            await fetchMembers();
        } catch (err) {
            alert(err instanceof Error ? err.message : '일괄 변경에 실패했습니다.');
        } finally {
            saving = false;
        }
    }

    function openAnonymizeDialog(member: AdminMember) {
        anonymizeMember = member;
        anonymizeReplacementNickname = '탈퇴사용자';
        anonymizeTargetsText = '';
        anonymizeSearchTextsText = member.mb_name || '';
        anonymizeResult = null;
        showAnonymizeDialog = true;
    }

    function parseMultilineInput(value: string): string[] {
        return value
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0);
    }

    async function handleAnonymize() {
        if (!anonymizeMember) return;
        const targets = parseMultilineInput(anonymizeTargetsText);
        const searchTexts = parseMultilineInput(anonymizeSearchTextsText);
        if (targets.length === 0) {
            alert('치환할 URL을 한 줄에 하나씩 입력해 주세요.');
            return;
        }
        if (
            !confirm(
                `"${anonymizeMember.mb_name}" (${anonymizeMember.mb_id}) 회원의 지정 URL을 익명화하시겠습니까?\n백업 후 치환됩니다.`
            )
        ) {
            return;
        }

        anonymizing = true;
        anonymizeResult = null;
        try {
            anonymizeResult = await anonymizeMemberByUsername(anonymizeMember.mb_id, {
                replacementNickname: anonymizeReplacementNickname,
                targets,
                searchTexts
            });
            await fetchMembers();
        } catch (err) {
            alert(err instanceof Error ? err.message : '익명화에 실패했습니다.');
        } finally {
            anonymizing = false;
        }
    }

    function getLevelBadge(level: number) {
        if (level >= 10) return { label: '관리자', variant: 'destructive' as const };
        if (level >= 5) return { label: `Lv.${level}`, variant: 'default' as const };
        return { label: `Lv.${level}`, variant: 'secondary' as const };
    }

    function formatDate(dateStr?: string): string {
        if (!dateStr) return '-';
        try {
            return new Date(dateStr).toLocaleDateString('ko-KR');
        } catch {
            return dateStr;
        }
    }

    onMount(() => {
        fetchMembers();
    });
</script>

<svelte:head>
    <title>회원 관리 - Angple Admin</title>
</svelte:head>

<div class="mx-auto max-w-6xl space-y-6 p-6">
    <div class="flex items-center justify-between">
        <div>
            <h1 class="text-2xl font-bold">회원 관리</h1>
            <p class="text-muted-foreground text-sm">
                회원 정보를 관리하고 권한을 설정합니다.
                {#if total > 0}
                    <span class="font-medium">총 {total.toLocaleString()}명</span>
                {/if}
            </p>
        </div>
        {#if selectedIds.size > 0}
            <Button onclick={() => (showBulkDialog = true)}>
                선택 {selectedIds.size}명 레벨 변경
            </Button>
        {/if}
    </div>

    <!-- 검색 & 필터 -->
    <Card.Root>
        <Card.Content class="p-4">
            <form
                class="flex flex-wrap items-end gap-3"
                onsubmit={(e) => {
                    e.preventDefault();
                    handleSearch();
                }}
            >
                <div class="flex-1">
                    <div class="relative">
                        <Search
                            class="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                        />
                        <Input bind:value={searchQuery} placeholder="회원 검색..." class="pl-9" />
                    </div>
                </div>
                <select
                    bind:value={searchField}
                    class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                >
                    <option value="name">이름</option>
                    <option value="email">이메일</option>
                    <option value="id">아이디</option>
                </select>
                <select
                    bind:value={levelFilter}
                    onchange={() => handleSearch()}
                    class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                >
                    <option value={undefined}>전체 레벨</option>
                    {#each Array.from({ length: 10 }, (_, i) => i + 1) as level}
                        <option value={level}>Lv.{level}</option>
                    {/each}
                </select>
                <Button type="submit">검색</Button>
                <Button
                    variant="outline"
                    type="button"
                    onclick={() => (showAdvancedFilter = !showAdvancedFilter)}
                >
                    <Filter class="mr-1 h-4 w-4" />
                    필터
                    {#if showAdvancedFilter}
                        <ChevronUp class="ml-1 h-3 w-3" />
                    {:else}
                        <ChevronDown class="ml-1 h-3 w-3" />
                    {/if}
                </Button>
            </form>

            {#if showAdvancedFilter}
                <div
                    class="mt-3 grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-3 lg:grid-cols-4"
                >
                    <div>
                        <Label class="text-muted-foreground mb-1 text-xs">상태</Label>
                        <select
                            bind:value={statusFilter}
                            onchange={() => handleSearch()}
                            class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        >
                            <option value={undefined}>전체</option>
                            <option value="active">정상</option>
                            <option value="banned">차단</option>
                            <option value="left">탈퇴</option>
                        </select>
                    </div>
                    <div>
                        <Label class="text-muted-foreground mb-1 text-xs">가입일 (시작)</Label>
                        <Input
                            type="date"
                            bind:value={dateFrom}
                            onchange={() => handleSearch()}
                            class="h-9"
                        />
                    </div>
                    <div>
                        <Label class="text-muted-foreground mb-1 text-xs">가입일 (종료)</Label>
                        <Input
                            type="date"
                            bind:value={dateTo}
                            onchange={() => handleSearch()}
                            class="h-9"
                        />
                    </div>
                    <div>
                        <Label class="text-muted-foreground mb-1 text-xs">정렬</Label>
                        <select
                            bind:value={sortBy}
                            onchange={() => handleSearch()}
                            class="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        >
                            <option value="datetime">가입일</option>
                            <option value="login">최근 로그인</option>
                            <option value="name">이름</option>
                            <option value="level">레벨</option>
                            <option value="point">포인트</option>
                        </select>
                    </div>
                    <div>
                        <Label class="text-muted-foreground mb-1 text-xs">포인트 (최소)</Label>
                        <Input
                            type="number"
                            bind:value={pointMin}
                            onchange={() => handleSearch()}
                            placeholder="0"
                            class="h-9"
                        />
                    </div>
                    <div>
                        <Label class="text-muted-foreground mb-1 text-xs">포인트 (최대)</Label>
                        <Input
                            type="number"
                            bind:value={pointMax}
                            onchange={() => handleSearch()}
                            placeholder="∞"
                            class="h-9"
                        />
                    </div>
                    <div>
                        <Label class="text-muted-foreground mb-1 text-xs">최근 로그인 (시작)</Label>
                        <Input
                            type="date"
                            bind:value={loginFrom}
                            onchange={() => handleSearch()}
                            class="h-9"
                        />
                    </div>
                    <div>
                        <Label class="text-muted-foreground mb-1 text-xs">최근 로그인 (종료)</Label>
                        <Input
                            type="date"
                            bind:value={loginTo}
                            onchange={() => handleSearch()}
                            class="h-9"
                        />
                    </div>
                </div>
            {/if}
        </Card.Content>
    </Card.Root>

    {#if loading}
        <div class="flex items-center justify-center py-12">
            <Loader2 class="text-muted-foreground h-6 w-6 animate-spin" />
            <span class="text-muted-foreground ml-2 text-sm">로딩 중...</span>
        </div>
    {:else if members.length === 0}
        <Card.Root>
            <Card.Content class="flex flex-col items-center justify-center py-12">
                <Users class="text-muted-foreground mb-4 h-12 w-12" />
                {#if searchQuery}
                    <p class="text-muted-foreground mb-2">검색 결과가 없습니다.</p>
                    <Button
                        variant="outline"
                        onclick={() => {
                            searchQuery = '';
                            handleSearch();
                        }}
                    >
                        검색 초기화
                    </Button>
                {:else}
                    <p class="text-muted-foreground">등록된 회원이 없습니다.</p>
                {/if}
            </Card.Content>
        </Card.Root>
    {:else}
        <!-- 회원 테이블 -->
        <Card.Root>
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b">
                            <th class="p-3 text-left">
                                <Checkbox
                                    checked={allSelected}
                                    onCheckedChange={() => toggleSelectAll()}
                                />
                            </th>
                            <th class="p-3 text-left font-medium">회원</th>
                            <th class="p-3 text-center font-medium">레벨</th>
                            <th class="p-3 text-center font-medium">포인트</th>
                            <th class="p-3 text-center font-medium">가입일</th>
                            <th class="p-3 text-center font-medium">최근 로그인</th>
                            <th class="p-3 text-center font-medium">상태</th>
                            <th class="p-3 text-right font-medium">관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each members as member (member.mb_id)}
                            {@const badge = getLevelBadge(member.mb_level)}
                            <tr class="hover:bg-muted/50 border-b transition-colors">
                                <td class="p-3">
                                    <Checkbox
                                        checked={selectedIds.has(member.mb_id)}
                                        onCheckedChange={() => toggleSelect(member.mb_id)}
                                    />
                                </td>
                                <td class="p-3">
                                    <div class="flex items-center gap-3">
                                        <div
                                            class="bg-muted flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium"
                                        >
                                            {member.mb_name.charAt(0)}
                                        </div>
                                        <div>
                                            <div class="font-medium">{member.mb_name}</div>
                                            <div class="text-muted-foreground text-xs">
                                                {member.mb_email}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td class="p-3 text-center">
                                    <Badge variant={badge.variant} class="text-xs">
                                        {badge.label}
                                    </Badge>
                                </td>
                                <td class="p-3 text-center">
                                    {member.mb_point.toLocaleString()}
                                </td>
                                <td class="text-muted-foreground p-3 text-center text-xs">
                                    {formatDate(member.mb_datetime)}
                                </td>
                                <td class="text-muted-foreground p-3 text-center text-xs">
                                    {formatDate(member.mb_today_login)}
                                </td>
                                <td class="p-3 text-center">
                                    {#if member.mb_intercept_date}
                                        <Badge variant="destructive" class="text-xs">차단</Badge>
                                    {:else if member.mb_leave_date}
                                        <Badge variant="outline" class="text-xs">탈퇴</Badge>
                                    {:else}
                                        <Badge variant="secondary" class="text-xs">정상</Badge>
                                    {/if}
                                </td>
                                <td class="p-3 text-right">
                                    <div class="flex justify-end gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onclick={() => openEditDialog(member)}
                                            title="수정"
                                        >
                                            <Pencil class="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onclick={() => handleBan(member)}
                                            title={member.mb_intercept_date ? '차단 해제' : '차단'}
                                        >
                                            {#if member.mb_intercept_date}
                                                <ShieldCheck class="h-4 w-4 text-green-600" />
                                            {:else}
                                                <Ban class="h-4 w-4 text-red-500" />
                                            {/if}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onclick={() => openAnonymizeDialog(member)}
                                            title="익명화"
                                        >
                                            <Users class="h-4 w-4 text-amber-600" />
                                        </Button>
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </Card.Root>

        <!-- 페이지네이션 -->
        {#if totalPages > 1}
            <div class="flex items-center justify-between">
                <p class="text-muted-foreground text-sm">
                    {(currentPage - 1) * pageSize + 1}~{Math.min(currentPage * pageSize, total)} / {total.toLocaleString()}명
                </p>
                <div class="flex items-center gap-1">
                    <Button
                        variant="outline"
                        size="icon"
                        onclick={() => goToPage(currentPage - 1)}
                        disabled={currentPage <= 1}
                    >
                        <ChevronLeft class="h-4 w-4" />
                    </Button>
                    {#each Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                        return start + i;
                    }).filter((p) => p <= totalPages) as page}
                        <Button
                            variant={page === currentPage ? 'default' : 'outline'}
                            size="icon"
                            onclick={() => goToPage(page)}
                        >
                            {page}
                        </Button>
                    {/each}
                    <Button
                        variant="outline"
                        size="icon"
                        onclick={() => goToPage(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                    >
                        <ChevronRight class="h-4 w-4" />
                    </Button>
                </div>
            </div>
        {/if}
    {/if}
</div>

<!-- 회원 수정 다이얼로그 -->
<Dialog.Root bind:open={showEditDialog}>
    <Dialog.Content class="sm:max-w-md">
        <Dialog.Header>
            <Dialog.Title>회원 수정</Dialog.Title>
            <Dialog.Description>
                {editingMember?.mb_name} ({editingMember?.mb_id})
            </Dialog.Description>
        </Dialog.Header>
        <form
            class="space-y-4"
            onsubmit={(e) => {
                e.preventDefault();
                handleSaveEdit();
            }}
        >
            <div class="grid gap-2">
                <Label for="edit-level">레벨</Label>
                <Input
                    id="edit-level"
                    type="number"
                    min="1"
                    max="10"
                    bind:value={editLevel}
                    disabled={saving}
                />
                <p class="text-muted-foreground text-xs">1~9: 일반 회원, 10: 관리자</p>
            </div>
            <div class="grid gap-2">
                <Label for="edit-point">포인트</Label>
                <Input id="edit-point" type="number" bind:value={editPoint} disabled={saving} />
            </div>
            <Dialog.Footer>
                <Button
                    variant="outline"
                    type="button"
                    onclick={() => (showEditDialog = false)}
                    disabled={saving}
                >
                    취소
                </Button>
                <Button type="submit" disabled={saving}>
                    {saving ? '저장 중...' : '저장'}
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

<!-- 일괄 레벨 변경 다이얼로그 -->
<Dialog.Root bind:open={showBulkDialog}>
    <Dialog.Content class="sm:max-w-sm">
        <Dialog.Header>
            <Dialog.Title>일괄 레벨 변경</Dialog.Title>
            <Dialog.Description>
                선택한 {selectedIds.size}명의 레벨을 변경합니다.
            </Dialog.Description>
        </Dialog.Header>
        <form
            class="space-y-4"
            onsubmit={(e) => {
                e.preventDefault();
                handleBulkLevel();
            }}
        >
            <div class="grid gap-2">
                <Label for="bulk-level">변경할 레벨</Label>
                <Input
                    id="bulk-level"
                    type="number"
                    min="1"
                    max="10"
                    bind:value={bulkLevel}
                    disabled={saving}
                />
            </div>
            <Dialog.Footer>
                <Button
                    variant="outline"
                    type="button"
                    onclick={() => (showBulkDialog = false)}
                    disabled={saving}
                >
                    취소
                </Button>
                <Button type="submit" disabled={saving}>
                    {saving ? '변경 중...' : '변경'}
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>

<!-- 회원 익명화 다이얼로그 -->
<Dialog.Root bind:open={showAnonymizeDialog}>
    <Dialog.Content class="sm:max-w-2xl">
        <Dialog.Header>
            <Dialog.Title>회원 익명화</Dialog.Title>
            <Dialog.Description>
                {anonymizeMember?.mb_name} ({anonymizeMember?.mb_id})의 지정 URL을 백업 후
                익명화합니다.
            </Dialog.Description>
        </Dialog.Header>
        <form
            class="space-y-4"
            onsubmit={(e) => {
                e.preventDefault();
                handleAnonymize();
            }}
        >
            <div class="grid gap-2">
                <Label for="replacement-nickname">노출 닉네임</Label>
                <Input
                    id="replacement-nickname"
                    bind:value={anonymizeReplacementNickname}
                    disabled={anonymizing}
                    placeholder="탈퇴사용자"
                />
                <p class="text-muted-foreground text-xs">
                    비워두면 기본값 `탈퇴사용자`가 사용됩니다.
                </p>
            </div>

            <div class="grid gap-2">
                <Label for="anonymize-urls">대상 URL</Label>
                <Textarea
                    id="anonymize-urls"
                    bind:value={anonymizeTargetsText}
                    disabled={anonymizing}
                    rows={8}
                    placeholder={'https://damoang.net/free/5936618\nhttps://damoang.net/free/5915381#c_5942893'}
                />
                <p class="text-muted-foreground text-xs">
                    여러 줄 입력 가능. URL 한 줄당 1개씩 입력하세요.
                </p>
            </div>

            <div class="grid gap-2">
                <Label for="anonymize-search-texts">치환할 문자열</Label>
                <Textarea
                    id="anonymize-search-texts"
                    bind:value={anonymizeSearchTextsText}
                    disabled={anonymizing}
                    rows={4}
                    placeholder={'전동운\n기타 노출 닉네임'}
                />
                <p class="text-muted-foreground text-xs">
                    여러 줄 입력 가능. 비워두면 현재 회원명이 기본 치환 대상으로 포함됩니다.
                </p>
            </div>

            {#if anonymizeResult}
                <div class="bg-muted/40 space-y-2 rounded-lg border p-4 text-sm">
                    <div class="font-medium">실행 결과</div>
                    <div>내부 식별: {anonymizeResult.member_id} / {anonymizeResult.username}</div>
                    <div>
                        처리: 수정 {anonymizeResult.updated_rows.length}건, 건너뜀 {anonymizeResult
                            .skipped_rows.length}건
                    </div>
                    <div class="break-all text-xs text-slate-600">
                        백업: {anonymizeResult.backup_file}
                    </div>
                    <div class="break-all text-xs text-slate-600">
                        매니페스트: {anonymizeResult.manifest_file}
                    </div>
                </div>
            {/if}

            <Dialog.Footer>
                <Button
                    variant="outline"
                    type="button"
                    onclick={() => (showAnonymizeDialog = false)}
                    disabled={anonymizing}
                >
                    취소
                </Button>
                <Button type="submit" disabled={anonymizing}>
                    {anonymizing ? '익명화 중...' : '백업 후 익명화'}
                </Button>
            </Dialog.Footer>
        </form>
    </Dialog.Content>
</Dialog.Root>
