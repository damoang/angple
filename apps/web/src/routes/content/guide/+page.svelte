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
            desc: '글도 댓글도 존댓말로. 여러 사람이 함께 보는 게시판에서는 혼잣말처럼 쓰신 표현도 읽는 분들에게는 반말로 받아들여집니다. 반말이 섞이면 안내를 드릴 수 있어요.'
        },
        {
            emoji: '🚫',
            tone: 'rose',
            title: '비속어·욕설은 초성으로도 쓰지 않아요',
            desc: 'ㅅㅂ·ㅄ·ㅈㄴ·ㅈㄹ 같은 초성, 「졸라」처럼 소리를 바꾼 말, 「bird 끼」처럼 영문으로 바꾼 표기까지 모두 같은 표현으로 봅니다. 강조하려고 쓰신 경우에도 마찬가지예요.'
        },
        {
            emoji: '🙂',
            tone: 'mint',
            title: '소수 의견도 소중합니다',
            desc: '운영정책은 이렇게 정하고 있어요. 「소수의 견해는 여전히 소중하며, 다모앙은 다양성을 존중합니다. 충분히 논의될만한 주제에서 소수의 편에 섰다고 하여 불이익을 받는 일은 없을 것입니다.」 의견이 다르다는 이유만으로는 제한되지 않습니다. 보는 것은 「무엇을 말했나」가 아니라 「어떻게 말했나」입니다.'
        },
        {
            emoji: '⬜',
            tone: 'amber',
            title: '빈 댓글은 가끔이면 괜찮지만',
            desc: '운영정책은 「빈댓글을 작성하는 행위 역시 원론적으로 회원비하행위로 보지 않습니다」라고 정하고 있어요. 다만 같은 분에게 지나치게 반복하거나 누구도 납득할 수 없는 이유로 남기시면, 회원비하·이용방해·예의없음에 해당할 수 있습니다.'
        },
        {
            emoji: '💢',
            tone: 'rose',
            title: '회원 비하·조롱 금지',
            desc: '특정 회원·집단을 깎아내리는 표현은 삼가주세요. 근거 없이 상대를 특정 성향·집단으로 규정하는 것(「○○○은 △△다」)도 포함됩니다. 정치 사안에 대한 의견 자체는 문제가 되지 않아요.'
        }
    ];

    // 글쓰기 규칙
    const share = [
        {
            emoji: '📌',
            tone: 'violet',
            title: '사적 제재의 수단이 되면 안 됩니다',
            desc: '박제는 허용되는 기능이지만, 특정 회원을 벌주려는 목적으로 쓰이면 이용제한 대상이 됩니다.'
        },
        {
            emoji: '📐',
            tone: 'violet',
            title: '박제는 허용되지만 범위가 있어요',
            desc: '제목에는 대상 회원의 닉네임 또는 아이디만, 본문에는 스크린샷과 링크만 넣어주세요. 텍스트 인용·요약·개인 의견·스크린샷 안의 메모는 허용되지 않습니다.'
        },
        {
            emoji: '🔂',
            tone: 'amber',
            title: '왜 범위를 두나요',
            desc: '있는 그대로 공유해야 다른 분들이 스스로 판단할 수 있기 때문이에요. 작성자의 해석이나 강조가 들어가면 분쟁의 소지가 되고, 박제글을 쓰신 분이 법적 분쟁에 휘말릴 수 있습니다. 한 분을 겨냥해 이유 없이 되풀이하는 것도 이용방해가 될 수 있어요.'
        }
    ];

    const report = [
        {
            emoji: '🚨',
            tone: 'mint',
            title: '신고는 규칙 위반이라고 판단될 때',
            desc: '신고는 커뮤니티를 함께 지키는 기능이에요. 사적인 감정보다 공익을 먼저 생각해 주세요.'
        },
        {
            emoji: '⚠️',
            tone: 'rose',
            title: '이런 신고는 제한될 수 있어요',
            desc: '근거 없이 「다중이」로 신고, 본인 기준에 맞지 않는다는 이유의 신고, 상황을 자의적으로 유추한 신고, 운영 방해를 목적으로 한 다량의 신고. 허위·악의적 신고는 회원기만·이용방해·운영정책부정에 해당할 수 있습니다.'
        }
    ];

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
            desc: '소명 게시판에 접수해 주세요. 어떤 점이 사실과 다른지 구체적으로 적어주시면 검토가 빠릅니다. 이용제한 중에도 소명은 접수하실 수 있어요.'
        },
        {
            step: '3',
            title: '기간 내 접수',
            desc: '통보를 받으신 날부터 15일 안에 접수해 주세요. 담당자가 순차적으로 확인하며, 결과는 다시 안내드립니다.'
        }
    ];

    // 판단 기준 — 「무엇을 말했나」가 아니라 「어떻게 말했나」
    const criteria = [
        {
            emoji: '🎯',
            tone: 'sky',
            title: '누구를 향한 말인가',
            desc: '정치인·공인에 대한 비판과, 함께 글 쓰는 회원을 향한 표현은 다르게 봅니다. 회원을 향한 경우를 더 무겁게 봅니다.'
        },
        {
            emoji: '🔁',
            tone: 'sky',
            title: '한 번인가 반복인가',
            desc: '같은 표현이 반복되면 누적으로 봅니다. 처음이라면 대부분 안내(주의)로 끝나고 이용제한은 없습니다.'
        },
        {
            emoji: '💬',
            tone: 'sky',
            title: '앞뒤 맥락까지 봅니다',
            desc: '문장 하나만 떼어 보지 않고, 어떤 글에 달린 말인지 오간 대화를 함께 확인합니다.'
        },
        {
            emoji: '📮',
            tone: 'sky',
            title: '신고된 것만 봅니다',
            desc: '접수된 신고의 내용만 검토합니다. 운영진이 게시판을 뒤져 문제를 찾아내지 않습니다.'
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
        },
        {
            q: '신고 결과를 알려주시나요?',
            a: '신고하신 분께 개별 결과는 안내드리지 않습니다. 처분이 확정되면 이용제한 기록 게시판에 공개되니 그곳에서 확인하실 수 있어요.'
        },
        {
            q: '정치 이야기를 하면 제한되나요?',
            a: '아니요. 의견이 다르다는 이유로 제한하지 않습니다. 운영정책 별지에 「소수의 편에 섰다고 하여 불이익을 받는 일은 없을 것」이라고 적혀 있어요. 보는 것은 반말·비속어·비하 같은 표현 방식입니다.'
        },
        {
            q: '주의를 받으면 이용에 제한이 생기나요?',
            a: '주의는 안내이며 이용제한이 없습니다. 글쓰기·댓글 모두 그대로 하실 수 있어요. 다만 기록으로 남습니다.'
        },
        {
            q: '이용제한 중에는 무엇을 못 하나요?',
            a: '기간 동안 글쓰기·댓글·쪽지가 잠시 멈춥니다. 로그인과 읽기는 가능하고, 소명 접수도 하실 수 있어요.'
        },
        {
            q: '닉네임 변경을 안내받았어요.',
            a: '마이페이지에서 바로 바꾸실 수 있습니다. 안내를 받으신 뒤에도 변경하지 않으면 이용제한으로 이어질 수 있어요.'
        }
    ];

    // 파스텔 배경 톤 → Tailwind 클래스 (다크모드 대응)
    const toneBg: Record<string, string> = {
        mint: 'bg-teal-100 dark:bg-teal-900/40',
        amber: 'bg-amber-100 dark:bg-amber-900/40',
        rose: 'bg-rose-100 dark:bg-rose-900/40',
        violet: 'bg-violet-100 dark:bg-violet-900/40',
        sky: 'bg-sky-100 dark:bg-sky-900/40'
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

    <!-- 판단 기준 -->
    <section class="bg-card mb-4 rounded-2xl border p-5 shadow-sm">
        <h2 class="text-foreground text-lg font-bold">⚖️ 어떻게 판단하나요</h2>
        <p class="text-muted-foreground mb-3 text-xs">
            「무엇을 말했나」가 아니라 「어떻게 말했나」를 봅니다.
        </p>
        <div class="divide-y">
            {#each criteria as item (item.title)}
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

    <!-- 신고 -->
    <section class="bg-card mb-4 rounded-2xl border p-5 shadow-sm">
        <h2 class="text-foreground text-lg font-bold">🚨 신고할 때</h2>
        <p class="text-muted-foreground mb-3 text-xs">
            운영정책의 적용은 회원님들의 신고와 제보에 기초합니다.
        </p>
        <div class="divide-y">
            {#each report as item (item.title)}
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

    <!-- 박제·공유 -->
    <section class="bg-card mb-4 rounded-2xl border p-5 shadow-sm">
        <h2 class="text-foreground text-lg font-bold">📌 박제와 공유</h2>
        <p class="text-muted-foreground mb-3 text-xs">
            옮겨오는 것 자체는 막지 않습니다. 반복과 표현을 봅니다.
        </p>
        <div class="divide-y">
            {#each share as item (item.title)}
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
