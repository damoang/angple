<script lang="ts">
    import { wikiHref } from '$lib/wiki/paths';
    import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
    import BookOpen from '@lucide/svelte/icons/book-open';
    let {
        total,
        recent,
        nodes
    }: {
        total: number;
        recent: { id: number; title: string; path: string; updated_at: Date | string }[];
        nodes: { title: string; path: string }[];
    } = $props();
    const topics = [
        {
            title: '다모앙',
            label: '우리의 커뮤니티',
            text: '다모앙과 함께 쌓아가는 이야기',
            number: '01'
        },
        {
            title: '라즈베리파이',
            label: '기술과 생활',
            text: '궁금한 기술을 이해하는 첫걸음',
            number: '02'
        },
        {
            title: '이재명 정부',
            label: '사회와 기록',
            text: '인물과 사회의 흐름을 살펴보기',
            number: '03'
        },
        {
            title: '민주진영 유튜버 목록',
            label: '미디어와 정보',
            text: '함께 정리하는 정보와 미디어',
            number: '04'
        }
    ];
    function topicHref(title: string) {
        const node = nodes.find((n) => n.title.replace(/_/g, ' ') === title);
        return node ? wikiHref(node.path) : '/Special:Search?q=' + encodeURIComponent(title);
    }
</script>

<section class="welcome" aria-labelledby="welcome-title">
    <div class="eyebrow">WIKIANG · 함께 쓰는 지식사전</div>
    <h2 id="welcome-title">궁금함에서 시작해,<br />함께 쌓이는 지식으로.</h2>
    <p>
        찾아보고, 연결하고, 더 나은 내용으로 고쳐주세요.<br class="desktop-break" /> 누구나 읽고 편집할
        수 있는 위키앙입니다.
    </p>
    <div class="welcome-bottom">
        <a href="/Special:AllPages"
            ><strong>{total.toLocaleString('ko-KR')}</strong>개의 공개 문서 둘러보기
            <span aria-hidden="true">→</span></a
        ><a href="/Special:Random">어떤 문서를 만나볼까요? ↗</a>
    </div>
    <BookOpen class="welcome-book" size={110} strokeWidth={0.75} aria-hidden="true" />
</section>

<section class="topics" aria-labelledby="topics-title">
    <div class="section-heading">
        <h2 id="topics-title">주제로 둘러보기</h2>
        <a href="/Special:Categories">분류 전체 →</a>
    </div>
    <div class="topic-grid">
        {#each topics as topic}<a class="topic" href={topicHref(topic.title)}
                ><span class="topic-number">{topic.number}</span>
                <div>
                    <h3>{topic.label}</h3>
                    <p>{topic.text}</p>
                    <span class="topic-document">{topic.title}</span>
                </div>
                <ArrowUpRight size={18} aria-hidden="true" /></a
            >{/each}
    </div>
</section>

<div class="home-columns">
    <section class="recent" aria-labelledby="recent-title">
        <div class="section-heading">
            <h2 id="recent-title">최근 수정된 문서</h2>
            <a href="/Special:RecentChanges">전체 보기 →</a>
        </div>
        <ul>
            {#each recent as item (item.id)}<li>
                    <a href={wikiHref(item.path)}>{item.title}</a><time
                        datetime={new Date(item.updated_at).toISOString()}
                        >{new Date(item.updated_at).toLocaleDateString('ko-KR', {
                            timeZone: 'Asia/Seoul',
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                        })}</time
                    >
                </li>{:else}<li>첫 문서를 함께 작성해보세요.</li>{/each}
        </ul>
    </section>
    <section class="join" aria-labelledby="join-title">
        <span class="eyebrow">처음 오셨나요?</span>
        <h2 id="join-title">한 문장부터 함께 써요.</h2>
        <p>오탈자 하나, 새로운 출처 하나.<br />작은 보탬이 더 정확한 문서를 만듭니다.</p>
        <ol>
            <li>검색으로 기존 문서를 찾아보세요.</li>
            <li>문서의 <strong>편집</strong>을 눌러 내용을 보태세요.</li>
            <li>미리보기로 확인하고 저장하세요.</li>
        </ol>
        <a href="/Special:NewPage">새 문서 만들기 <span aria-hidden="true">→</span></a><small
            >익명 편집도 가능합니다. 출처와 저작권을 확인해주세요.</small
        >
    </section>
</div>

<style>
    .welcome {
        position: relative;
        padding: 2rem;
        border: 1px solid var(--border);
        border-top: 3px solid var(--primary);
        background: color-mix(in srgb, var(--primary) 5%, var(--background));
        overflow: hidden;
    }
    .eyebrow {
        font-size: 0.7rem;
        letter-spacing: 0.08em;
        font-weight: 650;
        color: var(--primary);
    }
    .welcome h2 {
        font-family: Georgia, 'Noto Serif KR', serif;
        font-size: clamp(1.7rem, 3vw, 2.6rem);
        font-weight: 650;
        line-height: 1.45;
        letter-spacing: -0.04em;
        margin: 1rem 0;
        position: relative;
        z-index: 1;
    }
    .welcome p {
        color: var(--muted-foreground);
        font-size: 0.9rem;
        line-height: 1.8;
        position: relative;
        z-index: 1;
    }
    .welcome :global(.welcome-book) {
        position: absolute;
        right: 2rem;
        top: 3rem;
        color: var(--primary);
        opacity: 0.15;
        transform: rotate(-9deg);
    }
    .welcome-bottom {
        margin-top: 1.75rem;
        padding-top: 1rem;
        border-top: 1px solid var(--border);
        display: flex;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 0.75rem;
        font-size: 0.8rem;
    }
    .welcome-bottom a {
        color: var(--primary);
    }
    .welcome-bottom strong {
        font-size: 1.1rem;
    }
    .topics {
        margin: 2rem 0;
    }
    .section-heading {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 0.5rem;
        padding-bottom: 0.8rem;
        border-bottom: 1px solid var(--border);
    }
    .section-heading h2,
    .join h2 {
        font-size: 1.05rem;
        font-weight: 700;
        letter-spacing: -0.02em;
    }
    .section-heading a {
        font-size: 0.75rem;
        white-space: nowrap;
        color: var(--primary);
    }
    .topic-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
    }
    .topic {
        display: flex;
        align-items: flex-start;
        gap: 0.8rem;
        padding: 1.1rem 0.8rem 1.1rem 0;
        border-bottom: 1px solid var(--border);
        min-width: 0;
    }
    .topic:nth-child(even) {
        padding-left: 1.25rem;
    }
    .topic:hover h3 {
        color: var(--primary);
        text-decoration: underline;
    }
    .topic-number {
        color: var(--muted-foreground);
        font:
            0.75rem Georgia,
            serif;
        padding-top: 0.3rem;
    }
    .topic h3 {
        font-size: 0.92rem;
        font-weight: 650;
    }
    .topic p {
        color: var(--muted-foreground);
        font-size: 0.75rem;
        margin: 0.35rem 0 0.65rem;
        line-height: 1.6;
    }
    .topic-document {
        color: var(--primary);
        font-size: 0.75rem;
    }
    .topic :global(svg) {
        margin-left: auto;
        flex-shrink: 0;
        color: var(--muted-foreground);
    }
    .home-columns {
        display: grid;
        grid-template-columns: 1.15fr 1fr;
        gap: 2rem;
        margin-bottom: 2rem;
    }
    ul {
        list-style: none;
        margin: 0;
        padding: 0;
    }
    li {
        padding: 0.8rem 0;
    }
    .recent li {
        border-bottom: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        gap: 0.3rem;
    }
    .recent a {
        font-size: 0.88rem;
        color: var(--primary);
        overflow-wrap: anywhere;
    }
    time {
        font-size: 0.7rem;
        color: var(--muted-foreground);
    }
    .join {
        background: var(--muted);
        padding: 1.4rem;
        border-radius: 3px;
    }
    .join h2 {
        margin: 0.65rem 0;
    }
    .join p {
        color: var(--muted-foreground);
        font-size: 0.8rem;
        line-height: 1.8;
    }
    ol {
        padding-left: 1rem;
        list-style: decimal;
        font-size: 0.78rem;
        margin: 1rem 0;
    }
    ol li {
        padding: 0.3rem 0;
    }
    .join > a {
        display: flex;
        justify-content: space-between;
        color: var(--primary);
        font-weight: 650;
        font-size: 0.85rem;
        border-top: 1px solid var(--border);
        padding-top: 0.8rem;
    }
    small {
        display: block;
        font-size: 0.68rem;
        color: var(--muted-foreground);
        margin-top: 0.7rem;
        line-height: 1.7;
    }
    @media (max-width: 600px) {
        .welcome {
            padding: 1.3rem;
        }
        .welcome :global(.welcome-book) {
            right: 0.5rem;
            top: 3.5rem;
            width: 70px;
        }
        .welcome p {
            font-size: 0.8rem;
        }
        .desktop-break {
            display: none;
        }
        .topic-grid,
        .home-columns {
            grid-template-columns: 1fr;
        }
        .topic:nth-child(even) {
            padding-left: 0;
        }
        .home-columns {
            gap: 1.5rem;
        }
    }
</style>
