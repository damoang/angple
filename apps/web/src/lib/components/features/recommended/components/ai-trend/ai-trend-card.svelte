<script lang="ts">
    import type { AIAnalysis } from '$lib/api/types.js';
    import { HeadlineRotator, KeywordBadges } from './index.js';

    let { analysis }: { analysis: AIAnalysis } = $props();
</script>

<!-- PHP AI 트렌드 분석 카드 재현 -->
<div class="rounded-lg bg-blue-50 p-3 dark:bg-blue-950">
    <div class="flex items-start gap-2">
        <!-- 앙 AI 캐릭터 이미지 -->
        <div class="flex-shrink-0">
            <img
                src="https://s3.damoang.net/data/editor/2509/5770b-68ca37f63464f-24fb734ab222da3cff7aee7898aedce5e1c3c360.webp"
                alt="앙 AI 캐릭터"
                class="h-10 w-10 rounded-full object-cover"
            />
        </div>
        <div class="flex-1">
            <!-- 키워드 배지 -->
            <KeywordBadges keywords={analysis.keywords} />

            <!-- 헤드라인 로테이터 -->
            <div class="mt-2">
                <HeadlineRotator headlines={analysis.trend_summary.headline} />
            </div>

            <!-- 상세 설명 (ambient_whisper) -->
            <!--            <p class="mt-2 text-xs text-gray-700 dark:text-gray-300">-->
            <!--                {analysis.ambient_whisper.join(' · ')}-->
            <!--            </p>-->
        </div>
    </div>
</div>
