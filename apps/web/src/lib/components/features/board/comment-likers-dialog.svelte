<script lang="ts">
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import type { LikerInfo } from '$lib/api/types.js';
    import { getMemberIconUrl } from '$lib/utils/member-icon.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
    import { memberLevelStore } from '$lib/stores/member-levels.svelte.js';
    import type { Component } from 'svelte';
    import { pluginStore } from '$lib/stores/plugin.svelte';
    import { loadPluginComponent } from '$lib/utils/plugin-optional-loader';

    // 동적 플러그인 임포트: member-memo
    let MemoBadge = $state<Component | null>(null);
    let MemoInlineEditor = $state<Component | null>(null);

    $effect(() => {
        if (pluginStore.isPluginActive('member-memo')) {
            loadPluginComponent('member-memo', 'memo-badge').then((c) => (MemoBadge = c));
            loadPluginComponent('member-memo', 'memo-inline-editor').then((c) => (MemoInlineEditor = c));
        }
    });

    interface Props {
        open: boolean;
        boardId: string;
        postId: number;
        commentId: number | string;
        onClose: () => void;
    }

    let { open = $bindable(), boardId, postId, commentId, onClose }: Props = $props();

    let memoPluginActive = $derived(pluginStore.isPluginActive('member-memo'));
    let editingMemoFor = $state<string | null>(null);

    let likers = $state<LikerInfo[]>([]);
    let total = $state(0);
    let isLoading = $state(false);

    $effect(() => {
        if (open && commentId) {
            void loadLikers();
        }
    });

    async function loadLikers(): Promise<void> {
        isLoading = true;
        try {
            // SvelteKit API 직접 호출 (/api/boards/... — Go 백엔드가 아닌 SvelteKit 라우트)
            const res = await fetch(
                `/api/boards/${boardId}/posts/${postId}/comments/${commentId}/likers?limit=50`
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const data = json.data;
            likers = data.likers ?? [];
            total = data.total ?? 0;
            const likerIds = likers.map((l: LikerInfo) => l.mb_id).filter(Boolean);
            if (likerIds.length > 0) {
                memberLevelStore.fetchLevels(likerIds);
            }
        } catch (err) {
            console.error('Failed to load comment likers:', err);
        } finally {
            isLoading = false;
        }
    }

    function formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
</script>

<Dialog.Root
    bind:open
    onOpenChange={(isOpen) => {
        if (!isOpen) {
            editingMemoFor = null;
            onClose();
        }
    }}
>
    <Dialog.Content class="max-w-md">
        <Dialog.Header>
            <Dialog.Title>추천한 사람들</Dialog.Title>
            <Dialog.Description>
                이 댓글을 추천한 {total}명
            </Dialog.Description>
        </Dialog.Header>
        <div class="max-h-96 overflow-y-auto">
            {#if isLoading}
                <div class="text-muted-foreground py-8 text-center text-sm">불러오는 중...</div>
            {:else if likers.length === 0}
                <div class="text-muted-foreground py-8 text-center text-sm">
                    아직 추천한 사람이 없습니다.
                </div>
            {:else}
                <ul class="divide-border divide-y">
                    {#each likers as liker (liker.mb_id)}
                        <li class="py-3">
                            <div class="flex items-center gap-3">
                                {#if getMemberIconUrl(liker.mb_id)}
                                    <img
                                        src={getMemberIconUrl(liker.mb_id)}
                                        alt={liker.mb_nick || liker.mb_name}
                                        class="size-8 rounded-full object-cover"
                                        onerror={(e) => {
                                            const img = e.currentTarget as HTMLImageElement;
                                            img.style.display = 'none';
                                            const fallback = img.nextElementSibling as HTMLElement;
                                            if (fallback) fallback.style.display = 'flex';
                                        }}
                                    />
                                    <div
                                        class="bg-primary text-primary-foreground hidden size-8 items-center justify-center rounded-full text-sm"
                                    >
                                        {(liker.mb_nick || liker.mb_name).charAt(0).toUpperCase()}
                                    </div>
                                {:else}
                                    <div
                                        class="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full text-sm"
                                    >
                                        {(liker.mb_nick || liker.mb_name).charAt(0).toUpperCase()}
                                    </div>
                                {/if}

                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-1">
                                        <LevelBadge
                                            level={memberLevelStore.getLevel(liker.mb_id)}
                                            size="sm"
                                        />
                                        <a
                                            href="/profile/{liker.mb_id}"
                                            class="text-foreground hover:text-primary truncate text-sm font-medium"
                                        >
                                            {liker.mb_nick || liker.mb_name}
                                        </a>
                                        {#if memoPluginActive && MemoBadge}
                                            <MemoBadge
                                                memberId={liker.mb_id}
                                                showIcon={true}
                                                onclick={() => {
                                                    editingMemoFor =
                                                        editingMemoFor === liker.mb_id
                                                            ? null
                                                            : liker.mb_id;
                                                }}
                                            />
                                        {/if}
                                    </div>
                                    <div class="text-muted-foreground text-xs">
                                        {#if authStore.isAuthenticated && liker.bg_ip}
                                            <span>({liker.bg_ip})</span>
                                            <span class="mx-1">&middot;</span>
                                        {/if}
                                        <span>{formatDate(liker.liked_at)}</span>
                                    </div>
                                </div>

                                <a
                                    href="/search?author_id={liker.mb_id}"
                                    class="text-muted-foreground hover:text-foreground whitespace-nowrap text-xs"
                                >
                                    작성글
                                </a>
                            </div>

                            {#if memoPluginActive && MemoInlineEditor && editingMemoFor === liker.mb_id}
                                <div class="ml-11 mt-2">
                                    <MemoInlineEditor
                                        memberId={liker.mb_id}
                                        onClose={() => {
                                            editingMemoFor = null;
                                        }}
                                    />
                                </div>
                            {/if}
                        </li>
                    {/each}
                </ul>
            {/if}
        </div>
    </Dialog.Content>
</Dialog.Root>
