<script lang="ts">
    import { DailyRecommendedPage } from '$lib/components/features/daily-recommended';

    const { data } = $props();
</script>

<svelte:head>
    <title>{data.dailyData?.date_display ?? data.date} 공감글 | 다모앙</title>
</svelte:head>

<DailyRecommendedPage
    date={data.date}
    dailyData={data.dailyData}
    calendarDates={data.calendar?.available_dates ?? []}
    oldestDate={data.calendar?.oldest_date ?? ''}
    newestDate={data.calendar?.newest_date ?? ''}
/>
