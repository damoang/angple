<script lang="ts">
    /**
     * 소모임 돌보기 화면 (당주 콘솔)
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
    import EyeOff from '@lucide/svelte/icons/eye-off';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    // ── 임시 조치 (잠시 가려두기) ──
    interface ActionPreview {
        target_id: number;
        post_id: number;
        is_comment: boolean;
        author: string;
        subject: string;
        locked: boolean;
    }
    let actionUrl = $state('');
    let actionReason = $state('');
    let preview = $state<ActionPreview | null>(null);
    let actionBusy = $state(false);

    async function callSupportAction(action: 'preview' | 'lock' | 'unlock', url: string) {
        const res = await fetch(`/api/boards/${data.boardId}/support/actions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, url, reason: actionReason })
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !body.success) {
            throw new Error(body.error || '처리하지 못했습니다.');
        }
        return body.data as ActionPreview;
    }

    async function loadPreview() {
        if (actionBusy || !actionUrl.trim()) return;
        actionBusy = true;
        message = '';
        try {
            preview = await callSupportAction('preview', actionUrl);
        } catch (e) {
            preview = null;
            notify(e instanceof Error ? e.message : '확인하지 못했습니다.', true);
        } finally {
            actionBusy = false;
        }
    }

    async function applyLock() {
        if (actionBusy || !preview) return;
        if (!confirm('이 대상을 잠시 가려둘까요? 삭제가 아니며, 최종 처리는 운영진이 확정합니다.'))
            return;
        actionBusy = true;
        try {
            await callSupportAction('lock', actionUrl);
            notify('가려두었습니다. 운영진이 확인 후 최종 처리합니다.');
            location.reload();
        } catch (e) {
            notify(e instanceof Error ? e.message : '조치하지 못했습니다.', true);
            actionBusy = false;
        }
    }

    async function releaseLock(url: string) {
        if (actionBusy) return;
        if (!confirm('가려둔 것을 해제할까요?')) return;
        actionBusy = true;
        try {
            await callSupportAction('unlock', url);
            notify('해제했습니다.');
            location.reload();
        } catch (e) {
            notify(e instanceof Error ? e.message : '해제하지 못했습니다.', true);
            actionBusy = false;
        }
    }

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

<svelte:head><title>{data.subject} 돌보기</title></svelte:head>

<div class="mx-auto max-w-3xl space-y-4 p-4">
    <div class="flex flex-wrap items-center gap-2">
        <h1 class="text-xl font-semibold">{data.subject} 돌보기</h1>
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
            <Card.Title class="flex items-center gap-2 text-base">
                <EyeOff class="h-4 w-4" /> 잠시 가려두기
            </Card.Title>
            <Card.Description>
                광고·주제와 무관한 글처럼 소모임 취지에 맞지 않는 글이나 댓글의 주소를 붙여넣으면
                잠시 가려집니다. <b>삭제가 아닌 임시 노출 제한</b>이며, 최종 처리는 운영진이
                확정합니다. 모든 조치는 기록에 남습니다.
            </Card.Description>
        </Card.Header>
        <Card.Content class="space-y-3">
            <div class="flex flex-col gap-2 sm:flex-row">
                <Input
                    class="flex-1"
                    placeholder="글 또는 댓글 주소 (예: https://damoang.net/{data.boardId}/12345)"
                    bind:value={actionUrl}
                />
                <Button
                    variant="outline"
                    disabled={actionBusy || !actionUrl.trim()}
                    onclick={loadPreview}
                >
                    확인
                </Button>
            </div>
            {#if preview}
                <div class="space-y-2 rounded border p-3">
                    <div class="flex items-center gap-2 text-sm">
                        <Badge variant="outline">{preview.is_comment ? '댓글' : '글'}</Badge>
                        <span class="min-w-0 truncate font-medium"
                            >{preview.subject || '(제목 없음)'}</span
                        >
                        <span class="text-muted-foreground shrink-0">— {preview.author}</span>
                        {#if preview.locked}
                            <Badge variant="secondary">이미 가려짐</Badge>
                        {/if}
                    </div>
                    {#if !preview.locked}
                        <Input
                            placeholder="사유 (선택, 200자 이내 — 운영진과 기록에 공유됩니다)"
                            maxlength={200}
                            bind:value={actionReason}
                        />
                        <Button disabled={actionBusy} onclick={applyLock}>잠시 가려두기</Button>
                    {/if}
                </div>
            {/if}

            {#if data.supportHistory.length > 0}
                <div class="space-y-1 pt-2">
                    <p class="text-muted-foreground text-xs font-medium">조치 기록</p>
                    <ul class="space-y-1">
                        {#each data.supportHistory as h (h.id)}
                            <li
                                class="flex items-center justify-between gap-2 rounded border p-2 text-sm"
                            >
                                <div class="min-w-0">
                                    <div class="flex items-center gap-2">
                                        <Badge variant={h.active ? 'secondary' : 'outline'}>
                                            {h.action.endsWith('unlock')
                                                ? '해제'
                                                : h.active
                                                  ? '가려둠'
                                                  : '가림(종료)'}
                                        </Badge>
                                        <Badge variant="outline"
                                            >{h.isComment ? '댓글' : '글'}</Badge
                                        >
                                        <a
                                            href={h.url || `/${data.boardId}/${h.wrId}`}
                                            class="min-w-0 truncate hover:underline"
                                        >
                                            {h.subjectText || `${h.wrId}번`}
                                        </a>
                                    </div>
                                    <div class="text-muted-foreground mt-0.5 text-xs">
                                        {h.operatedAt} · {h.operatedBy}
                                        {#if h.reason}
                                            · {h.reason}{/if}
                                    </div>
                                </div>
                                {#if h.active}
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        disabled={actionBusy}
                                        onclick={() =>
                                            releaseLock(h.url || `/${data.boardId}/${h.wrId}`)}
                                    >
                                        해제
                                    </Button>
                                {/if}
                            </li>
                        {/each}
                    </ul>
                </div>
            {/if}
        </Card.Content>
    </Card.Root>

    <Card.Root>
        <Card.Header>
            <Card.Title class="text-base">고정된 공지</Card.Title>
            <Card.Description>
                고정은 글 제목 옆의 압정을 누르면 됩니다. 여기서는 해제만 합니다.
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
            <Card.Title class="text-base">소모임 소개 (상단 꾸미기)</Card.Title>
            <Card.Description>
                게시판 상단(배너 아래)에 모든 방문자에게 보입니다. 최대 10,000자. HTML로 꾸밀 수
                있습니다 — 이미지, 표, 그리고 구글 캘린더 퍼가기(iframe)를 지원합니다. 그 외의
                스크립트·외부 임베드는 저장 시 자동으로 제거됩니다.
            </Card.Description>
        </Card.Header>
        <Card.Content class="space-y-2">
            <Textarea
                rows={8}
                bind:value={intro}
                placeholder={'소모임 소개를 적어주세요. 예)\n<p>매주 수요일 정기 모임!</p>\n<iframe src="https://calendar.google.com/calendar/embed?src=..." width="100%" height="400"></iframe>'}
            />
            <div class="flex items-center gap-2">
                <Button
                    disabled={saving || !introDirty}
                    onclick={() =>
                        save({ intro }, '소개글을 저장했습니다. 게시판 상단에서 확인해 보세요.')}
                >
                    저장
                </Button>
                <span class="text-muted-foreground text-xs">{intro.length} / 10000</span>
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
