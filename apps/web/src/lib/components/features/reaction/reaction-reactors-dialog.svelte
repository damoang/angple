<script lang="ts">
    /**
     * 리액션 사용자 목록 다이얼로그 (이모지 닉네임 공개, 2026-07-12 시행).
     * 시행일 이후 리액션만 닉네임이 공개되고, 이전 리액션은 익명 건수로만 표시된다.
     * (공지 free/6678912 — comment-likers-dialog 패턴 재사용)
     */
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import { getAvatarUrl } from '$lib/utils/member-icon.js';
    import { getReactionDisplay } from '$lib/types/reaction.js';
    import { formatDateTime } from '$lib/utils/format-date.js';

    interface ReactorInfo {
        mb_id: string;
        mb_nick: string;
        mb_image?: string;
        mb_image_updated_at?: string;
        reactions: string[];
        reacted_at: string;
    }

    interface Props {
        open: boolean;
        targetId: string;
        onClose: () => void;
    }

    let { open = $bindable(), targetId, onClose }: Props = $props();

    let reactors = $state<ReactorInfo[]>([]);
    let anonymousCount = $state(0);
    let isLoading = $state(false);
    let loadError = $state(false);

    $effect(() => {
        if (open && targetId) {
            void loadReactors();
        }
    });

    async function loadReactors(): Promise<void> {
        isLoading = true;
        loadError = false;
        try {
            const res = await fetch(
                `/api/reactions/reactors?targetId=${encodeURIComponent(targetId)}&limit=100`
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            reactors = json.data?.reactors ?? [];
            anonymousCount = json.data?.anonymousCount ?? 0;
        } catch (err) {
            console.error('Failed to load reactors:', err);
            loadError = true;
        } finally {
            isLoading = false;
        }
    }
</script>

<Dialog.Root
    bind:open
    onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
    }}
>
    <Dialog.Content class="max-w-md">
        <Dialog.Header>
            <Dialog.Title>리액션한 사람들</Dialog.Title>
            <Dialog.Description>
                2026년 7월 12일부터 누른 리액션은 닉네임이 함께 표시됩니다.
            </Dialog.Description>
        </Dialog.Header>

        <div class="max-h-80 space-y-1 overflow-y-auto">
            {#if isLoading}
                <p class="text-muted-foreground py-6 text-center text-sm">불러오는 중…</p>
            {:else if loadError}
                <p class="text-muted-foreground py-6 text-center text-sm">
                    목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
                </p>
            {:else}
                {#each reactors as reactor (reactor.mb_id)}
                    {@const avatar = getAvatarUrl(reactor.mb_image, reactor.mb_image_updated_at)}
                    <div class="hover:bg-muted/50 flex items-center gap-3 rounded-md px-2 py-1.5">
                        {#if avatar}
                            <img
                                src={avatar}
                                alt={reactor.mb_nick}
                                class="h-8 w-8 rounded-full object-cover"
                                loading="lazy"
                            />
                        {:else}
                            <div
                                class="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium"
                            >
                                {reactor.mb_nick.charAt(0)}
                            </div>
                        {/if}
                        <div class="min-w-0 flex-1">
                            <a
                                href={`/member/${reactor.mb_id}`}
                                class="hover:text-primary truncate text-sm font-medium"
                            >
                                {reactor.mb_nick}
                            </a>
                            {#if reactor.reacted_at}
                                <p class="text-muted-foreground text-xs">
                                    {formatDateTime(reactor.reacted_at)}
                                </p>
                            {/if}
                        </div>
                        <!-- 한 회원이 누른 이모지 여러 개를 한 줄에 나열 -->
                        <div class="flex flex-shrink-0 flex-wrap items-center justify-end gap-1">
                            {#each reactor.reactions as reaction (reaction)}
                                {@const display = getReactionDisplay(reaction)}
                                {#if display.renderType === 'image' && display.url}
                                    <img
                                        src={display.url}
                                        alt={display.label}
                                        title={display.label}
                                        class="h-6 w-6 object-scale-down"
                                    />
                                {:else}
                                    <span class="text-lg leading-none" title={display.label}
                                        >{display.emoji}</span
                                    >
                                {/if}
                            {/each}
                        </div>
                    </div>
                {:else}
                    {#if anonymousCount === 0}
                        <p class="text-muted-foreground py-6 text-center text-sm">
                            아직 공개 대상 리액션이 없습니다.
                        </p>
                    {/if}
                {/each}

                {#if anonymousCount > 0}
                    <p class="text-muted-foreground border-t px-2 pb-1 pt-3 text-center text-xs">
                        공개 시행(7월 12일) 이전의 리액션 {anonymousCount}개는 익명으로 유지됩니다.
                    </p>
                {/if}
            {/if}
        </div>
    </Dialog.Content>
</Dialog.Root>
