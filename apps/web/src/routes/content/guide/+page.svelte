<script lang="ts">
    import * as Accordion from '$lib/components/ui/accordion/index.js';
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();

    // 커뮤니티 예절
    const etiquette = [
        {
            emoji: '🙏',
            tone: 'mint',
            title: '경어체를 사용해 주세요',
            desc: '글도 댓글도 존댓말로. 처음 오신 분도 편하게 어울릴 수 있어요.'
        },
        {
            emoji: '🚫',
            tone: 'rose',
            title: '비속어·욕설은 초성으로도 쓰지 않아요',
            desc: 'ㅅㅂ·ㅄ 같은 초성 표현, 변형·우회 표현까지 모두 포함됩니다.'
        },
        {
            emoji: '💢',
            tone: 'rose',
            title: '회원 비하·조롱 금지',
            desc: '특정 회원·집단을 깎아내리는 표현은 삼가주세요.'
        }
    ];

    // 글쓰기 규칙
    const writing = [
        {
            emoji: '🔗',
            tone: 'amber',
            title: '뉴스·기사 펌글엔 출처 + 내 의견을 꼭',
            desc: '원문 링크를 남기고, 한 줄이라도 본인 생각을 덧붙여 주세요. 제목만 복붙한 글은 지양합니다.'
        },
        {
            emoji: '📊',
            tone: 'amber',
            title: '여론조사를 퍼올 때',
            desc: '조사기관·표본수·조사시점을 함께 밝혀주세요. 특정 결과만 잘라 과장하지 않기 — 왜곡 인용은 제한될 수 있어요.'
        },
        {
            emoji: '🖼️',
            tone: 'mint',
            title: '저작권·개인정보 유의',
            desc: '타인의 사진·개인정보가 담긴 자료는 조심해서 올려주세요.'
        }
    ];

    // 이용제한 소명 3단계
    const appeal = [
        {
            step: '1',
            title: '안내를 먼저 확인',
            desc: '이용제한 시 사유·기간이 쪽지/알림으로 전달됩니다. 어떤 규정 때문인지 확인해 주세요.'
        },
        {
            step: '2',
            title: '소명 접수',
            desc: '안내에 있는 소명 경로로, 어떤 점이 오해인지 구체적으로 작성해 주세요. 감정적 항의보다 사실 위주가 도움이 됩니다.'
        },
        {
            step: '3',
            title: '기간 내 접수',
            desc: '소명은 정해진 기간 안에 접수해야 검토됩니다. 담당자가 순차적으로 확인해요.'
        }
    ];

    // 기본 안내 미니 카드
    const basics = [
        { emoji: '📝', label: '가입 & 인증' },
        { emoji: '⭐', label: '레벨 · XP' },
        { emoji: '👥', label: '소모임 신청' },
        { emoji: '🚨', label: '신고하기' }
    ];

    // FAQ
    const faqs = [
        {
            q: '내가 쓴 글/댓글이 안 보여요.',
            a: "직접 삭제한 글·댓글은 마이페이지 '내가 쓴 글/댓글 → 삭제한 글/댓글'에서 확인할 수 있어요."
        },
        {
            q: '이용제한을 받았는데 억울해요.',
            a: "위 '이용제한 & 소명' 안내대로, 안내된 소명 경로로 접수해 주세요."
        },
        {
            q: '소모임을 만들고 싶어요.',
            a: '소모임 신청 게시판에 신청하고 추천을 모으면 개설돼요.'
        },
        {
            q: '쪽지를 받고 싶지 않아요.',
            a: "마이페이지 설정 → '쪽지 설정'에서 수신 거부를 켜면 됩니다. (운영 안내 쪽지는 예외예요.)"
        },
        {
            q: '신고하면 언제 처리되나요?',
            a: '신고는 담당자가 순차적으로 신중히 검토하며, 신고량이 많아 처리까지 수일이 소요될 수 있어요.'
        }
    ];

    // 파스텔 배경 톤 → Tailwind 클래스 (다크모드 대응)
    const toneBg: Record<string, string> = {
        mint: 'bg-teal-100 dark:bg-teal-900/40',
        amber: 'bg-amber-100 dark:bg-amber-900/40',
        rose: 'bg-rose-100 dark:bg-rose-900/40',
        violet: 'bg-violet-100 dark:bg-violet-900/40'
    };
</script>

<svelte:head>
    <title>{data.title} - 다모앙</title>
    <meta
        name="description"
        content="다모앙 이용가이드 — 커뮤니티 예절, 글쓰기 규칙, 이용제한 소명 방법과 자주 묻는 질문을 한눈에."
    />
</svelte:head>

<div class="mx-auto max-w-3xl break-keep px-4 py-8">
    <!-- 히어로 -->
    <div class="mb-6 rounded-3xl border bg-teal-50 p-8 text-center dark:bg-teal-950/30">
        <div class="text-5xl">🙌</div>
        <h1 class="text-foreground mt-2 text-2xl font-bold">다모앙 이용가이드</h1>
        <p class="text-muted-foreground mt-1 text-sm">
            서로 존중하는 즐거운 커뮤니티를 위한 약속이에요 😊
        </p>
    </div>

    <!-- 커뮤니티 예절 -->
    <section class="bg-card mb-4 rounded-2xl border p-5 shadow-sm">
        <h2 class="text-foreground text-lg font-bold">🤝 커뮤니티 예절</h2>
        <p class="text-muted-foreground mb-3 text-xs">
            모두가 편안하게 대화할 수 있도록 지켜주세요.
        </p>
        <div class="divide-y">
            {#each etiquette as item (item.title)}
                <div class="flex items-start gap-3 py-3">
                    <span
                        class="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-base {toneBg[
                            item.tone
                        ]}">{item.emoji}</span
                    >
                    <div>
                        <p class="text-foreground text-sm font-semibold">{item.title}</p>
                        <p class="text-muted-foreground mt-0.5 text-sm">{item.desc}</p>
                    </div>
                </div>
            {/each}
        </div>
    </section>

    <!-- 글쓰기 규칙 -->
    <section class="bg-card mb-4 rounded-2xl border p-5 shadow-sm">
        <h2 class="text-foreground text-lg font-bold">✍️ 글쓰기 규칙</h2>
        <p class="text-muted-foreground mb-3 text-xs">펌글·인용은 이렇게 해주세요.</p>
        <div class="divide-y">
            {#each writing as item (item.title)}
                <div class="flex items-start gap-3 py-3">
                    <span
                        class="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-base {toneBg[
                            item.tone
                        ]}">{item.emoji}</span
                    >
                    <div>
                        <p class="text-foreground text-sm font-semibold">{item.title}</p>
                        <p class="text-muted-foreground mt-0.5 text-sm">{item.desc}</p>
                    </div>
                </div>
            {/each}
        </div>
    </section>

    <!-- 이용제한 소명 -->
    <section class="bg-card mb-4 rounded-2xl border p-5 shadow-sm">
        <h2 class="text-foreground text-lg font-bold">🛟 이용제한을 받았다면 — 소명하는 법</h2>
        <p class="text-muted-foreground mb-3 text-xs">
            억울한 점이 있으면 이의를 제기할 수 있어요.
        </p>
        <div class="divide-y">
            {#each appeal as item (item.step)}
                <div class="flex items-start gap-3 py-3">
                    <span
                        class="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-100 text-sm font-bold text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
                        >{item.step}</span
                    >
                    <div>
                        <p class="text-foreground text-sm font-semibold">{item.title}</p>
                        <p class="text-muted-foreground mt-0.5 text-sm">{item.desc}</p>
                    </div>
                </div>
            {/each}
        </div>
    </section>

    <!-- 처음 오셨나요 -->
    <section class="bg-card mb-4 rounded-2xl border p-5 shadow-sm">
        <h2 class="text-foreground text-lg font-bold">🧭 처음 오셨나요?</h2>
        <p class="text-muted-foreground mb-3 text-xs">다모앙 기본기를 한눈에.</p>
        <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {#each basics as b (b.label)}
                <div class="bg-muted/40 text-foreground rounded-xl border p-3 text-center text-sm">
                    <span class="mb-1 block text-2xl">{b.emoji}</span>
                    {b.label}
                </div>
            {/each}
        </div>
    </section>

    <!-- 가이드 영상 -->
    <section class="bg-card mb-4 rounded-2xl border p-5 shadow-sm">
        <h2 class="text-foreground text-lg font-bold">🎬 가이드 영상</h2>
        <p class="text-muted-foreground mb-3 text-xs">영상으로 더 쉽게 따라 해보세요.</p>
        <div class="aspect-video overflow-hidden rounded-xl bg-black">
            <iframe
                class="h-full w-full"
                src="https://www.youtube.com/embed/d9FESnvUX_I"
                title="다모앙 이용가이드"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
            ></iframe>
        </div>
    </section>

    <!-- FAQ -->
    <section class="bg-card mb-4 rounded-2xl border p-5 shadow-sm">
        <h2 class="text-foreground text-lg font-bold">💬 자주 묻는 질문 (FAQ)</h2>
        <p class="text-muted-foreground mb-2 text-xs">가장 많이 궁금해하시는 것들.</p>
        <Accordion.Root type="single" class="w-full">
            {#each faqs as faq, i (faq.q)}
                <Accordion.Item value={`faq-${i}`}>
                    <Accordion.Trigger class="text-left text-sm font-semibold">
                        {faq.q}
                    </Accordion.Trigger>
                    <Accordion.Content class="text-muted-foreground text-sm">
                        {faq.a}
                    </Accordion.Content>
                </Accordion.Item>
            {/each}
        </Accordion.Root>
    </section>

    <!-- 푸터 -->
    <div
        class="rounded-2xl border border-teal-300 bg-teal-50 p-4 text-center text-sm text-teal-800 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200"
    >
        😊 함께 지켜주셔서 고맙습니다 — 즐거운 다모앙 되세요!
    </div>
</div>
