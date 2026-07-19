<script lang="ts">
    /**
     * 알뜰구매 "판매 종료 제보" 버튼.
     * 서로 다른 회원 3명이 제보하면 서버가 말머리를 '종료'로 전환하고 AI 안내
     * 댓글을 남긴다. 제보는 회원당 1회, 취소 없음(멱등).
     */
    import { Button } from '$lib/components/ui/button/index.js';
    import PackageX from '@lucide/svelte/icons/package-x';
    import { authStore } from '$lib/stores/auth.svelte.js';
    import { toast } from 'svelte-sonner';

    let { boardId, postId, category }: { boardId: string; postId: number; category?: string } =
        $props();

    let count = $state(0);
    let threshold = $state(3);
    let reported = $state(false);
    let closed = $derived(category === '종료');
    let submitting = $state(false);
    let loaded = $state(false);

    $effect(() => {
        if (!authStore.isAuthenticated || closed) return;
        void loadState();
    });

    async function loadState(): Promise<void> {
        try {
            const res = await fetch(`/api/boards/${boardId}/posts/${postId}/end-report`);
            const json = await res.json();
            if (json.success) {
                count = json.data.count;
                threshold = json.data.threshold;
                reported = json.data.reported;
                loaded = true;
            }
        } catch {
            // 조회 실패 시 버튼만 기본 상태로 노출
            loaded = true;
        }
    }

    async function submit(): Promise<void> {
        if (submitting || reported) return;
        if (!confirm('이 상품이 품절되었거나 판매가 종료되었나요?\n제보는 취소할 수 없습니다.')) {
            return;
        }
        submitting = true;
        try {
            const res = await fetch(`/api/boards/${boardId}/posts/${postId}/end-report`, {
                method: 'POST'
            });
            const json = await res.json();
            if (json.success) {
                count = json.data.count;
                reported = true;
                if (json.data.closed) {
                    toast.success('제보가 모여 이 딜을 종료로 전환했습니다.');
                    // 말머리·AI 댓글 반영을 위해 새로고침
                    setTimeout(() => window.location.reload(), 1200);
                } else {
                    toast.success(`종료 제보가 접수되었습니다. (${count}/${threshold})`);
                }
            } else if (res.status === 401) {
                toast.error('로그인 후 이용해 주세요.');
            } else {
                toast.error('제보 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.');
            }
        } catch {
            toast.error('제보 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            submitting = false;
        }
    }
</script>

{#if authStore.isAuthenticated && !closed}
    <div class="mt-4">
        <Button
            variant="outline"
            size="sm"
            class="text-muted-foreground gap-1.5"
            disabled={submitting || reported}
            onclick={submit}
        >
            <PackageX class="h-3.5 w-3.5" />
            {#if reported}
                종료 제보됨 ({count}/{threshold})
            {:else}
                판매 종료 제보{loaded && count > 0 ? ` (${count}/${threshold})` : ''}
            {/if}
        </Button>
    </div>
{/if}
