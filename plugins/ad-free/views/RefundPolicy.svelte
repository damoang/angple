<script lang="ts">
    interface Props {
        supportEmail?: string;
    }
    let { supportEmail = 'help@example.com' }: Props = $props();
</script>

<svelte:head>
    <title>환불 정책 | 광고 제거 멤버십</title>
    <meta name="description" content="광고 제거 멤버십의 환불 정책 안내." />
</svelte:head>

<div class="ad-free-refund mx-auto max-w-3xl px-4 py-12 sm:py-16">
    <header class="border-b pb-6">
        <p class="text-muted-foreground text-sm">광고 제거 멤버십</p>
        <h1 class="mt-2 text-3xl font-bold sm:text-4xl">환불 정책</h1>
        <p class="text-muted-foreground mt-3 text-sm">
            아래 안내는 본 멤버십(정기구독)에 적용되며, 결제대행사 약관 및 관련 법령 (전자상거래법
            제17조 등) 을 따릅니다.
        </p>
    </header>

    <section class="mt-8 space-y-6">
        <article>
            <h2 class="text-xl font-semibold">1. 7일 이내 해지 환불</h2>
            <p class="text-muted-foreground mt-2">
                결제일로부터 7일 이내, 그리고 멤버십 혜택을 사용한 이력이 없는 경우 전액 환불을 받을
                수 있습니다. 광고 제거 기능이 실제로 적용된 시점이 사용 이력으로 간주됩니다.
            </p>
        </article>

        <article>
            <h2 class="text-xl font-semibold">2. 정기결제 해지</h2>
            <p class="text-muted-foreground mt-2">
                다음 결제일 이전에 해지를 신청하시면, 다음 회차 결제가 자동으로 중지됩니다. 이미
                결제된 회차는 환불 대상이 아니며, 해당 기간이 종료될 때까지 혜택은 계속 제공됩니다.
            </p>
        </article>

        <article>
            <h2 class="text-xl font-semibold">3. 무료 체험 기간 해지</h2>
            <p class="text-muted-foreground mt-2">
                무료 체험 기간(가입일 기준 7일) 안에 해지하시면 결제가 이루어지지 않습니다. 별도의
                환불 절차가 필요 없습니다.
            </p>
        </article>

        <article>
            <h2 class="text-xl font-semibold">4. 환불 신청 방법</h2>
            <ol
                class="text-muted-foreground marker:text-foreground mt-2 list-decimal space-y-1 pl-5"
            >
                <li>마이페이지의 구독 관리 메뉴에서 해지/환불 신청</li>
                <li>
                    또는 이메일 <a href="mailto:{supportEmail}" class="underline">{supportEmail}</a>
                    로 문의 (가입 이메일과 결제 수단을 함께 기재해 주세요)
                </li>
            </ol>
        </article>

        <article>
            <h2 class="text-xl font-semibold">5. 환불 처리 기간</h2>
            <p class="text-muted-foreground mt-2">
                환불 승인 후 영업일 기준 3~5일 이내에 원 결제 수단으로 처리됩니다. 카드사/PG사
                일정에 따라 실제 입금까지 추가 시간이 소요될 수 있습니다.
            </p>
        </article>

        <article>
            <h2 class="text-xl font-semibold">6. 환불 불가 사유</h2>
            <ul class="text-muted-foreground marker:text-foreground mt-2 list-disc space-y-1 pl-5">
                <li>약관 위반으로 멤버십이 정지/해지된 경우</li>
                <li>혜택을 상당 기간 사용한 후 단순 변심으로 환불을 요구하는 경우</li>
                <li>결제 후 7일이 경과한 회차분 (정기결제 해지로 다음 회차 진행 중지는 가능)</li>
            </ul>
        </article>
    </section>

    <footer class="text-muted-foreground mt-12 border-t pt-6 text-sm">
        <p>
            추가 문의는 <a href="mailto:{supportEmail}" class="underline">{supportEmail}</a> 으로 보내주시면
            영업일 기준 1~2일 안에 답변드립니다.
        </p>
        <p class="mt-2">
            <a href="/ad-free" class="text-primary underline">← 광고 제거 멤버십 안내로 돌아가기</a>
        </p>
    </footer>
</div>
