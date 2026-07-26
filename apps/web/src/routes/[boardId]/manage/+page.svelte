<script lang="ts">
    /**
     * 소모임 관리 화면 (당주 콘솔)
     *
     * 권한 판정은 +page.server.ts 가 끝냈다. 여기 도달했다는 것 자체가 권한이 있다는 뜻이라
     * 화면에서 권한으로 무언가를 가리지 않는다 — 가릴 데이터는 애초에 내려오지 않는다.
     */
    import * as Card from '$lib/components/ui/card/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Input } from '$lib/components/ui/input/index.js';
    import { Textarea } from '$lib/components/ui/textarea/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import Pin from '@lucide/svelte/icons/pin';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    let intro = $state(data.intro);
    let categories = $state<string[]>(
        data.categoryList ? data.categoryList.split('|').filter(Boolean) : []
    );
    let newCategory = $state('');
    let saving = $state(false);
    let message = $state('');
    let isError = $state(false);

    const introDirty = $derived(intro.trim() !== data.intro.trim());
    const categoriesDirty = $derived(categories.join('|') !== data.categoryList);

    function notify(text: string, error = false) {
        message = text;
        isError = error;
    }

    async function save(payload: Record<string, unknown>, okText: string) {
        if (saving) return;
        saving = true;
        message = '';
        try {
            const res = await fetch(`/api/boards/${data.boardId}/manage`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body.success) {
                throw new Error(body.error || '저장하지 못했습니다.');
            }
            notify(okText);
        } catch (e) {
            notify(e instanceof Error ? e.message : '저장하지 못했습니다.', true);
        } finally {
            saving = false;
        }
    }

    function addCategory() {
        const name = newCategory.trim();
        if (!name) return;
        if (categories.includes(name)) {
            notify('이미 있는 카테고리입니다.', true);
            return;
        }
        categories = [...categories, name];
        newCategory = '';
    }

    async function unpinNotice(id: number) {
        if (!confirm(`${id}번 글의 공지 고정을 해제할까요?`)) return;
        saving = true;
        try {
            const res = await fetch(`/api/boards/${data.boardId}/posts/${id}/notice`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notice_type: null })
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body.success) throw new Error(body.error || '해제하지 못했습니다.');
            location.reload();
        } catch (e) {
            notify(e instanceof Error ? e.message : '해제하지 못했습니다.', true);
        } finally {
            saving = false;
        }
    }
</script>

<svelte:head><title>{data.subject} 관리</title></svelte:head>

<div class="mx-auto max-w-3xl space-y-4 p-4">
    <div class="flex flex-wrap items-center gap-2">
        <h1 class="text-xl font-semibold">{data.subject} 관리</h1>
        {#if data.isOwner}
            <Badge variant="secondary">당주</Badge>
        {:else if data.isSiteAdmin}
            <Badge variant="outline">운영진</Badge>
        {/if}
        <a href="/{data.boardId}" class="text-primary ml-auto text-sm underline">소모임으로</a>
    </div>

    {#if message}
        <p class="text-sm {isError ? 'text-destructive' : 'text-emerald-600'}">{message}</p>
    {/if}

    <Card.Root>
        <Card.Header>
            <Card.Title class="text-base">활동 현황</Card.Title>
            <Card.Description>최근 30일 기준입니다.</Card.Description>
        </Card.Header>
        <Card.Content>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                    <div class="text-2xl font-semibold">{data.stats.posts30d}</div>
                    <div class="text-muted-foreground text-xs">새 글</div>
                </div>
                <div>
                    <div class="text-2xl font-semibold">{data.stats.comments30d}</div>
                    <div class="text-muted-foreground text-xs">댓글</div>
                </div>
                <div>
                    <div class="text-2xl font-semibold">{data.stats.writers30d}</div>
                    <div class="text-muted-foreground text-xs">참여한 앙님</div>
                </div>
                <div>
                    <div class="text-2xl font-semibold">{data.stats.totalPosts}</div>
                    <div class="text-muted-foreground text-xs">전체 글</div>
                </div>
            </div>
        </Card.Content>
    </Card.Root>

    <Card.Root>
        <Card.Header>
            <Card.Title class="text-base">고정된 공지</Card.Title>
            <Card.Description>
                글 상세에서 공지로 지정할 수 있습니다. 여기서는 해제만 합니다. 고정은 글 제목 옆의 압정을 누르면 됩니다.
            </Card.Description>
        </Card.Header>
        <Card.Content>
            {#if data.notices.length === 0}
                <p class="text-muted-foreground text-sm">고정된 공지가 없습니다.</p>
            {:else}
                <ul class="space-y-1">
                    {#each data.notices as n (n.id)}
                        <li class="flex items-center justify-between gap-2 rounded border p-2">
                            <div class="flex min-w-0 items-center gap-2">
                                <Pin class="h-4 w-4 shrink-0" />
                                {#if n.subject}
                                    <a
                                        href="/{data.boardId}/{n.id}"
                                        class="truncate hover:underline"
                                    >
                                        {n.subject}
                                    </a>
                                {:else}
                                    <span class="text-muted-foreground truncate">
                                        {n.id}번 — 삭제되었거나 찾을 수 없는 글
                                    </span>
                                {/if}
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                disabled={saving}
                                onclick={() => unpinNotice(n.id)}
                            >
                                해제
                            </Button>
                        </li>
                    {/each}
                </ul>
            {/if}
        </Card.Content>
    </Card.Root>

    <Card.Root>
        <Card.Header>
            <Card.Title class="text-base">소모임 소개</Card.Title>
            <Card.Description>어떤 소모임인지 알려주세요. 최대 2,000자입니다.</Card.Description>
        </Card.Header>
        <Card.Content class="space-y-2">
            <Textarea rows={5} bind:value={intro} placeholder="소모임 소개를 적어주세요." />
            <div class="flex items-center gap-2">
                <Button
                    disabled={saving || !introDirty}
                    onclick={() => save({ intro }, '소개글을 저장했습니다.')}
                >
                    저장
                </Button>
                <span class="text-muted-foreground text-xs">{intro.length} / 2000</span>
            </div>
        </Card.Content>
    </Card.Root>

    <Card.Root>
        <Card.Header>
            <Card.Title class="text-base">카테고리</Card.Title>
            <Card.Description>
                글을 분류합니다. 비우면 카테고리를 쓰지 않습니다. 이미 쓰인 카테고리를 지워도 <b
                    >글은 지워지지 않습니다.</b
                >
            </Card.Description>
        </Card.Header>
        <Card.Content class="space-y-2">
            <div class="flex flex-wrap gap-1">
                {#each categories as c, i (c)}
                    <Badge variant="secondary" class="gap-1">
                        {c}
                        <button
                            type="button"
                            aria-label={`${c} 삭제`}
                            class="hover:text-destructive"
                            onclick={() => (categories = categories.filter((_, idx) => idx !== i))}
                            >×</button
                        >
                    </Badge>
                {/each}
                {#if categories.length === 0}
                    <span class="text-muted-foreground text-sm">카테고리 없음</span>
                {/if}
            </div>
            <form
                class="flex gap-2"
                onsubmit={(e) => {
                    e.preventDefault();
                    addCategory();
                }}
            >
                <Input class="max-w-xs" placeholder="카테고리 이름" bind:value={newCategory} />
                <Button type="submit" variant="outline">추가</Button>
            </form>
            <Button
                disabled={saving || !categoriesDirty}
                onclick={() => save({ categories }, '카테고리를 저장했습니다.')}
            >
                저장
            </Button>
        </Card.Content>
    </Card.Root>
</div>
