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
            다모앙, <span class="font-normal">"다 같이 모여, 더욱 자유로운 세상으로"</span>
        </h1>

        <div
            class="text-muted-foreground space-y-6 text-base leading-relaxed sm:text-lg sm:leading-loose"
        >
            <p>
                다모앙의 시작은 작은 물방울이 모여 강이 되고, 마침내 바다에 이르는 자연의 흐름과
                닮아 있습니다. 이곳은 단순한 커뮤니티를 넘어, 다양한 생각이 자유롭게 흐르고 이어지는
                소통의 장입니다.
            </p>

            <p>
                각자의 작은 목소리는 하나로 모여 큰 울림이 되고,<br />
                그 울림은 세상을 향한 긍정적인 변화로 이어집니다.<br />
                그 흐름의 중심에 있는 곳, 바로 다모앙입니다.
            </p>

            <p>
                다모앙은 처음부터 하나의 선언이었습니다.<br />
                <strong class="text-foreground">"다 같이 모여, 더욱 자유로운 세상"</strong><br />
                이는 평범한 사람들이 모여 비범함을 함께 꿈꾸고 실현해 나가는 여정입니다.
            </p>

            <p>
                이곳에서 개인의 생각은 연결되고 자극받으며, 더 풍부한 아이디어와 강력한 집단지성으로
                발전합니다.
            </p>

            <p>
                다모앙은 누구나 참여하고 함께 만들어가는 열린 커뮤니티입니다. 서로 다른 사람들이
                모여 아이디어를 나누고, 함께 새로운 길을 개척해 나갑니다.
            </p>

            <p>
                이곳은 단순한 대화의 공간이 아니라, 삶의 의미와 방향을 나누고 서로를 격려하는 공감의
                공동체입니다.<br />
                때로는 진지하게, 때로는 따뜻하게, 서로의 이야기에 귀 기울이며 함께 나아갑니다.
            </p>

            <p>
                다양한 생각과 문화가 어우러지는 그 과정 속에서 진정한 집단지성의 힘이 발휘됩니다. 그
                흐름 자체가 다모앙의 가장 소중한 자산이자 기적입니다.
            </p>

            <p>
                우리는 대한민국의 민주적 가치와 정신을 이어받아, 누구나 자유롭고 평등하게 참여할 수
                있는 공간을 지향합니다. 서로의 다양성을 존중하고 조화를 이루며, 모든 구성원이 자신의
                가능성을 펼칠 수 있도록 합니다.
            </p>

            <p>
                자유로운 참여 속에서 서로를 존중하고 책임 있게 행동하는 문화,<br />
                우리는 그런 청청한 공동체를 만들어갑니다.
            </p>

            <p>
                다모앙은 <strong class="text-foreground">'공정, 투명, 집단지성'</strong>이라는
                가치를 중심에 두고, 모두가 함께 만들어가는 민주적 커뮤니티를 꿈꿉니다.
            </p>

            <p>
                우리의 목소리가 더 나은 세상을 향한 울림이 되기를 바라며, 지금 이 순간도 여러분의
                참여를 기다리고 있습니다.
            </p>

            <p>
                이 소중한 공간에서 우리의 이야기가 또 다른 역사가 되기를 바랍니다. 다모앙은 언제나
                여러분과 함께, 더 맑고 더 넓은 세상을 향해 나아갑니다.
            </p>
        </div>

        <p class="text-muted-foreground mt-10 text-right text-sm">- 다모앙 대표 김선도 올림 -</p>
    </article>
</div>
