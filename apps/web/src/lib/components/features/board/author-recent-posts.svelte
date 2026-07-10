<script lang="ts">
    /**
     * 작성자 최근 글 SSR 섹션 (SEO 내부링크 강화, #83)
     *
     * +page.server.ts 에서 await 로 확정한 데이터를 그대로 렌더한다.
     * 크롤러가 내부링크를 발견하는 것이 목적이므로 클라이언트 전용
     * 게이트($effect/onMount/browser)를 두지 않는다 — 서버 HTML 에
     * 앵커가 반드시 포함되어야 한다.
     */
    import { formatDateCompact } from '$lib/utils/format-date.js';

    interface AuthorRecentPost {
        bo_table: string;
        wr_id: number;
        wr_subject: string;
        wr_datetime: string;
        href: string;
    }

    interface Props {
        authorName: string;
        posts: AuthorRecentPost[];
    }

    let { authorName, posts }: Props = $props();
</script>

{#if posts.length > 0}
    <section class="mb-6 rounded-lg border p-4" aria-label="작성자의 최근 글">
        <h3 class="text-foreground mb-2 text-sm font-semibold">
            ✍️ {authorName}님의 최근 글
        </h3>
        <ul class="divide-border divide-y">
            {#each posts as p (`${p.bo_table}_${p.wr_id}`)}
                <li class="py-1.5">
                    <a
                        href={p.href}
                        class="text-foreground hover:text-primary flex min-w-0 items-baseline gap-2 text-sm"
                    >
                        <span class="min-w-0 flex-1 truncate">
                            {p.wr_subject || '(제목 없음)'}
                        </span>
                        <span class="text-muted-foreground shrink-0 text-xs">
                            {formatDateCompact(p.wr_datetime)}
                        </span>
                    </a>
                </li>
            {/each}
        </ul>
    </section>
{/if}
