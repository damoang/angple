<script lang="ts">
    import type { PageData } from './$types.js';

    let { data }: { data: PageData } = $props();
</script>

<svelte:head>
    <title>{data.title}</title>
</svelte:head>

<div class="mx-auto max-w-3xl px-4 py-10">
    <article class="bg-card border-border rounded-xl border p-8 shadow-sm sm:p-12">
        <h1 class="text-foreground mb-10 text-center text-2xl font-bold sm:text-3xl">
            위키앙, <span class="font-normal">"함께 쓰고 함께 나누는 지식의 광장"</span>
        </h1>

        <div
            class="text-muted-foreground space-y-6 text-base leading-relaxed sm:text-lg sm:leading-loose"
        >
            <p>
                위키앙(WIKIANG)은 누구나 자유롭게 읽고, 쓰고, 함께 다듬어가는 열린 위키
                백과사전입니다. 작은 기록 하나가 모여 방대한 지식이 되고, 그 지식은 다시 모두의 것이
                되어 세상에 되돌아갑니다.
            </p>

            <p>
                한 사람의 정보는 다른 사람의 손을 거치며 더 정확해지고, 더 풍부해집니다.<br />
                서로의 지식이 연결되고 검증되는 과정 그 자체가 위키앙의 힘입니다.
            </p>

            <p>
                위키앙은 처음부터 하나의 약속이었습니다.<br />
                <strong class="text-foreground"
                    >"누구에게나 열려 있고, 누구나 함께 만드는 지식"</strong
                ><br />
                전문가가 아니어도, 작은 관심과 정성만 있다면 누구나 기여할 수 있습니다.
            </p>

            <p>
                우리는 정확성, 중립성, 그리고 출처를 존중합니다. 사실에 근거한 기록을 지향하며,
                다양한 관점이 균형 있게 담길 수 있도록 함께 노력합니다.
            </p>

            <p>
                위키앙의 모든 문서는 공동의 자산입니다. 한 번 쓰인 글이 끝이 아니라, 시간이 흐르며
                여러 사람의 손길로 끊임없이 보완되고 발전합니다. 그 누적의 과정이 위키앙이 가진 가장
                소중한 가치입니다.
            </p>

            <p>
                이곳은 단순한 정보 창고가 아니라, 지식을 나누고 서로의 배움을 격려하는 공동체입니다.<br
                />
                질문하고, 보태고, 바로잡으며 우리는 함께 더 나은 기록을 만들어갑니다.
            </p>

            <p>
                위키앙은 <strong class="text-foreground">'개방, 협업, 신뢰'</strong>라는 가치를
                중심에 두고, 모두가 함께 쌓아가는 자유로운 지식의 공간을 꿈꿉니다.
            </p>

            <p>
                여러분이 남긴 한 줄의 기록이 누군가에게는 소중한 길잡이가 됩니다. 지금 이 순간도
                위키앙은 여러분의 참여를 기다리고 있습니다.
            </p>
        </div>

        <p class="text-muted-foreground mt-10 text-right text-sm">
            — 위키앙 운영팀 (WIKIANG LLC) —
        </p>
    </article>
</div>
