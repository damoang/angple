<script lang="ts">
    import * as Dialog from '$lib/components/ui/dialog/index.js';
    import { getAvatarUrl } from '$lib/utils/member-icon.js';
    import { LevelBadge } from '$lib/components/ui/level-badge/index.js';
    import { formatDate } from '$lib/utils/format-date.js';

    interface FollowMember {
        mb_id: string;
        mb_nick: string;
        mb_image: string;
        mb_image_updated_at?: string;
        mb_level: number;
        followed_at: string;
    }

    interface Props {
        open: boolean;
        memberId: string;
        type: 'followers' | 'following';
        onClose: () => void;
    }

    let { open = $bindable(), memberId, type, onClose }: Props = $props();

    let members = $state<FollowMember[]>([]);
    let total = $state(0);
    let isLoading = $state(false);

    $effect(() => {
        if (open && memberId) {
            void loadMembers();
        }
    });

    async function loadMembers(): Promise<void> {
        isLoading = true;
        try {
            const res = await fetch(`/api/members/${memberId}/${type}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            const data = json.data;
            members = data[type === 'followers' ? 'followers' : 'following'] ?? [];
            total = data.total ?? 0;
        } catch (err) {
            console.error(`Failed to load ${type}:`, err);
        } finally {
            isLoading = false;
        }
    }

    const title = $derived(type === 'followers' ? '팔로워' : '팔로잉');
</script>

<Dialog.Root
    bind:open
    onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
    }}
>
    <Dialog.Content class="max-w-md">
        <Dialog.Header>
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Description>
                {total}명
            </Dialog.Description>
        </Dialog.Header>
        <div class="max-h-96 overflow-y-auto">
            {#if isLoading}
                <div class="text-muted-foreground py-8 text-center text-sm">불러오는 중...</div>
            {:else if members.length === 0}
                <div class="text-muted-foreground py-8 text-center text-sm">
                    {type === 'followers' ? '아직 팔로워가 없습니다.' : '아직 팔로잉이 없습니다.'}
                </div>
            {:else}
                <ul class="divide-border divide-y">
                    {#each members as member (member.mb_id)}
                        {@const avatarUrl = getAvatarUrl(
                            member.mb_image,
                            member.mb_image_updated_at
                        )}
                        <li class="py-3">
                            <div class="flex items-center gap-3">
                                {#if avatarUrl}
                                    <img
                                        src={avatarUrl}
                                        alt={member.mb_nick}
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
                                        {member.mb_nick.charAt(0).toUpperCase()}
                                    </div>
                                {:else}
                                    <div
                                        class="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full text-sm"
                                    >
                                        {member.mb_nick.charAt(0).toUpperCase()}
                                    </div>
                                {/if}

                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-1">
                                        <LevelBadge level={member.mb_level} size="sm" />
                                        <a
                                            href="/member/{member.mb_id}"
                                            class="text-foreground hover:text-primary truncate text-sm font-medium"
                                        >
                                            {member.mb_nick}
                                        </a>
                                    </div>
                                    <div class="text-muted-foreground text-xs">
                                        {formatDate(member.followed_at)}
                                    </div>
                                </div>

                                <a
                                    href="/search?author_id={member.mb_id}"
                                    class="text-muted-foreground hover:text-foreground whitespace-nowrap text-xs"
                                >
                                    작성글
                                </a>
                            </div>
                        </li>
                    {/each}
                </ul>
            {/if}
        </div>
    </Dialog.Content>
</Dialog.Root>
