<script lang="ts">
    import { onMount } from 'svelte';
    import type { Chart as ChartType } from 'chart.js';

    interface DailyStatEntry {
        reports: number;
        posts: number;
        comments: number;
    }

    interface WeeklyStatEntry {
        posts: number;
        reports: number;
        comments: number;
        processed: number;
    }

    interface BoardStatEntry {
        name: string;
        count: number;
    }

    interface Props {
        dailyStats?: Record<string, DailyStatEntry>;
        weeklyStats?: Record<string, WeeklyStatEntry>;
        reportTypes?: Record<string, number>;
        boardStats?: BoardStatEntry[];
        periodDays?: number;
    }

    let { dailyStats, weeklyStats, reportTypes, boardStats, periodDays = 1 }: Props = $props();

    let dailyCanvas: HTMLCanvasElement | undefined = $state();
    let weeklyCanvas: HTMLCanvasElement | undefined = $state();
    let typesCanvas: HTMLCanvasElement | undefined = $state();
    let boardCanvas: HTMLCanvasElement | undefined = $state();

    let charts: ChartType[] = [];

    onMount(() => {
        import('chart.js').then(({ Chart, registerables }) => {
            Chart.register(...registerables);
            const gridColor = 'rgba(156, 163, 175, 0.2)';

            // 일별 활동 트렌드 (line)
            if (dailyCanvas && dailyStats && Object.keys(dailyStats).length > 0) {
                const labels: string[] = [];
                const reports: number[] = [];
                const posts: number[] = [];
                const comments: number[] = [];

                for (const [date, data] of Object.entries(dailyStats)) {
                    const d = new Date(date + 'T00:00:00');
                    labels.push(`${d.getMonth() + 1}월 ${d.getDate()}일`);
                    reports.push(data.reports || 0);
                    posts.push(data.posts || 0);
                    comments.push(data.comments || 0);
                }

                charts.push(
                    new Chart(dailyCanvas, {
                        type: 'line',
                        data: {
                            labels,
                            datasets: [
                                {
                                    label: '신고 건수',
                                    data: reports,
                                    borderColor: '#ef4444',
                                    backgroundColor: '#ef4444',
                                    pointRadius: 4
                                },
                                {
                                    label: '전체 게시글',
                                    data: posts,
                                    borderColor: '#3b82f6',
                                    backgroundColor: '#3b82f6',
                                    pointRadius: 4
                                },
                                {
                                    label: '전체 댓글',
                                    data: comments,
                                    borderColor: '#10b981',
                                    backgroundColor: '#10b981',
                                    pointRadius: 4
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                y: { beginAtZero: true, grid: { color: gridColor } },
                                x: { grid: { display: false } }
                            },
                            plugins: {
                                legend: {
                                    position: 'top',
                                    align: 'start',
                                    labels: {
                                        usePointStyle: true,
                                        padding: 20,
                                        boxWidth: 6,
                                        boxHeight: 6
                                    }
                                }
                            }
                        }
                    })
                );
            }

            // 요일별 활동 현황 (bar)
            if (weeklyCanvas && weeklyStats && Object.keys(weeklyStats).length > 0) {
                const dayMap: Record<string, number> = {
                    일: 0,
                    월: 1,
                    화: 2,
                    수: 3,
                    목: 4,
                    금: 5,
                    토: 6
                };
                const wp = [0, 0, 0, 0, 0, 0, 0];
                const wc = [0, 0, 0, 0, 0, 0, 0];
                const wr = [0, 0, 0, 0, 0, 0, 0];
                const wprc = [0, 0, 0, 0, 0, 0, 0];

                for (const [day, data] of Object.entries(weeklyStats)) {
                    const idx = dayMap[day];
                    if (idx !== undefined) {
                        wp[idx] = data.posts || 0;
                        wc[idx] = data.comments || 0;
                        wr[idx] = data.reports || 0;
                        wprc[idx] = data.processed || 0;
                    }
                }

                charts.push(
                    new Chart(weeklyCanvas, {
                        type: 'bar',
                        data: {
                            labels: ['일', '월', '화', '수', '목', '금', '토'],
                            datasets: [
                                { label: '전체글', data: wp, backgroundColor: '#3b82f6' },
                                { label: '전체댓글', data: wc, backgroundColor: '#10b981' },
                                { label: '신고수', data: wr, backgroundColor: '#ef4444' },
                                { label: '처리수', data: wprc, backgroundColor: '#8b5cf6' }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                y: { beginAtZero: true, grid: { color: gridColor } },
                                x: { grid: { display: false } }
                            },
                            plugins: {
                                legend: {
                                    position: 'top',
                                    align: 'start',
                                    labels: {
                                        usePointStyle: true,
                                        padding: 20,
                                        boxWidth: 6,
                                        boxHeight: 6
                                    }
                                }
                            }
                        }
                    })
                );
            }

            // 신고 사유 분포 (doughnut)
            if (typesCanvas && reportTypes && Object.keys(reportTypes).length > 0) {
                charts.push(
                    new Chart(typesCanvas, {
                        type: 'doughnut',
                        data: {
                            labels: Object.keys(reportTypes),
                            datasets: [
                                {
                                    data: Object.values(reportTypes),
                                    backgroundColor: [
                                        '#ef4444',
                                        '#10b981',
                                        '#3b82f6',
                                        '#f59e0b',
                                        '#8b5cf6',
                                        '#ec4899',
                                        '#6b7280',
                                        '#14b8a6',
                                        '#f97316'
                                    ],
                                    borderWidth: 0
                                }
                            ]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                legend: {
                                    position: 'right',
                                    align: 'start',
                                    labels: {
                                        usePointStyle: true,
                                        padding: 20,
                                        boxWidth: 6,
                                        boxHeight: 6
                                    }
                                }
                            }
                        }
                    })
                );
            }

            // 게시판별 현황 (horizontal bar)
            if (boardCanvas && boardStats && boardStats.length > 0) {
                charts.push(
                    new Chart(boardCanvas, {
                        type: 'bar',
                        data: {
                            labels: boardStats.map((b) => b.name || '게시판'),
                            datasets: [
                                {
                                    label: '신고 건수',
                                    data: boardStats.map((b) => b.count || 0),
                                    backgroundColor: '#ef4444'
                                }
                            ]
                        },
                        options: {
                            indexAxis: 'y',
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                                x: { beginAtZero: true, grid: { color: gridColor } },
                                y: { grid: { display: false } }
                            },
                            plugins: { legend: { display: false } }
                        }
                    })
                );
            }
        });

        return () => {
            charts.forEach((c) => c.destroy());
        };
    });
</script>

<div class="grid grid-cols-1 gap-5 md:grid-cols-2">
    {#if dailyStats && Object.keys(dailyStats).length > 0}
        <div class="rounded-xl border p-5">
            <div class="mb-3">
                <h3 class="text-foreground text-sm font-medium">일별 활동 트렌드</h3>
                <p class="text-muted-foreground text-xs">
                    선택 기간 신고/게시글/댓글 현황 ({periodDays}일간)
                </p>
            </div>
            <div class="relative h-56">
                <canvas bind:this={dailyCanvas}></canvas>
            </div>
        </div>
    {/if}

    {#if weeklyStats && Object.keys(weeklyStats).length > 0}
        <div class="rounded-xl border p-5">
            <div class="mb-3">
                <h3 class="text-foreground text-sm font-medium">요일별 활동 현황</h3>
                <p class="text-muted-foreground text-xs">글/댓글/신고/처리 활동 분석</p>
            </div>
            <div class="relative h-56">
                <canvas bind:this={weeklyCanvas}></canvas>
            </div>
        </div>
    {/if}

    {#if reportTypes && Object.keys(reportTypes).length > 0}
        <div class="rounded-xl border p-5">
            <div class="mb-3">
                <h3 class="text-foreground text-sm font-medium">신고 사유 분포</h3>
                <p class="text-muted-foreground text-xs">주요 신고 유형별 비율</p>
            </div>
            <div class="relative h-56">
                <canvas bind:this={typesCanvas}></canvas>
            </div>
        </div>
    {/if}

    {#if boardStats && boardStats.length > 0}
        <div class="rounded-xl border p-5">
            <div class="mb-3">
                <h3 class="text-foreground text-sm font-medium">게시판별 현황</h3>
                <p class="text-muted-foreground text-xs">게시판별 신고 건수</p>
            </div>
            <div class="relative h-56">
                <canvas bind:this={boardCanvas}></canvas>
            </div>
        </div>
    {/if}
</div>
