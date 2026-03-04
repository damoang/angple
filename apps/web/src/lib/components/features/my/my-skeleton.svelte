<script lang="ts">
    import { Skeleton } from '$lib/components/ui/skeleton/index.js';
    import { Card, CardContent, CardHeader } from '$lib/components/ui/card/index.js';
</script>

<!-- 카드 스켈레톤 -->
<Card class="bg-background">
    <CardHeader>
        <div class="flex items-center gap-2">
            <Skeleton class="h-5 w-5 rounded" />
            <Skeleton class="h-5 w-24 rounded" />
            <Skeleton class="h-4 w-12 rounded" />
        </div>
    </CardHeader>
    <CardContent>
        <div class="divide-border divide-y">
            {#each { length: 8 } as _, i}
                <div class="py-3 first:pt-0 last:pb-0">
                    <Skeleton class="mb-2 h-5 rounded" style="width: {60 + ((i * 13) % 30)}%" />
                    <div class="flex items-center gap-2">
                        <Skeleton class="h-3.5 w-20 rounded" />
                        <Skeleton class="h-3.5 w-16 rounded" />
                        <Skeleton class="h-3.5 w-14 rounded" />
                        <Skeleton class="h-3.5 w-14 rounded" />
                    </div>
                </div>
            {/each}
        </div>
    </CardContent>
</Card>
