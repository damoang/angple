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
            {data.title}
        </h1>

        <div class="space-y-8">
            <!-- 1. 배너 광고 -->
            <section>
                <h2
                    class="text-foreground border-border mb-4 border-b-2 pb-2 text-xl font-bold sm:text-2xl"
                >
                    1. 배너 광고
                </h2>

                <div class="space-y-4">
                    <div>
                        <h3 class="text-foreground mb-2 text-lg font-semibold">가. 크기</h3>
                        <ul class="text-muted-foreground list-disc space-y-1 pl-6">
                            <li>
                                <span class="text-primary font-semibold">긴 배너</span> (광고 계약서
                                제2조 제3항 가목)
                            </li>
                            <li>
                                <span class="text-primary font-semibold">사이드 배너</span> (광고 계약서
                                제2조 제3항 나목)
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h3 class="text-foreground mb-2 text-lg font-semibold">나. 위치</h3>
                        <ul class="text-muted-foreground list-disc space-y-1 pl-6">
                            <li>
                                <span class="text-primary font-semibold">긴 배너</span> (광고 계약서
                                제2조 제3항 가목)
                            </li>
                            <li>
                                <span class="text-primary font-semibold">사이드 배너</span> (광고 계약서
                                제2조 제3항 나목)
                            </li>
                        </ul>
                    </div>
                </div>
            </section>

            <!-- 2. 직접홍보게시판 -->
            <section>
                <h2
                    class="text-foreground border-border mb-4 border-b-2 pb-2 text-xl font-bold sm:text-2xl"
                >
                    2. 직접홍보게시판
                    <span class="text-primary text-base font-semibold"
                        >(광고 계약서 제2조 제3항 다목)</span
                    >
                </h2>

                <div class="space-y-4">
                    <div>
                        <h3 class="text-foreground mb-2 text-lg font-semibold">가. 글 작성 요령</h3>
                        <ol class="text-muted-foreground list-decimal space-y-1 pl-6">
                            <li>
                                글의 제목 : <span class="text-primary font-semibold"
                                    >"[업체명] 제목"</span
                                > 형태를 반드시 유지
                            </li>
                            <li>말머리 : 계약 당시 특정한 말머리를 반드시 사용</li>
                            <li>본문...</li>
                        </ol>
                    </div>

                    <div>
                        <h3 class="text-foreground mb-2 text-lg font-semibold">
                            나. 홍보계정의 사용 범위
                        </h3>
                        <p class="text-muted-foreground">
                            홍보계정은 <strong class="text-foreground">직접홍보게시판에서만</strong>
                            글 작성 가능
                        </p>
                    </div>

                    <div>
                        <h3 class="text-foreground mb-2 text-lg font-semibold">
                            다. 금지행위
                            <span class="text-primary text-sm font-semibold"
                                >(홍보계정 및 일반가입계정 모두 적용)</span
                            >
                        </h3>
                        <ol class="text-muted-foreground list-decimal space-y-1 pl-6">
                            <li>계약된 홍보 대상이 아닌 것을 홍보하는 행위</li>
                            <li>회원을 기만하는 행위</li>
                        </ol>

                        <ol class="text-muted-foreground mt-3 list-none space-y-1.5 pl-4 text-sm">
                            <li>
                                가. 운영자 동의 없이 직접홍보게시판을 제외한 게시판에 홍보하는 행위
                            </li>
                            <li>나. 자신의 게시물에 댓글을 통해 홍보를 보조하거나 추천하는 행위</li>
                            <li>
                                다. 경쟁사 홍보물, 경쟁 상품을 고의적으로 비난하거나 깎아내리는 행위
                            </li>
                            <li>라. 타 업체의 상품과 혼동을 줄 수 있는 게시물을 작성하는 행위</li>
                            <li>
                                마. 직접홍보게시판을 제외한 게시판에 홍보 대상과 관련된 내용의 글을
                                작성하는 행위
                            </li>
                            <li>
                                바. 사실과 다른 내용을 홍보하거나, 보장되지 아니하는 수익성 등을
                                지나치게 부풀려 홍보하는 허위 홍보 행위
                            </li>
                            <li>사. 기타 적법하지 못한 방법으로 홍보하는 행위</li>
                        </ol>
                    </div>
                </div>
            </section>

            <!-- 3. 기타 -->
            <section>
                <h2
                    class="text-foreground border-border mb-4 border-b-2 pb-2 text-xl font-bold sm:text-2xl"
                >
                    3. 기타
                </h2>
                <p class="text-muted-foreground">
                    - 본 정책은 광고 계약 체결 시
                    <span class="text-primary font-semibold"
                        >다모앙의 모든 광고주님들께서 계약하시고 진행하시는 공통 기준</span
                    >입니다.
                </p>
            </section>
        </div>
    </article>
</div>
