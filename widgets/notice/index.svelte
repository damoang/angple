<script lang="ts">
    /**
     * 공지사항 위젯
     */
    import type { WidgetProps } from '$lib/types/widget-props';

    let { config, slot, isEditMode = false }: WidgetProps = $props();
</script>

<div
    class="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
>
    <h3 class="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
        <svg class="mr-1 inline h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
        </svg>
        공지사항
    </h3>
    <ul class="space-y-2 text-xs text-slate-600 dark:text-slate-400">
        <li class="truncate">• 서비스 점검 안내</li>
        <li class="truncate">• 새로운 기능 업데이트</li>
        <li class="truncate">• 커뮤니티 가이드라인</li>
    </ul>
</div>
