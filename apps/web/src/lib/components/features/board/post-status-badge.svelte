<script lang="ts">
    /**
     * 글 처리 상태 배지 — 카테고리 배지 **옆**에 붙는다(카테고리를 대체하지 않는다).
     *
     * 버그 게시판은 지금까지 해결되면 카테고리 칸을 「완료」로 덮어써 원래 종류(버그/기능제안)가
     * 사라졌다. 상태는 g5_da_post_status 에 따로 두고 여기서 표시한다(설계: docs/2026-09-28-bug-status-badge-sprint.html).
     */
    import type { PostStatus } from '$lib/api/types.js';

    interface Props {
        status: PostStatus;
        /** 목록(sm) / 상세(md) */
        size?: 'sm' | 'md';
        class?: string;
    }

    let { status, size = 'sm', class: className = '' }: Props = $props();

    const LABEL: Record<PostStatus, string> = {
        resolved: '✅ 해결됨',
        in_progress: '🔧 진행중',
        hold: '⏸ 보류'
    };
    const TONE: Record<PostStatus, string> = {
        resolved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
        in_progress: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
        hold: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    };
    const SIZE = {
        sm: 'rounded px-1.5 py-0 text-xs',
        md: 'rounded-md px-2 py-0.5 text-[13px]'
    };
</script>

<span
    class="shrink-0 font-medium {SIZE[size]} {TONE[status]} {className}"
    data-post-status={status}
>
    {LABEL[status]}
</span>
