<script lang="ts">
    /**
     * 버그게시판 글쓰기 안내 인터스티셜.
     * 신고는 신고 버튼으로, 질문은 질문게시판으로 유도하고, 버그 제보 양식을 안내한다.
     * 특정 회원·사건을 언급하지 않는 중립 안내(게시판 용도 정리)로만 작성한다.
     */
    import { Button } from '$lib/components/ui/button/index.js';
    import { setBugNoticeSkip } from './bug-write-notice.js';

    let { onContinue }: { onContinue: () => void } = $props();

    let skipToday = $state(false);

    function handleContinue(): void {
        if (skipToday) setBugNoticeSkip();
        onContinue();
    }
</script>

<div class="mx-auto max-w-xl">
    <div class="border-border bg-background overflow-hidden rounded-xl border shadow-sm">
        <div class="bg-slate-800 px-5 py-4 text-base font-semibold text-white dark:bg-slate-700">
            🐛 버그·기능 제보 게시판이에요
        </div>

        <div class="text-muted-foreground space-y-4 px-5 py-4 text-sm">
            <p>
                이곳은 다모앙의 <strong class="text-foreground">버그 신고</strong>와
                <strong class="text-foreground">기능 제안</strong>을 접수하는 창구예요. 더 나은
                다모앙을 위한 제보 감사합니다.
            </p>

            <div class="border-border/60 border-t pt-3">
                <p class="text-foreground font-medium">🚩 회원·게시물을 신고하시나요?</p>
                <p class="mt-1">
                    특정 회원이나 글·댓글에 대한 신고는 이 게시판이 아니라, 해당 글·댓글의
                    <strong class="text-foreground">신고 버튼</strong>(글·댓글 ⋮ 메뉴 → 🚩 신고)을
                    이용해 주세요. 접수된 신고는 운영팀이 별도 절차로 확인합니다.
                </p>
            </div>

            <div class="border-border/60 border-t pt-3">
                <p class="text-foreground font-medium">❓ 궁금한 점이 있으신가요?</p>
                <p class="mt-1">
                    사용법이나 질문은 <a href="/qa" class="text-primary hover:underline"
                        >질문과 답변</a
                    >
                    게시판을 이용해 주시면 더 빠르게 도움받으실 수 있어요.
                </p>
            </div>

            <div class="border-border/60 border-t pt-3">
                <p class="text-foreground font-medium">
                    🐛 버그 제보라면 — 아래 환경을 함께 적어주세요
                </p>
                <p class="mt-1">
                    ㅇ 사용기기: 모바일 / PC / 맥 / 기타<br />
                    ㅇ 브라우저: 크롬 / 사파리 / 엣지 / 기타<br />
                    <span class="text-xs">(관련 없는 항목은 지우셔도 됩니다)</span>
                </p>
            </div>

            <div class="border-border/60 border-t pt-3">
                <p class="text-foreground font-medium">🚨 긴급 버그</p>
                <p class="mt-1">
                    로그인 불가·결제 오류·데이터 손실 등 긴급 건은 제목이나 본문에
                    <strong class="text-foreground">[긴급]</strong>으로 표시해 주세요.
                </p>
            </div>
        </div>

        <div class="border-border/60 border-t px-5 py-4">
            <Button class="w-full" onclick={handleContinue}>확인하고 제보 계속하기 →</Button>
            <label
                class="text-muted-foreground mt-3 flex select-none items-center justify-center gap-2 text-xs"
            >
                <input
                    type="checkbox"
                    bind:checked={skipToday}
                    class="accent-primary h-3.5 w-3.5"
                />
                오늘 하루 이 안내 보지 않기
            </label>
        </div>
    </div>
</div>
