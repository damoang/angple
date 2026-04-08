<script lang="ts">
    import { DailyEmpathyPage } from '$lib/components/features/daily-empathy';

    const { data } = $props();
</script>

<svelte:head>
    <title>날짜별 공감글 | 다모앙</title>
</svelte:head>

<DailyEmpathyPage
    date={data.date}
    dailyData={data.dailyData}
    calendarDates={data.calendar?.available_dates ?? []}
    oldestDate={data.calendar?.oldest_date ?? ''}
    newestDate={data.calendar?.newest_date ?? ''}
/>
