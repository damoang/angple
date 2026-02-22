<script lang="ts">
    import type { Board, DamoangUser } from '$lib/api/types.js';
    import type { PermissionAction } from '$lib/utils/board-permissions.js';
    import { checkPermission, getPermissionMessage } from '$lib/utils/board-permissions.js';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import Lock from '@lucide/svelte/icons/lock';
    import type { Snippet } from 'svelte';

    interface Props {
        /** 게시판 정보 */
        board: Board | undefined | null;
        /** 체크할 권한 */
        action: PermissionAction;
        /** 허용된 경우 렌더링할 컨텐츠 */
        children: Snippet;
        /** 권한 없는 경우 커스텀 메시지 (옵션) */
        fallbackMessage?: string;
        /** 권한 없을 때 UI 완전 숨기기 (기본: 안내 메시지 표시) */
        hideOnDenied?: boolean;
    }

    let { board, action, children, fallbackMessage, hideOnDenied = false }: Props = $props();

    const hasPermission = $derived(checkPermission(board, action, authStore.user ?? null));
    const message = $derived(
        fallbackMessage || getPermissionMessage(board, action, authStore.user ?? null)
    );
</script>

{#if hasPermission}
    {@render children()}
{:else if !hideOnDenied}
    <div class="bg-muted/50 rounded-md p-4 text-center">
        <p class="text-muted-foreground flex items-center justify-center gap-2">
            <Lock class="h-4 w-4" />
            {message}
        </p>
        {#if !authStore.isAuthenticated}
            <p class="text-muted-foreground mt-2 text-sm">
                <button
                    type="button"
                    onclick={() => authStore.redirectToLogin()}
                    class="text-primary hover:underline"
                >
                    로그인
                </button>
                이 필요합니다.
            </p>
        {/if}
    </div>
{/if}
