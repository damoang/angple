<script lang="ts">
    import { Skeleton } from '$lib/components/ui/skeleton/index.js';
    import { Card, CardContent, CardHeader } from '$lib/components/ui/card/index.js';
</script>

<Card class="border-border bg-background overflow-hidden rounded-xl border shadow-sm">
    <!-- 게시글 헤더 스켈레톤 -->
    <CardHeader class="border-border border-b px-4 py-4">
        <Skeleton class="mb-3 h-7 w-3/4" />
        <div class="flex items-center gap-3">
            <Skeleton class="h-8 w-8 rounded-full" />
            <div>
                <Skeleton class="mb-1 h-4 w-24" />
                <Skeleton class="h-3 w-32" />
            </div>
        </div>
    </CardHeader>

    <!-- 본문 스켈레톤 -->
    <CardContent class="space-y-3 px-4 py-6">
        <Skeleton class="h-4 w-full" />
        <Skeleton class="h-4 w-11/12" />
        <Skeleton class="h-4 w-4/5" />
        <Skeleton class="h-4 w-full" />
        <Skeleton class="h-4 w-3/4" />
        <div class="py-2">
            <Skeleton class="h-48 w-full rounded-lg" />
        </div>
        <Skeleton class="h-4 w-full" />
        <Skeleton class="h-4 w-2/3" />
    </CardContent>

    <!-- 좋아요/싫어요 스켈레톤 -->
    <div class="border-border flex justify-center gap-4 border-t px-4 py-4">
        <Skeleton class="h-10 w-20 rounded-md" />
        <Skeleton class="h-10 w-20 rounded-md" />
    </div>
</Card>

<!-- 댓글 스켈레톤 -->
<Card class="border-border bg-background mt-4 overflow-hidden rounded-xl border shadow-sm">
    <CardHeader class="border-border border-b px-4 py-3">
        <Skeleton class="h-5 w-24" />
    </CardHeader>
    <CardContent class="p-0">
        <div class="divide-border divide-y">
            {#each { length: 5 } as _, i}
                <div class="px-4 py-3">
                    <div class="mb-2 flex items-center gap-2">
                        <Skeleton class="h-6 w-6 rounded-full" />
                        <Skeleton class="h-4 w-20" />
                        <Skeleton class="h-3 w-24" />
                    </div>
                    <Skeleton class="mb-1 h-4 rounded" style="width: {70 + ((i * 13) % 25)}%" />
                    <Skeleton class="h-4 w-1/2 rounded" />
                </div>
            {/each}
        </div>
    </CardContent>
</Card>
