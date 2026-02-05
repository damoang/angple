<script lang="ts">
    /**
     * 설치 마법사 진행 상태 표시 컴포넌트
     *
     * @example
     * <StepIndicator currentStep={1} totalSteps={4} />
     */

    interface Props {
        /** 현재 단계 (1부터 시작) */
        currentStep: number;
        /** 전체 단계 수 */
        totalSteps?: number;
    }

    let { currentStep, totalSteps = 4 }: Props = $props();

    /**
     * 단계별 스타일 결정
     * - 완료: bg-primary/50 (반투명)
     * - 현재: bg-primary (강조)
     * - 미완료: bg-muted-foreground/30 (비활성)
     */
    function getStepClass(step: number): string {
        if (step < currentStep) {
            // 완료된 단계
            return 'bg-primary/50 text-primary-foreground';
        } else if (step === currentStep) {
            // 현재 단계
            return 'bg-primary text-primary-foreground';
        } else {
            // 미완료 단계
            return 'bg-muted-foreground/30 text-muted-foreground';
        }
    }

    /**
     * 연결선 스타일 결정
     * - 완료: bg-primary (강조)
     * - 미완료: bg-muted-foreground/30 (비활성)
     */
    function getLineClass(afterStep: number): string {
        if (afterStep < currentStep) {
            return 'bg-primary';
        } else {
            return 'bg-muted-foreground/30';
        }
    }

    // 단계 배열 생성
    const steps = Array.from({ length: totalSteps }, (_, i) => i + 1);
</script>

<div class="mb-8 flex items-center justify-center gap-2">
    {#each steps as step, index (step)}
        <!-- 단계 원형 -->
        <div
            class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold {getStepClass(step)}"
        >
            {step}
        </div>

        <!-- 연결선 (마지막 단계 제외) -->
        {#if index < steps.length - 1}
            <div class="h-0.5 w-8 {getLineClass(step)}"></div>
        {/if}
    {/each}
</div>
