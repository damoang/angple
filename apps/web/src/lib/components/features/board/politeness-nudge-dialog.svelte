<script lang="ts">
    /**
     * 작성 시점 경어체/비속어 넛지 확인 모달.
     *
     * ⛔ 규제가 아니라 안내다. 막지 않고, 되돌리지 않는다. 회원이 [무시하고 글쓰기]를
     *    누르면 그대로 등록된다. 톤은 manner-tip("경어체 사용해 주세앙 🙏")과 맞춘다.
     * ⛔ "신고" 등 겁주는 문구 금지.
     *
     * 프로그램적으로 열고(handleSubmit 안에서), 사용자의 선택을 콜백으로 받는다.
     *   - [수정]        → onEdit()   (에디터로 돌아가 고친다)
     *   - [무시하고 글쓰기] → onProceed() (그대로 진행)
     */
    import {
        Dialog,
        DialogContent,
        DialogFooter,
        DialogHeader,
        DialogTitle
    } from '$lib/components/ui/dialog/index.js';
    import { Button } from '$lib/components/ui/button/index.js';

    /** 부드러운 앙 캐릭터 앙티콘. 상수로 빼 교체를 쉽게. */
    const ANGTICON_SRC = 'https://damoang.net/emoticons/DINKIssTyle-3d-ang-031.webp';

    interface Props {
        open?: boolean;
        /** 반말(경어체 아님) 감지됨 */
        politeness?: boolean;
        /** 비속어 감지됨 */
        profanity?: boolean;
        /** [수정] — 취소하고 에디터로 */
        onEdit: () => void;
        /** [무시하고 글쓰기] — 그대로 진행 */
        onProceed: () => void;
    }

    let {
        open = $bindable(false),
        politeness = false,
        profanity = false,
        onEdit,
        onProceed
    }: Props = $props();

    // 두 상황 모두 부드럽게. 둘 다면 두 줄.
    const lines = $derived(
        [
            profanity ? '비속어가 포함된 것 같아앙.' : '',
            politeness ? '경어체가 아닌 것 같아앙.' : ''
        ].filter(Boolean)
    );

    // 오버레이 클릭/ESC 로 닫히면 [수정](취소)과 동일 취급 — 안전한 쪽.
    // (버튼 클릭으로 닫힌 경우엔 이미 부모가 결정을 소비했으므로 중복 호출은 무시된다)
    function handleOpenChange(next: boolean) {
        if (!next && open) onEdit();
    }
</script>

<Dialog bind:open onOpenChange={handleOpenChange}>
    <DialogContent class="sm:max-w-sm" showCloseButton={false}>
        <DialogHeader class="items-center text-center">
            <img
                src={ANGTICON_SRC}
                alt="이모티콘"
                width="72"
                height="72"
                class="h-18 w-18 mx-auto object-contain"
                loading="lazy"
            />
            <DialogTitle class="mt-2 text-base font-semibold">잠깐, 확인해 주세앙 🙏</DialogTitle>
        </DialogHeader>

        <div class="text-muted-foreground space-y-1 text-center text-sm leading-relaxed">
            {#each lines as line (line)}
                <p>{line}</p>
            {/each}
            <p class="text-foreground pt-1 font-medium">그대로 등록할까요?</p>
        </div>

        <DialogFooter class="flex-row justify-center gap-2 sm:justify-center">
            <Button variant="outline" onclick={onEdit}>수정</Button>
            <Button variant="default" onclick={onProceed}>무시하고 글쓰기</Button>
        </DialogFooter>
    </DialogContent>
</Dialog>
