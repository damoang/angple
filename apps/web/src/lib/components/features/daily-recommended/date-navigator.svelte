<script lang="ts">
    import type { DailyCalendarEntry } from '$lib/api/types.js';
    import { Calendar } from '$lib/components/ui/calendar';
    import * as Popover from '$lib/components/ui/popover';
    import { CalendarDate, type DateValue, today, getLocalTimeZone } from '@internationalized/date';

    interface Props {
        currentDate: string;
        calendarDates: DailyCalendarEntry[];
        oldestDate: string;
        newestDate: string;
        onDateChange: (date: string) => void;
    }

    const { currentDate, calendarDates, oldestDate, newestDate, onDateChange }: Props = $props();

    let popoverOpen = $state(false);

    // 사용 가능한 날짜 Set (빠른 조회용)
    const availableDateSet = $derived(new Set(calendarDates.map((d) => d.date)));

    // 현재 날짜를 CalendarDate로 변환
    const currentCalendarDate = $derived.by(() => {
        const [y, m, d] = currentDate.split('-').map(Number);
        return new CalendarDate(y, m, d);
    });

    // 선택 가능 범위
    const minDate = $derived.by(() => {
        if (!oldestDate) return undefined;
        const [y, m, d] = oldestDate.split('-').map(Number);
        return new CalendarDate(y, m, d);
    });

    const maxDate = $derived.by(() => {
        if (!newestDate) return undefined;
        const [y, m, d] = newestDate.split('-').map(Number);
        return new CalendarDate(y, m, d);
    });

    // 이전/다음 날짜 계산
    const currentIndex = $derived(calendarDates.findIndex((d) => d.date === currentDate));
    // calendarDates는 최신 → 과거 순 정렬
    const prevDate = $derived(
        currentIndex >= 0 && currentIndex < calendarDates.length - 1
            ? calendarDates[currentIndex + 1]?.date
            : null
    );
    const nextDate = $derived(currentIndex > 0 ? calendarDates[currentIndex - 1]?.date : null);

    // 날짜 표시 텍스트 (현재 날짜의 date_display)
    const currentDisplay = $derived(
        calendarDates.find((d) => d.date === currentDate)?.date_display ?? currentDate
    );

    // 비활성 날짜 판별
    function isDateUnavailable(date: DateValue): boolean {
        const dateStr = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
        return !availableDateSet.has(dateStr);
    }

    // 달력에서 날짜 선택
    function handleCalendarSelect(value: DateValue | undefined) {
        if (!value) return;
        const dateStr = `${value.year}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`;
        if (availableDateSet.has(dateStr)) {
            popoverOpen = false;
            onDateChange(dateStr);
        }
    }

    let calendarValue = $state<DateValue | undefined>(undefined);

    $effect(() => {
        calendarValue = currentCalendarDate;
    });
</script>

<div class="flex items-center gap-1">
    <!-- 이전 날짜 -->
    <button
        type="button"
        class="hover:bg-muted rounded p-1.5 transition-colors disabled:opacity-30"
        disabled={!prevDate}
        onclick={() => prevDate && onDateChange(prevDate)}
        aria-label="이전 날짜"
    >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 18l-6-6 6-6" />
        </svg>
    </button>

    <!-- 달력 팝업 트리거 -->
    <Popover.Root bind:open={popoverOpen}>
        <Popover.Trigger
            class="hover:bg-muted rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
        >
            {currentDisplay}
        </Popover.Trigger>
        <Popover.Content class="w-auto p-0" align="center">
            <Calendar
                type="single"
                bind:value={calendarValue}
                onValueChange={handleCalendarSelect}
                {isDateUnavailable}
                minValue={minDate}
                maxValue={maxDate}
                locale="ko-KR"
                weekdayFormat="short"
                class="rounded-md border-0"
            />
        </Popover.Content>
    </Popover.Root>

    <!-- 다음 날짜 -->
    <button
        type="button"
        class="hover:bg-muted rounded p-1.5 transition-colors disabled:opacity-30"
        disabled={!nextDate}
        onclick={() => nextDate && onDateChange(nextDate)}
        aria-label="다음 날짜"
    >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6" />
        </svg>
    </button>
</div>
