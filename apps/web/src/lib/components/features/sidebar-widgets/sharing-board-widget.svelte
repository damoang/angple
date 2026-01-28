<script lang="ts">
    /**
     * 나눔 게시판 위젯
     */
    interface Props {
        isEditMode?: boolean;
    }

    let { isEditMode = false }: Props = $props();
</script>

<div
    class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
    class:ring-2={isEditMode}
    class:ring-blue-500={isEditMode}
>
    <h3 class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
        <svg class="mr-1 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
            />
        </svg>
        나눔 게시판
    </h3>
    <ul class="space-y-2 text-xs text-slate-600 dark:text-slate-400">
        <li class="hover:text-primary cursor-pointer truncate">• [진행중] 연말 특별 나눔 이벤트</li>
        <li class="hover:text-primary cursor-pointer truncate">• [마감] 기프티콘 나눔</li>
        <li class="hover:text-primary cursor-pointer truncate">• [진행중] 책 나눔합니다</li>
    </ul>
</div>
