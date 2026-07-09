<script lang="ts">
    import * as Card from '$lib/components/ui/card/index.js';
    import { Badge } from '$lib/components/ui/badge/index.js';
    import { SeoHead } from '$lib/seo/index.js';
    import type { SeoConfig } from '$lib/seo/types.js';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    /** 'YYYY-MM-DD' 의 전날 문자열 */
    function prevDay(d: string): string {
        const dt = new Date(d + 'T00:00:00Z');
        dt.setUTCDate(dt.getUTCDate() - 1);
        return dt.toISOString().slice(0, 10);
    }

    // 적용기간 계산: 자신보다 늦게 시행된 active/archived 버전이 후속본.
    // 후속본이 없으면 '현재 적용중'. scheduled 는 '시행 예정'.
    const rows = $derived(
        data.versions.map((v) => {
            if (v.status === 'scheduled') {
                return { ...v, periodText: '시행 예정', scheduled: true };
            }
            const successor = data.versions
                .filter((o) => o.status !== 'scheduled' && o.effective_date > v.effective_date)
                .sort((a, b) => a.effective_date.localeCompare(b.effective_date))[0];
            const periodText = successor
                ? `시행 ${v.effective_date} ~ ${prevDay(successor.effective_date)}`
                : `시행 ${v.effective_date} ~ 현재 적용중`;
            return { ...v, periodText, scheduled: false };
        })
    );

    const seo: SeoConfig = {
        meta: {
            title: '개인정보 처리방침 — 이전 버전',
            description: '개인정보 처리방침의 개정 이력과 이전 버전을 열람할 수 있습니다.'
        },
        og: { title: '개인정보 처리방침 — 이전 버전', type: 'website' }
    };
</script>

<SeoHead config={seo} />

<div class="mx-auto max-w-4xl px-4 py-8">
    <h1 class="text-foreground mb-2 text-3xl font-bold">개인정보 처리방침 — 이전 버전</h1>
    <p class="text-muted-foreground mb-6 text-sm">
        개정 이력과 각 버전의 전문을 상시 열람할 수 있습니다.
        <a href="/privacy/compare" class="hover:text-foreground underline underline-offset-4">
            신구 대조표 보기
        </a>
    </p>

    {#if rows.length === 0}
        <div class="text-muted-foreground py-12 text-center">
            <p>등록된 버전이 없습니다.</p>
        </div>
    {:else}
        <div class="flex flex-col gap-3">
            {#each rows as v (v.id)}
                <Card.Root>
                    <Card.Header>
                        <div class="flex flex-wrap items-center gap-2">
                            <Card.Title class="text-lg">제{v.version_no}판</Card.Title>
                            {#if v.scheduled}
                                <Badge variant="secondary">시행 예정</Badge>
                            {:else if v.status === 'active'}
                                <Badge>현재 적용중</Badge>
                            {/if}
                        </div>
                        <Card.Description>{v.periodText}</Card.Description>
                    </Card.Header>
                    {#if v.note}
                        <Card.Content>
                            <p class="text-muted-foreground text-sm">{v.note}</p>
                        </Card.Content>
                    {/if}
                    <Card.Footer>
                        {#if v.scheduled}
                            <a
                                href="/privacy/preview/{v.id}"
                                class="text-primary text-sm underline underline-offset-4"
                            >
                                미리보기
                            </a>
                        {:else}
                            <a
                                href="/privacy/versions/{v.id}"
                                class="text-primary text-sm underline underline-offset-4"
                            >
                                전문 보기
                            </a>
                        {/if}
                    </Card.Footer>
                </Card.Root>
            {/each}
        </div>
    {/if}
</div>
