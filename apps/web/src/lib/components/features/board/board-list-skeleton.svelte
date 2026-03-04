<script lang="ts">
    import { Skeleton } from '$lib/components/ui/skeleton/index.js';
    import { Card, CardContent, CardHeader } from '$lib/components/ui/card/index.js';
</script>

<Card class="border-border bg-background overflow-hidden rounded-xl border shadow-sm">
    <!-- 게시판 헤더 스켈레톤 -->
    <CardHeader class="border-border border-b px-4 py-4">
        <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-center gap-3">
                <Skeleton class="h-10 w-10 rounded-lg" />
                <div>
                    <Skeleton class="mb-1.5 h-5 w-32" />
                    <Skeleton class="h-4 w-20" />
                </div>
            </div>
            <div class="flex gap-2">
                <Skeleton class="h-9 w-[80px] rounded-md" />
                <Skeleton class="h-9 w-[100px] rounded-md" />
            </div>
        </div>
    </CardHeader>

    <!-- 게시글 목록 스켈레톤 -->
    <CardContent class="p-0">
        <div class="divide-border divide-y">
            {#each { length: 15 } as _, i}
                <div class="flex items-center gap-2 px-4 py-2.5 md:gap-3">
                    <Skeleton class="hidden h-7 w-16 rounded-lg md:block" />
                    <div class="min-w-0 flex-1">
                        <Skeleton
                            class="mb-1 h-[18px] rounded"
                            style="width: {65 + ((i * 17) % 25)}%"
                        />
                        <div class="flex items-center gap-2 md:hidden">
                            <Skeleton class="h-4 w-12 rounded" />
                            <Skeleton class="h-4 w-16 rounded" />
                            <Skeleton class="h-4 w-10 rounded" />
                        </div>
                    </div>
                    <div class="hidden shrink-0 items-center gap-2 md:flex">
                        <Skeleton class="h-4 w-[100px] rounded" />
                        <Skeleton class="h-4 w-[65px] rounded" />
                        <Skeleton class="h-4 w-[50px] rounded" />
                    </div>
                </div>
            {/each}
        </div>
    </CardContent>

    <!-- 페이지네이션 스켈레톤 -->
    <div class="border-border flex justify-center border-t px-4 py-3">
        <div class="flex gap-1">
            {#each { length: 5 } as _}
                <Skeleton class="h-8 w-8 rounded" />
            {/each}
        </div>
    </div>
</Card>
