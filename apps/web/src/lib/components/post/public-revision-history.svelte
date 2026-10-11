<script lang="ts">
    /**
     * 공개 수정 이력 — 「수정됨 N회」 버튼과 팝업.
     *
     * - 횟수는 부모가 글·댓글 전체를 한 번에 받아 넘긴다(댓글별 요청 없음).
     *   이력 본문은 버튼을 눌렀을 때 그 글/댓글 하나만 받는다.
     * - 팝업은 bits-ui Dialog — ESC 닫기·포커스 가둠·닫힌 뒤 버튼으로 포커스 복귀.
     * - 본문은 글 본문과 같은 Markdown 렌더(DOMPurify, 이메일 표지 → 「이메일 보기」).
     *   이메일 표지는 웹 서버 프록시가 응답에서 미리 바꿔 둔다(proxy-title-mask).
     * - 바뀐 부분은 평문 줄 단위 비교(revision-diff 재사용).
     * - 운영진(can_hide)에게만 버전별 「숨기기」. 현재 내용은 숨길 수 없다.
     */
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import { Button } from '$lib/components/ui/button/index.js';
    import { Markdown } from '$lib/components/ui/markdown/index.js';
    import RevisionDiff from './revision-diff.svelte';
    import History from '@lucide/svelte/icons/history';
    import { apiClient } from '$lib/api/index.js';
    import type { PublicRevision } from '$lib/api/types.js';
    import { formatDateTime } from '$lib/utils/format-date.js';
    import { revisionPlainText } from '$lib/utils/public-revisions.js';
    import { stripEmailMarkers } from '$lib/utils/email-reveal.js';
    import { toast } from 'svelte-sonner';

    interface Props {
        boardId: string;
        postId: string | number;
        /** 댓글 이력이면 댓글 ID */
        commentId?: string | number;
        /** 부모가 받은 공개 수정 횟수 */
        count: number;
        class?: string;
    }

    let { boardId, postId, commentId, count, class: className = '' }: Props = $props();

    let open = $state(false);
    let loading = $state(false);
    let failed = $state(false);
    let loaded = $state(false);
    let revisions = $state<PublicRevision[]>([]);
    let canHide = $state(false);
    let hidingVersion = $state<number | null>(null);

    const commentKey = $derived(commentId === undefined ? undefined : String(commentId));
    const displayCount = $derived(loaded ? Math.max(revisions.length - 1, 0) : count);
    // 오래된 것 → 현재 순서로 오므로, 화면에는 최신을 위로 뒤집어 보인다.
    const items = $derived(
        revisions
            .map((rev, index) => ({ rev, index, prev: index > 0 ? revisions[index - 1] : null }))
            .reverse()
    );

    async function load(): Promise<void> {
        loading = true;
        failed = false;
        try {
            const res = await apiClient.getPublicRevisions(boardId, String(postId), commentKey);
            revisions = res.revisions;
            canHide = res.canHide;
            loaded = true;
        } catch {
            failed = true;
        } finally {
            loading = false;
        }
    }

    function openDialog(): void {
        open = true;
        if (!loaded && !loading) void load();
    }

    async function hideVersion(version: number): Promise<void> {
        if (hidingVersion !== null) return;
        if (!confirm('이 버전을 숨길까요? 숨긴 버전은 수정 이력에서 누구에게도 보이지 않습니다.')) {
            return;
        }
        hidingVersion = version;
        try {
            await apiClient.hidePublicRevision(boardId, String(postId), version, commentKey);
            toast.success('버전을 숨겼습니다.');
            await load();
        } catch (err) {
            toast.error(err instanceof Error && err.message ? err.message : '숨기지 못했습니다.');
        } finally {
            hidingVersion = null;
        }
    }

    function plainTitle(title: string | undefined): string {
        return stripEmailMarkers(title ?? '');
    }
</script>

{#if displayCount > 0 || open}
    <button
        type="button"
        class="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-0.5 rounded-sm underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 {className}"
        aria-haspopup="dialog"
        title="수정 이력 보기"
        onclick={openDialog}
    >
        <History class="size-3" aria-hidden="true" />
        수정됨 {displayCount}회
    </button>
{/if}

<Dialog.Root bind:open>
    <Dialog.Content
        class="flex max-h-[85vh] w-full max-w-[calc(100%-1rem)] flex-col gap-3 overflow-hidden p-4 sm:max-w-2xl sm:p-6"
    >
        <Dialog.Header>
            <Dialog.Title>수정 이력</Dialog.Title>
            <Dialog.Description class="sr-only">버전별 내용과 바뀐 부분</Dialog.Description>
        </Dialog.Header>

        <div class="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 [overflow-wrap:anywhere]">
            {#if loading && !loaded}
                <p class="text-muted-foreground py-6 text-center text-sm" role="status">
                    불러오는 중…
                </p>
            {:else if failed}
                <div class="py-6 text-center text-sm">
                    <p class="text-muted-foreground mb-3">수정 이력을 불러오지 못했습니다.</p>
                    <Button variant="outline" size="sm" onclick={() => load()}>다시 시도</Button>
                </div>
            {:else if revisions.length === 0}
                <p class="text-muted-foreground py-6 text-center text-sm">
                    표시할 수정 이력이 없습니다.
                </p>
            {:else}
                <ol class="space-y-4">
                    {#each items as { rev, index, prev } (rev.current ? 'current' : rev.version)}
                        <li class="min-w-0 rounded-md border p-3">
                            <div class="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span class="text-sm font-semibold">
                                    버전 {index + 1}{rev.current ? ' · 현재' : ''}
                                </span>
                                {#if rev.edited_at}
                                    <time
                                        class="text-muted-foreground text-xs"
                                        datetime={rev.edited_at}
                                    >
                                        {formatDateTime(rev.edited_at)}
                                    </time>
                                {/if}
                                {#if canHide && !rev.current}
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="ml-auto h-7 px-2 text-xs"
                                        disabled={hidingVersion !== null}
                                        onclick={() => hideVersion(rev.version)}
                                    >
                                        {hidingVersion === rev.version ? '숨기는 중…' : '숨기기'}
                                    </Button>
                                {/if}
                            </div>

                            {#if prev && rev.title !== undefined && prev.title !== rev.title}
                                <p class="mb-2 text-xs">
                                    <span class="text-muted-foreground">제목:</span>
                                    <del class="text-red-700 dark:text-red-300"
                                        >{plainTitle(prev.title)}</del
                                    >
                                    →
                                    <ins class="text-green-700 no-underline dark:text-green-300"
                                        >{plainTitle(rev.title)}</ins
                                    >
                                </p>
                            {/if}

                            {#if prev}
                                <RevisionDiff
                                    oldText={revisionPlainText(prev.content)}
                                    newText={revisionPlainText(rev.content)}
                                    oldLabel="이전 버전"
                                    newLabel="이 버전"
                                />
                                <details class="mt-2">
                                    <summary
                                        class="text-muted-foreground hover:text-foreground cursor-pointer text-xs"
                                    >
                                        이 버전 전체 내용 보기
                                    </summary>
                                    <div class="mt-2 text-sm">
                                        <Markdown
                                            content={rev.content}
                                            enableEmbed={false}
                                            showLinkWarning={false}
                                        />
                                    </div>
                                </details>
                            {:else}
                                {#if rev.title}
                                    <p class="mb-1 text-sm font-medium">{plainTitle(rev.title)}</p>
                                {/if}
                                <div class="text-sm">
                                    <Markdown
                                        content={rev.content}
                                        enableEmbed={false}
                                        showLinkWarning={false}
                                    />
                                </div>
                            {/if}
                        </li>
                    {/each}
                </ol>
            {/if}
        </div>
    </Dialog.Content>
</Dialog.Root>
