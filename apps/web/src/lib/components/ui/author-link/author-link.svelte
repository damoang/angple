<script lang="ts">
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { goto } from '$app/navigation';
    import { apiClient } from '$lib/api/index.js';
    import User from '@lucide/svelte/icons/user';
    import FileText from '@lucide/svelte/icons/file-text';
    import Mail from '@lucide/svelte/icons/mail';
    import Ban from '@lucide/svelte/icons/ban';
    import UserPlus from '@lucide/svelte/icons/user-plus';
    import UserMinus from '@lucide/svelte/icons/user-minus';
    import { canUseCertifiedAction, goToCertification } from '$lib/utils/certification-gate.js';
    import type { Snippet } from 'svelte';

    interface Props {
        authorId: string;
        authorName: string;
        class?: string;
        children?: Snippet;
    }

    let { authorId, authorName, class: className = '', children }: Props = $props();

    const isOwnProfile = $derived(authStore.user?.mb_id === authorId);

    // 팔로우 상태 (드롭다운 열릴 때 조회)
    let isFollowing = $state(false);
    let followLoading = $state(false);
    let followChecked = $state(false);

    async function checkFollowStatus(): Promise<void> {
        if (!authStore.isAuthenticated || isOwnProfile || followChecked) return;
        try {
            const res = await fetch(`/api/members/${authorId}/follow`);
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    isFollowing = data.data.is_following;
                }
            }
        } catch {
            // 조회 실패 시 무시
        }
        followChecked = true;
    }

    async function handleFollow(): Promise<void> {
        if (!authStore.isAuthenticated) {
            authStore.redirectToLogin();
            return;
        }
        followLoading = true;
        try {
            const method = isFollowing ? 'DELETE' : 'POST';
            const res = await fetch(`/api/members/${authorId}/follow`, { method });
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    isFollowing = data.data.is_following;
                }
            }
        } catch {
            // 실패 시 무시
        } finally {
            followLoading = false;
        }
    }

    async function handleBlock(): Promise<void> {
        if (!authStore.isAuthenticated) {
            authStore.redirectToLogin();
            return;
        }
        if (!confirm(`${authorName}님을 차단하시겠습니까?`)) return;
        try {
            await apiClient.blockMember(authorId);
            alert(`${authorName}님을 차단했습니다.`);
        } catch {
            alert('차단 처리에 실패했습니다.');
        }
    }

    function handleMessage(): void {
        if (!authStore.isAuthenticated) {
            authStore.redirectToLogin();
            return;
        }
        if (!canUseCertifiedAction(authStore.user, null)) {
            goToCertification();
            return;
        }
        goto(`/messages?to=${encodeURIComponent(authorId)}`);
    }

    function stopPropagation(e: Event): void {
        e.preventDefault();
        e.stopPropagation();
    }
</script>

{#if !authorId}
    <span class={className}>
        {#if children}
            {@render children()}
        {:else}
            {authorName}
        {/if}
    </span>
{:else}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <span onclick={stopPropagation} onkeydown={stopPropagation} class="inline-flex items-center">
        <DropdownMenu.Root
            onOpenChange={(open) => {
                if (open) checkFollowStatus();
            }}
        >
            <DropdownMenu.Trigger
                class="cursor-pointer text-left hover:underline focus:outline-none {className}"
            >
                {#if children}
                    {@render children()}
                {:else}
                    {authorName}
                {/if}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="start" class="w-40">
                <DropdownMenu.Item
                    class="cursor-pointer gap-2"
                    onclick={() => goto(`/member/${authorId}`)}
                >
                    <User class="h-3.5 w-3.5" />
                    프로필 보기
                </DropdownMenu.Item>
                <DropdownMenu.Item
                    class="cursor-pointer gap-2"
                    onclick={() => goto(`/search?sfl=author&q=${encodeURIComponent(authorName)}`)}
                >
                    <FileText class="h-3.5 w-3.5" />
                    전체 게시물
                </DropdownMenu.Item>

                {#if authStore.isAuthenticated && !isOwnProfile}
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item
                        class="cursor-pointer gap-2"
                        onclick={handleFollow}
                        disabled={followLoading}
                    >
                        {#if isFollowing}
                            <UserMinus class="h-3.5 w-3.5" />
                            팔로우 해제
                        {:else}
                            <UserPlus class="h-3.5 w-3.5" />
                            팔로우
                        {/if}
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                        class="cursor-pointer gap-2"
                        onclick={handleMessage}
                        title={!canUseCertifiedAction(authStore.user, null)
                            ? '실명인증'
                            : undefined}
                    >
                        <Mail class="h-3.5 w-3.5" />
                        쪽지 보내기
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                        class="text-destructive cursor-pointer gap-2"
                        onclick={handleBlock}
                    >
                        <Ban class="h-3.5 w-3.5" />
                        차단하기
                    </DropdownMenu.Item>
                {/if}
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    </span>
{/if}
